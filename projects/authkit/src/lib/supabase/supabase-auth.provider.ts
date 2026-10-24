import { createClient, type SupabaseClient, type User, type Session } from '@supabase/supabase-js';
import {
  authError,
  fail,
  next,
  ok,
  type AuthCapabilities,
  type AuthErrorCode,
  type AuthResult,
  type AuthSession,
  type AuthState,
  type AuthUser,
} from '../contract/auth.models';
import type { AuthProvider, AuthStateChange } from '../contract/auth.provider';

export interface SupabaseAuthOptions {
  /** Project URL, for example https://abcdefgh.supabase.co. */
  readonly url: string;
  /**
   * Public anon key. Never pass the service role key: it bypasses row level security.
   */
  readonly anonKey: string;
  /** Default redirect used by emails and OAuth. */
  readonly redirectTo?: string;
  readonly socialProviders?: readonly string[];
  /** Bring your own client (tests, SSR, or an existing instance). */
  readonly client?: SupabaseClient;
}

const STORAGE_KEY = 'authkit.session';

/**
 * sessionStorage is used on purpose instead of localStorage: the session dies with the tab,
 * which limits the theft window after an XSS. See docs/threat-model.md (T-05).
 */
const browserStorage = {
  getItem(key: string): string | null {
    try {
      return globalThis.sessionStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      globalThis.sessionStorage?.setItem(key, value);
    } catch {
      // Storage disabled or SSR: the in-memory client keeps working for this page.
    }
  },
  removeItem(key: string): void {
    try {
      globalThis.sessionStorage?.removeItem(key);
    } catch {
      // Ignore.
    }
  },
};

export function createSupabaseClient(options: SupabaseAuthOptions): SupabaseClient {
  if (!options.url) {
    throw new Error('AuthKit: Supabase url is required.');
  }

  const parsed = new URL(options.url);
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname);
  const secure = parsed.protocol === 'https:' || (parsed.protocol === 'http:' && loopback);

  if (!secure) {
    throw new Error(
      'AuthKit: Supabase url must use https. Plain http is only accepted for loopback hosts.',
    );
  }

  if (!options.anonKey) {
    throw new Error('AuthKit: Supabase anonKey is required.');
  }

  if (parsed.username || parsed.password) {
    throw new Error('AuthKit: Supabase url must not contain credentials.');
  }

  if (looksLikeServiceRoleKey(options.anonKey)) {
    throw new Error(
      'AuthKit: the supplied key looks like a service role key. Shipping it to a browser would bypass row level security.',
    );
  }

  return createClient(options.url, options.anonKey, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: STORAGE_KEY,
      storage: browserStorage,
    },
  });
}

export class SupabaseAuthProvider implements AuthProvider {
  private readonly client: SupabaseClient;
  private readonly options: SupabaseAuthOptions;
  private readonly listeners = new Set<(change: AuthStateChange) => void>();
  private session: AuthSession | null = null;

  constructor(options: SupabaseAuthOptions) {
    this.options = options;
    this.client = options.client ?? createSupabaseClient(options);

    this.client.auth.onAuthStateChange((event, session) => {
      this.session = session ? mapSession(session) : null;
      this.emit(event === 'SIGNED_OUT' ? 'idle' : this.session ? 'authenticated' : 'idle');
    });
  }

  get capabilities(): AuthCapabilities {
    return {
      password: true,
      signUp: true,
      magicLink: true,
      emailOtp: true,
      phoneOtp: true,
      passwordRecovery: true,
      mfa: true,
      socialProviders: this.options.socialProviders ?? [],
    };
  }

  get currentSession(): AuthSession | null {
    return this.session;
  }

  /** Restores the session persisted by supabase-js. */
  async initialize(): Promise<AuthResult> {
    const { data, error } = await this.client.auth.getSession();
    if (error) {
      return fail(mapError(error));
    }

    this.session = data.session ? mapSession(data.session) : null;
    this.emit(this.session ? 'authenticated' : 'idle');
    return this.session ? ok(this.session) : next('none');
  }

  onStateChange(listener: (change: AuthStateChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async signInWithPassword(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    return this.settle(data.session, error);
  }

  async signUpWithPassword(
    email: string,
    password: string,
    metadata?: Readonly<Record<string, string>>,
  ): Promise<AuthResult> {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        data: metadata ? { ...metadata } : undefined,
        emailRedirectTo: this.options.redirectTo,
      },
    });

