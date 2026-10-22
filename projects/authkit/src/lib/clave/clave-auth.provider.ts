import {
  authError,
  fail,
  next,
  type AuthAssuranceLevel,
  type AuthCapabilities,
  type AuthErrorCode,
  type AuthResult,
  type AuthSession,
  type AuthState,
} from '../contract/auth.models';
import type { AuthStateChange } from '../contract/auth.provider';
import type {
  AuthFederationOptions,
  AuthFederationRequest,
  AuthKitFederationOutcome,
  ServerDrivenAuthProvider,
} from './clave.models';

/** Cl@ve 2 does not offer `low`; substantial is the safe default (spec-clave §5.2). */
const DEFAULT_LEVEL: AuthAssuranceLevel = 'substantial';

const NOT_A_PASSWORD_PROVIDER =
  'Cl@ve is not a password provider. Start the federation with beginFederation().';

const METHOD_NOT_AVAILABLE = 'This sign-in method is not available for Cl@ve.';

const FEDERATION_FAILED_MESSAGE = 'The identity provider did not complete the sign in.';

/**
 * Generic outward messages. R-13: an internal reason (signature, certificate, replay) is never
 * shown to the user, and `error_reason` is never echoed.
 */
const FEDERATION_MESSAGES: Readonly<Record<string, string>> = {
  federation_cancelled: 'The sign in was cancelled.',
  federation_failed: FEDERATION_FAILED_MESSAGE,
  loa_not_met: 'The identity provider did not confirm the required assurance level.',
  certificate_invalid: 'The certificate presented could not be accepted.',
  identity_not_verified: 'The identity could not be verified.',
  tenant_mismatch: 'The identity belongs to a different organisation.',
};

/**
 * Pasarela reasons the host may put in the redirect, mapped onto the contract taxonomy. The value
 * itself never reaches the screen; only the generic message for the mapped code does.
 */
const FEDERATION_ERROR_BY_REASON: Readonly<Record<string, AuthErrorCode>> = {
  federation_cancelled: 'federation_cancelled',
  cancelled: 'federation_cancelled',
  cancel: 'federation_cancelled',
  access_denied: 'federation_cancelled',
  user_cancelled: 'federation_cancelled',
  federation_failed: 'federation_failed',
  authentication_failed: 'federation_failed',
  loa_not_met: 'loa_not_met',
  loa_below_requested: 'loa_not_met',
  certificate_invalid: 'certificate_invalid',
  certificate_unknown: 'certificate_invalid',
  identity_not_verified: 'identity_not_verified',
  tenant_mismatch: 'tenant_mismatch',
};

/** Keys that belong to the protocol, not to the page the user landed on. */
const FEDERATION_QUERY_KEYS: readonly string[] = ['error', 'error_reason'];

const RELATIVE_BASE = 'http://authkit.invalid';

/** Options needed to build the host's login URL. Shared by the provider and `<ak-clave>`. */
export interface ClaveLoginUrlOptions {
  readonly baseUrl?: string;
  readonly loginPath: string;
  readonly level: AuthAssuranceLevel;
  readonly method?: string | null;
  readonly returnUrl?: string | null;
}

/**
 * Builds `{baseUrl}{loginPath}?loa=…&method=…&returnUrl=…`, the server-driven route the host maps
 * with MapClave() (spec-clave §4.2). Pure and synchronous so the component can render an `href`.
 */
export function buildClaveLoginUrl(options: ClaveLoginUrlOptions): string {
  const loginPath = options.loginPath.trim();

  if (!loginPath) {
    throw new Error('AuthKit: a Cl@ve loginPath is required.');
  }

  const baseUrl = (options.baseUrl ?? '').trim().replace(/\/+$/, '');
  const path = baseUrl && !loginPath.startsWith('/') ? `/${loginPath}` : loginPath;
  const separator = !path.includes('?') ? '?' : path.endsWith('?') || path.endsWith('&') ? '' : '&';

  const params = new URLSearchParams();
  params.set('loa', options.level);

  if (options.method) {
    params.set('method', options.method);
  }

  if (options.returnUrl) {
    params.set('returnUrl', options.returnUrl);
  }

  return `${baseUrl}${path}${separator}${params.toString()}`;
}

