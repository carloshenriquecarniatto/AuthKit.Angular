import { TestBed } from '@angular/core/testing';
import {
  UrlTree,
  provideRouter,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
} from '@angular/router';
import { DEFAULT_AUTH_THEME } from '../contract/auth.models';
import type { AuthAssuranceLevel, AuthIdentity, AuthSession } from '../contract/auth.models';
import { ENGLISH_AUTH_MESSAGES } from '../contract/auth.messages';
import {
  AUTH_PROVIDER,
  AUTHKIT_OPTIONS,
  DEFAULT_LOGIN_ROUTE,
  type AuthKitOptions,
} from '../core/auth-kit.options';
import { FakeAuthProvider, session } from '../testing/fake-auth.provider';
import { authKitGuard, meetsAssuranceLevel, readRequirement } from './authkit.guard';

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

function identity(level: AuthAssuranceLevel): AuthIdentity {
  return {
    subject: 'opaque-subject',
    documentType: 'dni',
    documentId: '12345678Z',
    documentIdRaw: 'ES/ES/12345678Z',
    givenName: 'Ada',
    familyName: 'Lovelace',
    dateOfBirth: null,
    level,
    method: 'clave_movil',
    tenant: 'caib',
    representedDocumentId: null,
    authenticatedAt: new Date().toISOString(),
  };
}

function federatedSession(level: AuthAssuranceLevel, audience = 'clientes'): AuthSession {
  const base = session();

  return {
    ...base,
    user: { ...base.user, identity: identity(level) },
    provider: {
      ref: `${audience}/clave`,
      audience,
      providerId: 'clave',
      kind: 'clave',
      displayName: 'Cl@ve',
      origin: 'self_hosted',
      tenant: 'caib',
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
    provider.currentSession = federatedSession('substantial');
    setup(provider);

    expect(run()).toBe(true);
  });

  it('returns a UrlTree when the granted level is below the requirement', () => {
    const provider = new FakeAuthProvider();
    provider.currentSession = federatedSession('substantial');
    setup(provider);

    const result = run({ authKit: { loa: 'high' } });

    expect(result instanceof UrlTree).toBe(true);
  });

  it('lets a high level through a high requirement', () => {
    const provider = new FakeAuthProvider();
    provider.currentSession = federatedSession('high');
    setup(provider);

    expect(run({ authKit: { loa: 'high' } })).toBe(true);
  });

  it('fails closed when a level is required and the session carries none', () => {
    const provider = new FakeAuthProvider();
    provider.currentSession = session();
    setup(provider);

    expect(run({ authKit: { loa: 'low' } }) instanceof UrlTree).toBe(true);
  });

  it('checks the provider audience', () => {
    const provider = new FakeAuthProvider();
    provider.currentSession = federatedSession('high', 'clientes');
    setup(provider);

    expect(run({ authKit: { audience: 'clientes' } })).toBe(true);
    expect(run({ authKit: { audience: 'intranet' } }) instanceof UrlTree).toBe(true);
  });

  it('fails closed when an audience is required and the session has no provider', () => {
    const provider = new FakeAuthProvider();
    provider.currentSession = session();
    setup(provider);

    expect(run({ authKit: { audience: 'clientes' } }) instanceof UrlTree).toBe(true);
  });

  it('honours the configured login route', () => {
    setup(new FakeAuthProvider(), options({ loginRoute: '/entrar' }));
    const result = run({ authKit: { loa: 'high' } });

    expect((result as UrlTree).toString()).toBe('/entrar');
  });

  it('ignores malformed route data instead of granting a level', () => {
    const provider = new FakeAuthProvider();
    provider.currentSession = federatedSession('low');
    setup(provider);

    expect(readRequirement({ authKit: 'high' })).toEqual({ loa: null, audience: null });
    expect(readRequirement({ authKit: { loa: 'ultra' } })).toEqual({
      loa: null,
      audience: null,
    });
    expect(readRequirement({})).toEqual({ loa: null, audience: null });
  });
});

describe('meetsAssuranceLevel', () => {
  it('orders low < substantial < high', () => {
    expect(meetsAssuranceLevel('high', 'substantial')).toBe(true);
    expect(meetsAssuranceLevel('substantial', 'high')).toBe(false);
    expect(meetsAssuranceLevel('low', 'low')).toBe(true);
  });

  it('treats a missing requirement as satisfied and a missing level as a failure', () => {
    expect(meetsAssuranceLevel(null, null)).toBe(true);
    expect(meetsAssuranceLevel('low', null)).toBe(true);
    expect(meetsAssuranceLevel(null, 'low')).toBe(false);
  });
});