    if (error) {
      return fail(mapError(error));
    }

    // With email confirmation enabled Supabase returns a user but no session.
    return data.session ? this.settle(data.session, null) : next('confirm_email');
  }

  async sendMagicLink(email: string, redirectTo?: string): Promise<AuthResult> {
    const { error } = await this.client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo ?? this.options.redirectTo },
    });

    return error ? fail(mapError(error)) : next('confirm_email');
  }

  async sendPasswordReset(email: string, redirectTo?: string): Promise<AuthResult> {
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo ?? this.options.redirectTo,
    });

    return error ? fail(mapError(error)) : next('confirm_email');
  }

  async updatePassword(newPassword: string): Promise<AuthResult> {
    const { data, error } = await this.client.auth.updateUser({ password: newPassword });
    if (error) {
      return fail(mapError(error));
    }

    if (data.user && this.session) {
      const updated: AuthSession = { ...this.session, user: mapUser(data.user) };
      this.session = updated;
      this.emit('authenticated');
      return ok(updated);
    }

    return next('none');
  }

  async sendEmailOtp(email: string): Promise<AuthResult> {
    const { error } = await this.client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: this.options.redirectTo },
    });

    return error ? fail(mapError(error)) : next('verify_otp');
  }

  async verifyEmailOtp(email: string, token: string): Promise<AuthResult> {
    const { data, error } = await this.client.auth.verifyOtp({ email, token, type: 'email' });
    return this.settle(data.session, error);
  }

  async sendPhoneOtp(phone: string): Promise<AuthResult> {
    const { error } = await this.client.auth.signInWithOtp({ phone });
    return error ? fail(mapError(error)) : next('verify_otp');
  }

  async verifyPhoneOtp(phone: string, token: string): Promise<AuthResult> {
    const { data, error } = await this.client.auth.verifyOtp({ phone, token, type: 'sms' });
    return this.settle(data.session, error);
  }

  async beginOAuth(provider: string, redirectTo?: string): Promise<string> {
    const { data, error } = await this.client.auth.signInWithOAuth({
      // The SDK types the provider as a closed union; the contract accepts any provider name.
      provider: provider as Parameters<SupabaseClient['auth']['signInWithOAuth']>[0]['provider'],
      options: {
        redirectTo: redirectTo ?? this.options.redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data.url) {
      throw new Error(
        error
          ? mapError(error).message
          : 'AuthKit: the provider did not return an authorization URL.',
      );
    }

    return data.url;
  }

  async completeOAuth(callbackUrl: string): Promise<AuthResult> {
    let url: URL;
    try {
      url = new URL(callbackUrl);
    } catch {
      return fail(authError('unknown', 'The authentication callback URL is invalid.'));
    }

    const oauthError = url.searchParams.get('error');
    if (oauthError) {
      return fail(
        authError(
          oauthError.includes('access_denied') ? 'provider_disabled' : 'unknown',
          'The provider did not complete the sign in.',
        ),
      );
    }

    const code = url.searchParams.get('code');
    if (code) {
      const { data, error } = await this.client.auth.exchangeCodeForSession(code);
      return this.settle(data.session, error);
    }

    const { data, error } = await this.client.auth.getSession();
    return error ? fail(mapError(error)) : this.settle(data.session, null);
  }

  async refreshSession(): Promise<AuthResult> {
    const { data, error } = await this.client.auth.refreshSession();
    return error ? fail(mapError(error)) : this.settle(data.session, null);
  }

  async signOut(): Promise<void> {
    try {
      await this.client.auth.signOut();
    } finally {
      this.session = null;
      this.emit('idle');
    }
  }

  /** Exposes the underlying client so hosts can reuse it for data access. */
  get supabase(): SupabaseClient {
    return this.client;
  }

  private settle(session: Session | null, error: unknown): AuthResult {
    if (error) {
      const mapped = mapError(error);
      this.emit('error');
      return fail(mapped);
    }

    if (!session) {
      return fail(authError('unknown', 'The provider did not return a session.'));
    }

    this.session = mapSession(session);
    this.emit('authenticated');
    return ok(this.session);
  }

  private emit(state: AuthState): void {
    const change: AuthStateChange = { state, session: this.session };
    for (const listener of this.listeners) {
      listener(change);
    }
  }
}

export function mapSession(session: Session): AuthSession {
  const expiresAt = session.expires_at
    ? new Date(session.expires_at * 1000).toISOString()
    : new Date(Date.now() + 3_600_000).toISOString();

  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token ?? null,
    expiresAt,
    tokenType: session.token_type ?? 'bearer',
    user: mapUser(session.user),
    // Supabase is not registered in the multi-provider registry, so there is no provenance snapshot.
    provider: null,
  };
}