/**
 * Reads the outcome the host put in the redirect. Only `error` and `error_reason` are inspected,
 * both are stripped from `cleanUrl`, and the raw reason is never returned (R-13).
 */
export function inspectFederationCallback(callbackUrl: string): AuthKitFederationOutcome {
  const raw = callbackUrl.trim();

  if (!raw) {
    return {
      ok: false,
      error: authError('federation_failed', FEDERATION_FAILED_MESSAGE),
      cleanUrl: callbackUrl,
      returnUrl: null,
    };
  }

  const absolute = isAbsoluteUrl(raw);
  const url = absolute ? new URL(raw) : new URL(raw, RELATIVE_BASE);
  const returnUrl = nonEmpty(url.searchParams.get('returnUrl'));
  const reason =
    nonEmpty(url.searchParams.get('error')) ?? nonEmpty(url.searchParams.get('error_reason'));

  for (const key of FEDERATION_QUERY_KEYS) {
    url.searchParams.delete(key);
  }

  const cleanUrl = absolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;

  if (!reason) {
    return { ok: true, error: null, cleanUrl, returnUrl };
  }

  const code = FEDERATION_ERROR_BY_REASON[reason.toLowerCase()] ?? 'federation_failed';
  return { ok: false, error: authError(code, messageFor(code)), cleanUrl, returnUrl };
}

/**
 * Server-driven provider for Cl@ve (eIDAS). The SAML exchange, the assertion validation and the
 * session all live in the host's server; the browser only builds a login URL and reads the
 * redirect outcome (spec-clave §6, ADR-003).
 *
 * Consequences of that boundary, all deliberate:
 *
 * - `currentSession` is always `null`. The browser never holds a Cl@ve token, so there is nothing
 *   to return; the host's own cookie or bearer token is the session.
 * - `refreshSession()` therefore resolves with an ok result and no session. It never calls the
 *   network. A host that needs a token uses its own session or an AuthProvider that issues one.
 * - `completeFederation()` / `completeOAuth()` perform no token exchange: success is inferred from
 *   the host's session, which exists by the time the callback renders.
 * - `signOut()` clears local state only — which is empty by design. The host signs out.
 */
export class ClaveAuthProvider implements ServerDrivenAuthProvider {
  private readonly options: AuthFederationOptions;
  private readonly listeners = new Set<(change: AuthStateChange) => void>();

  constructor(options: AuthFederationOptions) {
    if (!options.loginPath?.trim()) {
      throw new Error('AuthKit: a Cl@ve loginPath is required.');
    }

    this.options = options;
  }

  get capabilities(): AuthCapabilities {
    return {
      password: false,
      signUp: false,
      magicLink: false,
      emailOtp: false,
      phoneOtp: false,
      passwordRecovery: false,
      mfa: false,
      socialProviders: [],
      // The descriptors the host configured. This is what the UI renders, verbatim.
      federation: this.options.providers,
    };
  }

  /** Always null: the browser never holds a Cl@ve token. See the class comment. */
  get currentSession(): AuthSession | null {
    return null;
  }

  /** The configuration, for components and hosts that need the login path or the ref. */
  get federationOptions(): AuthFederationOptions {
    return this.options;
  }

