import { Injectable, computed, inject, signal } from '@angular/core';
import type { AuthResult, AuthSession } from '../contract/auth.models';
import type { InitializableAuthProvider } from '../contract/auth.provider';
import { AUTH_PROVIDER, AUTHKIT_OPTIONS } from './auth-kit.options';

/** Reactive facade over the configured provider. Holds no tokens of its own. */
@Injectable({ providedIn: 'root' })
export class AuthKitService {
  private readonly provider = inject(AUTH_PROVIDER);
  private readonly options = inject(AUTHKIT_OPTIONS);
  private readonly state = signal<AuthSession | null>(this.provider.currentSession);
  private readonly unsubscribe: () => void;

  /** Current session, or null when signed out. */
  readonly session = this.state.asReadonly();

  readonly isAuthenticated = computed(() => this.state() !== null);
  readonly email = computed(() => this.state()?.user.email ?? null);
  readonly userId = computed(() => this.state()?.user.id ?? null);

  constructor() {
    this.unsubscribe = this.provider.onStateChange(({ session }) => this.state.set(session));
  }

  /** Restores a persisted session. Call once during app bootstrap. */
  async initialize(): Promise<AuthResult> {
    const provider = this.provider as Partial<InitializableAuthProvider>;
    if (typeof provider.initialize === 'function') {
      const result = await provider.initialize();
      this.state.set(this.provider.currentSession);
      return result;
    }

    return { ok: true, session: this.provider.currentSession, error: null, nextStep: 'none' };
  }

  refresh(): Promise<AuthResult> {
    return this.provider.refreshSession();
  }

  async signOut(): Promise<void> {
    await this.provider.signOut();
    this.state.set(null);
  }

  /** The provider, for callers that need capabilities or provider-specific APIs. */
  get providerRef(): typeof this.provider {
    return this.provider;
  }

  /** Redirect URL configured for this application. */
  get redirectTo(): string | null {
    return this.options.redirectTo;
  }

  /** Cleans up the provider subscription. Useful in tests and in scoped injectors. */
  dispose(): void {
    this.unsubscribe();
  }
}