export function mapUser(user: User): AuthUser {
  const metadata = Object.fromEntries(
    Object.entries(user.user_metadata ?? {}).map(([key, value]) => [key, String(value ?? '')]),
  );

  return {
    id: user.id,
    email: user.email ?? null,
    phone: user.phone ?? null,
    emailConfirmedAt: user.email_confirmed_at ?? null,
    phoneConfirmedAt: user.phone_confirmed_at ?? null,
    displayName:
      metadata['display_name'] ||
      metadata['full_name'] ||
      metadata['name'] ||
      metadata['username'] ||
      null,
    metadata,
  };
}

/** Maps Supabase failures onto the AuthKit taxonomy. Server text is never forwarded. */
export function mapError(error: unknown): import('../contract/auth.models').AuthError {
  const candidate = error as { code?: string; status?: number; message?: string; name?: string };
  const status = typeof candidate.status === 'number' ? candidate.status : null;

  if (candidate.name === 'AuthRetryableFetchError' || candidate.name === 'TypeError') {
    return authError(
      'network_error',
      'Could not reach the authentication service. Try again.',
      status,
    );
  }

  const code = candidate.code ?? '';
  const mapping: Record<string, AuthErrorCode> = {
    invalid_credentials: 'invalid_credentials',
    invalid_grant: 'invalid_credentials',
    email_not_confirmed: 'email_not_confirmed',
    user_already_exists: 'user_already_exists',
    email_exists: 'user_already_exists',
    weak_password: 'weak_password',
    otp_expired: 'otp_expired',
    token_expired: 'otp_expired',
    invalid_otp: 'invalid_otp',
    otp_disabled: 'invalid_otp',
    over_request_rate_limit: 'rate_limited',
    over_email_send_rate_limit: 'rate_limited',
    over_sms_send_rate_limit: 'rate_limited',
    provider_disabled: 'provider_disabled',
    mfa_required: 'mfa_required',
    insufficient_aal: 'mfa_required',
    session_expired: 'session_expired',
    refresh_token_not_found: 'session_expired',
    refresh_token_already_used: 'session_expired',
  };

  const mapped: AuthErrorCode =
    mapping[code] ??
    (status === 400
      ? 'invalid_credentials'
      : status === 401
        ? 'session_expired'
        : status === 403
          ? 'provider_disabled'
          : status === 429
            ? 'rate_limited'
            : status && status >= 500
              ? 'network_error'
              : 'unknown');

  return authError(mapped, MESSAGE_FOR[mapped], status);
}

const MESSAGE_FOR: Record<AuthErrorCode, string> = {
  invalid_credentials: 'Invalid email or password.',
  email_not_confirmed: 'Please confirm your email address before signing in.',
  user_already_exists: 'An account with this email already exists.',
  weak_password: 'The password does not meet the minimum requirements.',
  otp_expired: 'This code has expired. Request a new one.',
  invalid_otp: 'Invalid code. Check the digits and try again.',
  rate_limited: 'Too many attempts. Wait a moment and try again.',
  provider_disabled: 'This sign-in method is not available.',
  mfa_required: 'A second factor is required to continue.',
  session_expired: 'Your session has expired. Please sign in again.',
  network_error: 'Could not reach the authentication service. Try again.',
  unknown: 'An unexpected error occurred.',
  provider_not_configured: 'That sign-in option is not available.',
  provider_ambiguous: 'Choose which account you want to use.',
  session_conflict: 'You are signed in to incompatible accounts.',
  provider_ref_malformed: 'That sign-in option is not available.',
};

function looksLikeServiceRoleKey(key: string): boolean {
  const parts = key.split('.');
  if (parts.length !== 3) {
    return false;
  }

  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = globalThis.atob?.(
      payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '='),
    );
    return !!decoded && decoded.includes('"service_role"');
  } catch {
    return false;
  }
}
