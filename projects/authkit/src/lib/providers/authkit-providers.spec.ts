import { TestBed } from '@angular/core/testing';
import { AUTH_PROVIDER } from '../core/auth-kit.options';
import { FakeAuthProvider } from '../testing/fake-auth.provider';
import { AuthKitProviders, resolveProvider, type AuthProviderCandidate } from './authkit-providers';

function descriptor(overrides: Partial<AuthProviderCandidate>): AuthProviderCandidate {
  return {
    id: 'clave',
    kind: 'clave',
    displayName: 'Cl@ve',
    description: null,
    iconUrl: null,
    methods: [],
    levels: ['substantial'],
    isPrimary: false,
    ...overrides,
  };
}

const CLAVE = descriptor({ id: 'clave', audience: 'clientes' });
const SUPABASE_CLIENTES = descriptor({
  id: 'supabase-clientes',
  kind: 'supabase',
  displayName: 'Supabase',
  isPrimary: true,
  audience: 'clientes',
});
const ENTRA = descriptor({
  id: 'entra-staff',
  kind: 'entra',
  displayName: 'Corporate',
  isPrimary: true,
  audience: 'intranet',
});
const SUPABASE_DEV = descriptor({
  id: 'supabase-dev',
  kind: 'supabase',
  displayName: 'Supabase dev',
  audience: 'intranet',
});

const REGISTRY = [ENTRA, SUPABASE_DEV, SUPABASE_CLIENTES, CLAVE];

describe('resolveProvider (spec-providers §3)', () => {
  it('rule 1: an explicit canonical ref wins over the audience primary', () => {
    const result = resolveProvider(REGISTRY, 'clientes/clave');

    expect(result.error).toBeNull();
    expect(result.provider?.id).toBe('clave');
  });

  it('rule 1: an explicit provider id wins', () => {
    expect(resolveProvider(REGISTRY, 'clave').provider?.id).toBe('clave');
  });

  it('rule 1: an explicit ref from another audience never crosses the boundary', () => {
    const result = resolveProvider(REGISTRY, 'intranet/entra-staff', 'clientes');

    expect(result.provider).toBeNull();
    expect(result.error?.code).toBe('provider_not_configured');
  });

  it('rule 2: the audience in scope wins', () => {
    expect(resolveProvider(REGISTRY, null, 'clientes').provider?.id).toBe('supabase-clientes');
    expect(resolveProvider(REGISTRY, null, 'intranet').provider?.id).toBe('entra-staff');
  });

  it('rule 3: the audience primary wins when no audience is in scope', () => {
    expect(resolveProvider([CLAVE, SUPABASE_CLIENTES]).provider?.id).toBe('supabase-clientes');
  });

  it('rule 4: a single provider in the audience wins without a primary', () => {
    const result = resolveProvider([CLAVE, ENTRA], null, 'clientes');

    expect(result.error).toBeNull();
    expect(result.provider?.id).toBe('clave');
  });

  it('rule 5: two providers with no primary are ambiguous, never first-registered', () => {
    const a = descriptor({ id: 'clave', audience: 'clientes' });
    const b = descriptor({ id: 'certificate', kind: 'certificate', audience: 'clientes' });
    const first = resolveProvider([a, b], null, 'clientes');
    const reversed = resolveProvider([b, a], null, 'clientes');

    expect(first.provider).toBeNull();
    expect(first.error?.code).toBe('provider_ambiguous');
    expect(reversed.provider).toBeNull();
    expect(reversed.error?.code).toBe('provider_ambiguous');
    expect(first.error?.message).toContain('clientes/clave');
    expect(first.error?.message).toContain('clientes/certificate');
  });

  it('rule 5: two primaries are ambiguous instead of picking one', () => {
    const result = resolveProvider([
      descriptor({ id: 'a', isPrimary: true, audience: 'clientes' }),
      descriptor({ id: 'b', isPrimary: true, audience: 'clientes' }),
    ]);

    expect(result.provider).toBeNull();
    expect(result.error?.code).toBe('provider_ambiguous');
  });

  it('rule 6: resolution never crosses an audience boundary', () => {
    const result = resolveProvider([ENTRA, SUPABASE_DEV], null, 'clientes');

    expect(result.provider).toBeNull();
    expect(result.error?.code).toBe('provider_not_configured');
  });

  it('never resolves by kind, even when two providers share one', () => {
    const result = resolveProvider([
      descriptor({ id: 'supabase-a', kind: 'supabase', audience: 'clientes' }),
      descriptor({ id: 'supabase-b', kind: 'supabase', audience: 'clientes' }),
    ]);

    expect(result.provider).toBeNull();
    expect(result.error?.code).toBe('provider_ambiguous');
  });

  it('reports an unknown ref as not configured', () => {
    const result = resolveProvider(REGISTRY, 'clientes/nope');

    expect(result.provider).toBeNull();
    expect(result.error?.code).toBe('provider_not_configured');
  });

  it('rejects a malformed ref', () => {
    expect(resolveProvider(REGISTRY, 'clientes/clave/extra').error?.code).toBe(
      'provider_ref_malformed',
    );
  });

  it('reports an empty registry', () => {
    expect(resolveProvider([], null, 'clientes').error?.code).toBe('provider_not_configured');
  });

  it('treats untagged descriptors as already scoped by the caller', () => {
    const untagged = [
      descriptor({ id: 'clave', displayName: 'Cl@ve' }),
      descriptor({ id: 'certificate', displayName: 'Certificate', isPrimary: true }),
    ];

    expect(resolveProvider(untagged, null, 'clientes').provider?.id).toBe('certificate');
  });
});

describe('AuthKitProviders', () => {
  it('exposes the provider descriptors as a signal', () => {
    const provider = new FakeAuthProvider();
    provider.capabilities = { ...provider.capabilities, federation: [CLAVE] };

    TestBed.configureTestingModule({
      providers: [{ provide: AUTH_PROVIDER, useValue: provider }],
    });

    const registry = TestBed.inject(AuthKitProviders);

    expect(registry.authKitProviders()).toEqual([CLAVE]);
    expect(registry.resolve('clave').provider?.id).toBe('clave');
  });

  it('degrades to an empty registry when no provider is configured', () => {
    TestBed.configureTestingModule({ providers: [] });

    expect(TestBed.inject(AuthKitProviders).authKitProviders()).toEqual([]);
  });
});
