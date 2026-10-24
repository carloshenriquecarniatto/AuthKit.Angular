import {
  fail,
  next,
  ok,
  type AuthCapabilities,
  type AuthResult,
  type AuthSession,
  type AuthState,
  type AuthUser,
} from '../contract/auth.models';
import type { AuthProvider, AuthStateChange } from '../contract/auth.provider';

/** Deterministic provider used by the component tests. */
export class FakeAuthProvider implements AuthProvider {
  capabilities: AuthCapabilities = {
    password: true,
    signUp: true,
    magicLink: true,
    emailOtp: true,
    phoneOtp: true,
    passwordRecovery: true,
    mfa: true,
    socialProviders: ['google', 'github'],
  };

  signInResult: AuthResult = ok(session());
  signUpResult: AuthResult = next('confirm_email');
  authorizationUrl = 'https://project.supabase.co/auth/v1/authorize?provider=google';

  lastEmail: string | null = null;
  magicLinkCalls = 0;
  currentSession: AuthSession | null = null;

  private readonly listeners = new Set<(change: AuthStateChange) => void>();

  onStateChange(listener: (change: AuthStateChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async signInWithPassword(email: string, _password: string): Promise<AuthResult> {
    this.lastEmail = email;
    this.currentSession = this.signInResult.session;
    this.emit('authenticated');
    return this.signInResult;
  }

  async signUpWithPassword(email: string, _password: string): Promise<AuthResult> {
    this.lastEmail = email;
    return this.signUpResult;
  }

  async sendMagicLink(): Promise<AuthResult> {
    this.magicLinkCalls++;
    return next('confirm_email');
  }

  async sendPasswordReset(): Promise<AuthResult> {
    return next('confirm_email');
  }

  async updatePassword(): Promise<AuthResult> {
    return next('none');
  }

  async sendEmailOtp(): Promise<AuthResult> {
    return next('verify_otp');
  }

  async verifyEmailOtp(): Promise<AuthResult> {
    return this.signInResult;
  }

  async sendPhoneOtp(): Promise<AuthResult> {
    return next('verify_otp');
  }

  async verifyPhoneOtp(): Promise<AuthResult> {
    return this.signInResult;
  }

  async beginOAuth(): Promise<string> {
    return this.authorizationUrl;
  }

  async completeOAuth(): Promise<AuthResult> {
    return this.signInResult;
  }

  async refreshSession(): Promise<AuthResult> {
    return this.signInResult;
  }

  async signOut(): Promise<void> {
    this.currentSession = null;
    this.emit('idle');
  }

  failNextWith(code: Parameters<typeof fail>[0]['code']): void {
    this.signInResult = fail({ code, message: 'Invalid email or password.', statusCode: 400 });
  }

  private emit(state: AuthState): void {
    for (const listener of this.listeners) {
      listener({ state, session: this.currentSession });
    }
  }
}

export function session(): AuthSession {
  return {
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    tokenType: 'bearer',
    user: user(),
    provider: null,
  };
}

export function user(): AuthUser {
  return {
    id: 'user-1',
    email: 'ada@example.com',
    phone: null,
    emailConfirmedAt: new Date().toISOString(),
    phoneConfirmedAt: null,
    displayName: 'Ada Lovelace',
    metadata: { plan: 'pro' },
  };
}
