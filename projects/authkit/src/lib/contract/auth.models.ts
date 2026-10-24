/**
 * Normative AuthKit contract, mirrored from contracts/authkit.contract.json.
 * The .NET SDK exposes the same shapes; contract.spec.ts fails when they drift.
 */

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'user_already_exists'
  | 'weak_password'
  | 'otp_expired'
  | 'invalid_otp'
  | 'rate_limited'
  | 'provider_disabled'
  | 'mfa_required'
  | 'session_expired'
  | 'network_error'
  | 'unknown'
  | 'provider_not_configured'
  | 'provider_ambiguous'
  | 'session_conflict'
  | 'provider_ref_malformed';

export type AuthState =
  | 'idle'
  | 'submitting'
  | 'awaiting_email_confirmation'
  | 'awaiting_otp'
  | 'redirecting'
  | 'authenticated'
  | 'error';




/** Immutable provenance written onto a session at issue time. */
export interface AuthProviderSnapshot {
  readonly ref: string;
  readonly audience: string;
  readonly providerId: string;
  readonly kind: string;
  readonly displayName: string;
  readonly origin: string;
  readonly tenant: string | null;
  /** ISO-8601 instant. */
  readonly capturedAt: string;
}

export type AuthNextStep = 'none' | 'confirm_email' | 'verify_otp' | 'mfa';

export type AuthMessageKey =
  | 'signIn'
  | 'signUp'
  | 'email'
  | 'password'
  | 'confirmPassword'
  | 'forgotPassword'
  | 'dontHaveAccount'
  | 'haveAccount'
  | 'sendResetEmail'
  | 'resetEmailSent'
  | 'backToSignIn'
  | 'magicLink'
  | 'checkYourEmail'
  | 'signingIn'
  | 'continueWithProvider'
  | 'requiredField'
  | 'invalidEmail'
  | 'passwordTooShort'
  | 'passwordMismatch'
  | 'invalidOtp'
  | 'enterOtp'
  | 'verify'
  | 'newPassword'
  | 'updatePassword'
  | 'passwordUpdated'
  | 'showPassword'
  | 'hidePassword'
  | 'unexpectedError'
  | 'sessionExpired';

export interface AuthUser {
  readonly id: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly emailConfirmedAt: string | null;
  readonly phoneConfirmedAt: string | null;
  readonly displayName: string | null;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface AuthSession {
  readonly accessToken: string;
  readonly refreshToken: string | null;
  /** ISO-8601 instant. */
  readonly expiresAt: string;
  readonly tokenType: string;
  readonly user: AuthUser;
  readonly provider: AuthProviderSnapshot | null;
}

export interface AuthError {
  readonly code: AuthErrorCode;
  readonly message: string;
  readonly statusCode: number | null;
}

export interface AuthResult {
  readonly ok: boolean;
  readonly session: AuthSession | null;
  readonly error: AuthError | null;
  readonly nextStep: AuthNextStep;
}

export interface AuthCapabilities {
  readonly password: boolean;
  readonly signUp: boolean;
  readonly magicLink: boolean;
  readonly emailOtp: boolean;
  readonly phoneOtp: boolean;
  readonly passwordRecovery: boolean;
  readonly mfa: boolean;
  readonly socialProviders: readonly string[];
}

export interface AuthTheme {
  readonly primary: string;
  readonly background: string;
  readonly surface: string;
  readonly text: string;
  readonly textMuted: string;
  readonly border: string;
  readonly danger: string;
  readonly radius: string;
  readonly spacing: string;
  readonly fontFamily: string;
  readonly logoUrl: string | null;
}

export const DEFAULT_AUTH_THEME: AuthTheme = {
  primary: '#4f46e5',
  background: '#ffffff',
  surface: '#ffffff',
  text: '#111827',
  textMuted: '#6b7280',
  border: '#d1d5db',
  danger: '#dc2626',
  radius: '8px',
  spacing: '16px',
  fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  logoUrl: null,
};

/** Runtime description consumed by the contract parity test. */
export const AUTHKIT_CONTRACT = {
  contractVersion: '2.0.0',
  types: {
    AuthUser: [
      'id',
      'email',
      'phone',
      'emailConfirmedAt',
      'phoneConfirmedAt',
      'displayName',
      'metadata',
    ],
    AuthSession: ['accessToken', 'refreshToken', 'expiresAt', 'tokenType', 'user', 'provider'],
    AuthProviderSnapshot: [
      'ref',
      'audience',
      'providerId',
      'kind',
      'displayName',
      'origin',
      'tenant',
      'capturedAt',
    ],
    AuthProviderRef: ['audience', 'providerId'],
    AuthError: ['code', 'message', 'statusCode'],
    AuthResult: ['ok', 'session', 'error', 'nextStep'],
    AuthCapabilities: [
      'password',
      'signUp',
      'magicLink',
      'emailOtp',
      'phoneOtp',
      'passwordRecovery',
      'mfa',
      'socialProviders',
    ],
    AuthTheme: [
      'primary',
      'background',
      'surface',
      'text',
      'textMuted',
      'border',
      'danger',
      'radius',
      'spacing',
      'fontFamily',
      'logoUrl',
    ],
  },
  errorCodes: [
    'invalid_credentials',
    'email_not_confirmed',
    'user_already_exists',
    'weak_password',
    'otp_expired',
    'invalid_otp',
    'rate_limited',
    'provider_disabled',
    'mfa_required',
    'session_expired',
    'network_error',
    'unknown',
    'provider_not_configured',
    'provider_ambiguous',
    'session_conflict',
    'provider_ref_malformed',
  ] as readonly AuthErrorCode[],
  states: [
    'idle',
    'submitting',
    'awaiting_email_confirmation',
    'awaiting_otp',
    'redirecting',
    'authenticated',
    'error',
  ] as readonly AuthState[],
  nextSteps: ['none', 'confirm_email', 'verify_otp', 'mfa'] as readonly AuthNextStep[],
  messageKeys: [
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
  ] as readonly AuthMessageKey[],
  operations: [
    'signInWithPassword',
    'signUpWithPassword',
    'sendMagicLink',
    'sendPasswordReset',
    'updatePassword',
    'sendEmailOtp',
    'verifyEmailOtp',
    'sendPhoneOtp',
    'verifyPhoneOtp',
    'beginOAuth',
    'completeOAuth',
    'refreshSession',
    'signOut',
  ],
} as const;

export const ok = (session: AuthSession): AuthResult => ({
  ok: true,
  session,
  error: null,
  nextStep: 'none',
});

export const next = (nextStep: AuthNextStep): AuthResult => ({
  ok: true,
  session: null,
  error: null,
  nextStep,
});

export const fail = (error: AuthError): AuthResult => ({
  ok: false,
  session: null,
  error,
  nextStep: 'none',
});

export const authError = (
  code: AuthErrorCode,
  message: string,
  statusCode: number | null = null,
): AuthError => ({ code, message, statusCode });
