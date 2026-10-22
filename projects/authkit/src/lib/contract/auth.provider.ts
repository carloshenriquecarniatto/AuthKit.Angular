import type { AuthCapabilities, AuthResult, AuthSession, AuthState } from './auth.models';

/** Payload emitted whenever the session or auth state changes. */
export interface AuthStateChange {
  readonly state: AuthState;
  readonly session: AuthSession | null;
}

/**
 * The single abstraction every AuthKit Angular component binds to.
 * Implementations never navigate, never render, and never log token material.
 */
export interface AuthProvider {
  readonly capabilities: AuthCapabilities;
  readonly currentSession: AuthSession | null;

  /** Subscribes to state changes. Returns an unsubscribe function. */
  onStateChange(listener: (change: AuthStateChange) => void): () => void;

  signInWithPassword(email: string, password: string): Promise<AuthResult>;
  signUpWithPassword(
    email: string,
    password: string,
    metadata?: Readonly<Record<string, string>>,
  ): Promise<AuthResult>;
  sendMagicLink(email: string, redirectTo?: string): Promise<AuthResult>;
  sendPasswordReset(email: string, redirectTo?: string): Promise<AuthResult>;
  updatePassword(newPassword: string): Promise<AuthResult>;
  sendEmailOtp(email: string): Promise<AuthResult>;
  verifyEmailOtp(email: string, token: string): Promise<AuthResult>;
  sendPhoneOtp(phone: string): Promise<AuthResult>;
  verifyPhoneOtp(phone: string, token: string): Promise<AuthResult>;
  beginOAuth(provider: string, redirectTo?: string): Promise<string>;
  completeOAuth(callbackUrl: string): Promise<AuthResult>;
  refreshSession(): Promise<AuthResult>;
  signOut(): Promise<void>;
}

/** Persists a session between reloads. */
export interface AuthSessionStore {
  load(): Promise<AuthSession | null>;
  save(session: AuthSession): Promise<void>;
  clear(): Promise<void>;
}

/** Optional capability: a provider that must restore a persisted session. */
export interface InitializableAuthProvider extends AuthProvider {
  initialize(): Promise<AuthResult>;
}