  onStateChange(listener: (change: AuthStateChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Builds the host's login URL and reports `redirecting`. The host decides whether that becomes
   * a redirect, a link or an in-app browser.
   */
  async beginFederation(request: AuthFederationRequest): Promise<string> {
    const url = buildClaveLoginUrl({
      baseUrl: this.options.baseUrl,
      loginPath: this.options.loginPath,
      level: request.level ?? DEFAULT_LEVEL,
      method: request.method ?? null,
      returnUrl: request.returnUrl ?? this.options.returnUrl ?? null,
    });

    this.emit('redirecting');
    return url;
  }

  /** Parses the redirect. No network call, no token exchange, no session. */
  async completeFederation(callbackUrl: string): Promise<AuthResult> {
    return this.settle(inspectFederationCallback(callbackUrl));
  }

  /** Alias of `completeFederation` for hosts that route their callback through the OAuth entry. */
  async completeOAuth(callbackUrl: string): Promise<AuthResult> {
    return this.settle(inspectFederationCallback(callbackUrl));
  }

  /** Nothing to refresh: the browser holds no token. The host's session is the source of truth. */
  async refreshSession(): Promise<AuthResult> {
    return next('none');
  }

  /** Clears local state only. There is none by design; the host performs the real sign-out. */
  async signOut(): Promise<void> {
    this.emit('idle');
  }

  /** Cl@ve is not a password provider. */
  async signInWithPassword(_email: string, _password: string): Promise<AuthResult> {
    return this.disabled(NOT_A_PASSWORD_PROVIDER);
  }

  /** Cl@ve is not a password provider, so it cannot create local accounts. */
  async signUpWithPassword(
    _email: string,
    _password: string,
    _metadata?: Readonly<Record<string, string>>,
  ): Promise<AuthResult> {
    return this.disabled(NOT_A_PASSWORD_PROVIDER);
  }

  /** Cl@ve is not a magic-link provider. */
  async sendMagicLink(_email: string, _redirectTo?: string): Promise<AuthResult> {
    return this.disabled();
  }

  /** Cl@ve manages credentials at the pasarela; it never resets a password. */
  async sendPasswordReset(_email: string, _redirectTo?: string): Promise<AuthResult> {
    return this.disabled(NOT_A_PASSWORD_PROVIDER);
  }

  /** Cl@ve manages credentials at the pasarela; there is no local password to update. */
  async updatePassword(_newPassword: string): Promise<AuthResult> {
    return this.disabled(NOT_A_PASSWORD_PROVIDER);
  }

  /** Cl@ve is not an OTP provider; the method selector starts a federation instead. */
  async sendEmailOtp(_email: string): Promise<AuthResult> {
    return this.disabled();
  }

  /** Cl@ve is not an OTP provider. */
  async verifyEmailOtp(_email: string, _token: string): Promise<AuthResult> {
    return this.disabled();
  }

  /** Cl@ve is not an OTP provider. */
  async sendPhoneOtp(_phone: string): Promise<AuthResult> {
    return this.disabled();
  }

  /** Cl@ve is not an OTP provider. */
  async verifyPhoneOtp(_phone: string, _token: string): Promise<AuthResult> {
    return this.disabled();
  }

  /**
   * Cl@ve is not a social provider, and encoding it as `beginOAuth('clave')` is rejected by design
   * (spec-clave §2). Use `beginFederation()` with a level and a method instead.
   */
  async beginOAuth(_provider: string, _redirectTo?: string): Promise<string> {
    throw new Error('AuthKit: Cl@ve is not an OAuth provider. Use beginFederation().');
  }

  private disabled(message: string = METHOD_NOT_AVAILABLE): AuthResult {
    return fail(authError('provider_disabled', message));
  }

  private settle(outcome: AuthKitFederationOutcome): AuthResult {
    if (outcome.ok) {
      // Success is inferred from the host's session; there is no session to hand back here.
      return next('none');
    }

    this.emit('error');
    return fail(outcome.error ?? authError('federation_failed', FEDERATION_FAILED_MESSAGE));
  }

  private emit(state: AuthState): void {
    for (const listener of this.listeners) {
      listener({ state, session: null } satisfies AuthStateChange);
    }
  }
}

function messageFor(code: AuthErrorCode): string {
  return FEDERATION_MESSAGES[code] ?? FEDERATION_FAILED_MESSAGE;
}

function nonEmpty(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isAbsoluteUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
