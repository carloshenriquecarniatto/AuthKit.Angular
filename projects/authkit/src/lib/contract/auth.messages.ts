import type { AuthMessageKey } from './auth.models';

/**
 * Port: resolves user-visible strings. Implement it, or use one of the bundled adapters
 * (DictionaryAuthMessages, JsonAuthMessages).
 */
export interface AuthMessages {
  get(key: AuthMessageKey, provider?: string): string;
}

/** Keys known to the contract, used to reject typos in a JSON bundle. */
const KNOWN_KEYS = new Set<string>([
  'signIn',
  'signUp',
  'email',
  'password',
  'confirmPassword',
  'forgotPassword',
  'dontHaveAccount',
  'haveAccount',
  'sendResetEmail',
  'resetEmailSent',
  'backToSignIn',
  'magicLink',
  'checkYourEmail',
  'signingIn',
  'continueWithProvider',
  'requiredField',
  'invalidEmail',
  'passwordTooShort',
  'passwordMismatch',
  'invalidOtp',
  'enterOtp',
  'verify',
  'newPassword',
  'updatePassword',
  'passwordUpdated',
  'showPassword',
  'hidePassword',
  'unexpectedError',
  'sessionExpired',
]);

export const ENGLISH_STRINGS: Readonly<Record<AuthMessageKey, string>> = {
  signIn: 'Sign In',
  signUp: 'Sign Up',
  email: 'Enter your email',
  password: 'Enter your password',
  confirmPassword: 'Confirm Password',
  forgotPassword: 'Forgot your password?',
  dontHaveAccount: "Don't have an account? Sign up",
  haveAccount: 'Already have an account? Sign in',
  sendResetEmail: 'Send password reset email',
  resetEmailSent: 'Password reset email has been sent',
  backToSignIn: 'Back to sign in',
  magicLink: 'Continue with magic link',
  checkYourEmail: 'Check your email inbox!',
  signingIn: 'Signing you in',
  continueWithProvider: 'Continue with {provider}',
  requiredField: 'This field is required',
  invalidEmail: 'Please enter a valid email address',
  passwordTooShort: 'Please enter a password that is at least {min} characters long',
  passwordMismatch: 'Passwords do not match',
  invalidOtp: 'Invalid OTP code',
  enterOtp: 'Enter the code sent',
  verify: 'Verify',
  newPassword: 'Enter new password',
  updatePassword: 'Update Password',
  passwordUpdated: 'Password successfully updated',
  showPassword: 'Show',
  hidePassword: 'Hide',
  unexpectedError: 'An unexpected error occurred',
  sessionExpired: 'Your session has expired. Please sign in again.',
};

/**
 * Adapter: an in-memory dictionary with an optional fallback for missing keys.
 * The default and the fastest option; it never touches the network.
 */
export class DictionaryAuthMessages implements AuthMessages {
  constructor(
    private readonly strings: Partial<Record<AuthMessageKey, string>>,
    private readonly fallback: AuthMessages | null = null,
  ) {}

  get(key: AuthMessageKey, provider?: string): string {
    const text = this.strings[key] ?? this.fallback?.get(key) ?? key;
    return provider ? text.replace('{provider}', provider) : text;
  }
}

/** English messages, matching the wording used by supabase_auth_ui. */
export const ENGLISH_AUTH_MESSAGES: AuthMessages = new DictionaryAuthMessages(ENGLISH_STRINGS);

/** Largest accepted bundle. A message catalog is a few kilobytes. */
export const MAXIMUM_MESSAGES_BYTES = 1024 * 1024;

/**
 * Adapter: a catalog decoded from a JSON object such as `{ "signIn": "Entrar" }`.
 * Keys are matched case-insensitively; unknown keys are ignored and missing keys fall back.
 */
export class JsonAuthMessages extends DictionaryAuthMessages {
  constructor(json: string, fallback: AuthMessages = ENGLISH_AUTH_MESSAGES) {
    super(parseMessages(json), fallback);
  }
}

/** Decodes a JSON bundle into typed strings. Exposed for tooling and tests. */
export function parseMessages(json: string): Partial<Record<AuthMessageKey, string>> {
  if (!json || json.length > MAXIMUM_MESSAGES_BYTES) {
    throw new Error('AuthKit: the message catalog is empty or larger than 1 MB.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('AuthKit: the message catalog is not valid JSON.');
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('AuthKit: the message catalog must be a JSON object.');
  }

  const result: Partial<Record<AuthMessageKey, string>> = {};
  const byLowerCase = new Map([...KNOWN_KEYS].map((key) => [key.toLowerCase(), key]));

  for (const [rawKey, value] of Object.entries(parsed as Record<string, unknown>)) {
    const key = byLowerCase.get(rawKey.toLowerCase());
    if (key && typeof value === 'string') {
      result[key as AuthMessageKey] = value;
    }
  }

  return result;
}

/**
 * Port for loading a catalog from somewhere: memory, the bundle, an API, a feature flag service.
 * Implement it to plug your own localization backend.
 */
export interface AuthMessagesSource {
  load(): Promise<AuthMessages>;
}

/** Adapter: loads a catalog from a URL (app bundle asset, CDN or your own API). */
export class HttpAuthMessagesSource implements AuthMessagesSource {
  constructor(
    private readonly url: string,
    private readonly fallback: AuthMessages = ENGLISH_AUTH_MESSAGES,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  async load(): Promise<AuthMessages> {
    const response = await this.fetchImpl(this.url, { credentials: 'same-origin' });

    if (!response.ok) {
      throw new Error(
        `AuthKit: the message catalog at ${this.url} returned HTTP ${response.status}.`,
      );
    }

    const json = await response.text();
    return new JsonAuthMessages(json, this.fallback);
  }
}

/**
 * Adapter that starts with a fallback and swaps in the real catalog once loaded.
 * Components never block: the first paint uses the fallback, then the loaded strings.
 */
export class DeferredAuthMessages implements AuthMessages {
  private current: AuthMessages;
  private loading: Promise<AuthMessages> | null = null;

  constructor(
    private readonly source: AuthMessagesSource,
    private readonly fallback: AuthMessages = ENGLISH_AUTH_MESSAGES,
  ) {
    this.current = fallback;
  }

  /** Whether the real catalog has replaced the fallback. */
  get isLoaded(): boolean {
    return this.current !== this.fallback;
  }

  get(key: AuthMessageKey, provider?: string): string {
    return this.current.get(key, provider);
  }

  /** Loads the catalog once; concurrent callers share the same promise and a failure can retry. */
  ensureLoaded(): Promise<AuthMessages> {
    this.loading ??= this.source
      .load()
      .then((messages) => (this.current = messages))
      .catch((error: unknown) => {
        this.loading = null;
        throw error;
      });

    return this.loading;
  }
}

/** Convenience: loads a JSON catalog from a URL. */
export function loadAuthMessages(
  url: string,
  fallback: AuthMessages = ENGLISH_AUTH_MESSAGES,
): Promise<AuthMessages> {
  return new HttpAuthMessagesSource(url, fallback).load();
}

/** Interpolates placeholders used by validation messages. */
export function messageWith(text: string, values: Readonly<Record<string, string>>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, value),
    text,
  );
}
