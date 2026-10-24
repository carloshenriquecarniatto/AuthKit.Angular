import { TestBed } from '@angular/core/testing';
import {
  UrlTree,
  provideRouter,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
} from '@angular/router';
import { DEFAULT_AUTH_THEME, type AuthSession } from '../contract/auth.models';
import { ENGLISH_AUTH_MESSAGES } from '../contract/auth.messages';
import {
  AUTH_PROVIDER,
  AUTHKIT_OPTIONS,
  DEFAULT_LOGIN_ROUTE,
  type AuthKitOptions,
} from '../core/auth-kit.options';
import { FakeAuthProvider, session } from '../testing/fake-auth.provider';
import { authKitGuard, readRequirement } from './authkit.guard';

function options(overrides: Partial<AuthKitOptions> = {}): AuthKitOptions {
  return {
    theme: DEFAULT_AUTH_THEME,
    messages: ENGLISH_AUTH_MESSAGES,
    redirectTo: null,
    minimumPasswordLength: 8,
    socialProviders: [],
    loginRoute: DEFAULT_LOGIN_ROUTE,
    ...overrides,
  };
}

function withAudience(audience: string): AuthSession {
  const base = session();

  return {
    ...base,
    provider: {
      ref: `${audience}/supabase`,
      audience,
      providerId: 'supabase',
      kind: 'supabase',
      displayName: 'Supabase',
      origin: 'cloud',
      tenant: null,
      capturedAt: new Date().toISOString(),
    },
  };
}

function snapshot(data: Record<string, unknown> = {}): ActivatedRouteSnapshot {
  return { data } as unknown as ActivatedRouteSnapshot;
}

const state = {} as RouterStateSnapshot;

function run(data: Record<string, unknown> = {}): unknown {
  return TestBed.runInInjectionContext(() => authKitGuard(snapshot(data), state));
}

function setup(provider: FakeAuthProvider, ui: AuthKitOptions = options()): void {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AUTH_PROVIDER, useValue: provider },
      { provide: AUTHKIT_OPTIONS, useValue: ui },
    ],
  });
}

describe('authKitGuard', () => {
  it('returns a UrlTree to the login route when there is no session', () => {
    setup(new FakeAuthProvider());
    const result = run();

    expect(result instanceof UrlTree).toBe(true);
    expect((result as UrlTree).toString()).toBe('/login');
  });

  it('lets an authenticated session through when the route asks for nothing', () => {
    const provider = new FakeAuthProvider();
    provider.currentSession = session();
    setup(provider);

    expect(run()).toBe(true);
  });

  it('checks the provider audience', () => {
    const provider = new FakeAuthProvider();
    provider.currentSession = withAudience('clients');
    setup(provider);

    expect(run({ authKit: { audience: 'clients' } })).toBe(true);
    expect(run({ authKit: { audience: 'intranet' } }) instanceof UrlTree).toBe(true);
  });

  it('fails closed when an audience is required and the session has no provider', () => {
    const provider = new FakeAuthProvider();
    provider.currentSession = session();
    setup(provider);

    expect(run({ authKit: { audience: 'clients' } }) instanceof UrlTree).toBe(true);
  });

  it('honours the configured login route', () => {
    setup(new FakeAuthProvider(), options({ loginRoute: '/entrar' }));
    const result = run();

    expect((result as UrlTree).toString()).toBe('/entrar');
  });

  it('ignores malformed route data instead of granting access', () => {
    expect(readRequirement({ authKit: 'clients' })).toEqual({ audience: null });
    expect(readRequirement({ authKit: { audience: 42 } })).toEqual({ audience: null });
    expect(readRequirement({})).toEqual({ audience: null });
  });
});
