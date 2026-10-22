import type {
  AuthFederationMethod,
  AuthFederationProvider,
  AuthState,
} from '../contract/auth.models';
import {
  ClaveAuthProvider,
  buildClaveLoginUrl,
  inspectFederationCallback,
} from './clave-auth.provider';
import type { AuthFederationOptions } from './clave.models';

const MOVIL: AuthFederationMethod = {
  id: 'clave_movil',
  displayName: 'Cl@ve Móvil',
  description: 'Approve the request on your phone',
  levels: ['substantial', 'high'],
  recommended: true,
};

const PIN: AuthFederationMethod = {
  id: 'clave_pin',
  displayName: 'Cl@ve PIN',
  description: null,
  levels: ['substantial'],
  recommended: false,
};

const DESCRIPTOR: AuthFederationProvider = {
  id: 'clave',
  kind: 'clave',
  displayName: 'Cl@ve',
  description: 'Spanish eIDAS identity',
  iconUrl: null,
  methods: [MOVIL, PIN],
  levels: ['substantial', 'high'],
  isPrimary: true,
};

function config(overrides: Partial<AuthFederationOptions> = {}): AuthFederationOptions {
  return {
    baseUrl: 'https://sede.example.es',
    loginPath: '/clave/login',
    audience: 'clientes',
    providerRef: 'clientes/clave',
    providers: [DESCRIPTOR],
    returnUrl: '/inicio',
    ...overrides,
  };
}

describe('ClaveAuthProvider', () => {
  it('declares federation only', () => {
    const capabilities = new ClaveAuthProvider(config()).capabilities;

    expect(capabilities.federation).toEqual([DESCRIPTOR]);
    expect(capabilities.password).toBe(false);
    expect(capabilities.signUp).toBe(false);
    expect(capabilities.magicLink).toBe(false);
    expect(capabilities.emailOtp).toBe(false);
    expect(capabilities.phoneOtp).toBe(false);
    expect(capabilities.passwordRecovery).toBe(false);
    expect(capabilities.mfa).toBe(false);
    expect(capabilities.socialProviders).toEqual([]);
  });

  it('never holds a session and never calls the network on refresh', async () => {
    const provider = new ClaveAuthProvider(config());
    const fetchSpy = vi.fn(() => Promise.reject(new Error('network is forbidden in tests')));
    vi.stubGlobal('fetch', fetchSpy);

    try {
      expect(provider.currentSession).toBeNull();

      const refreshed = await provider.refreshSession();

      expect(refreshed.ok).toBe(true);
      expect(refreshed.session).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('builds the host login URL from the config', async () => {
    const provider = new ClaveAuthProvider(config());
    const url = new URL(
      await provider.beginFederation({
        level: 'high',
        method: 'clave_movil',
        returnUrl: '/expedientes',
      }),
    );

    expect(url.origin).toBe('https://sede.example.es');
    expect(url.pathname).toBe('/clave/login');
    expect(url.searchParams.get('loa')).toBe('high');
    expect(url.searchParams.get('method')).toBe('clave_movil');
    expect(url.searchParams.get('returnUrl')).toBe('/expedientes');
  });

  it('defaults the level to substantial and the returnUrl to the configuration', async () => {
    const provider = new ClaveAuthProvider(config());

    expect(await provider.beginFederation({ method: 'clave_pin' })).toBe(
      'https://sede.example.es/clave/login?loa=substantial&method=clave_pin&returnUrl=%2Finicio',
    );
  });

  it('reports redirecting, error and idle through onStateChange', async () => {
    const provider = new ClaveAuthProvider(config());
    const states: AuthState[] = [];
    provider.onStateChange((change) => states.push(change.state));

    await provider.beginFederation({});
    await provider.completeFederation('https://sede.example.es/cb?error=access_denied');
    await provider.signOut();

    expect(states).toEqual(['redirecting', 'error', 'idle']);
  });

  it('maps a cancelled login without echoing the raw reason', async () => {
    const provider = new ClaveAuthProvider(config());
    const result = await provider.completeFederation(
      'https://sede.example.es/clave/callback?error=access_denied&error_reason=user_cancelled',
    );

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('federation_cancelled');
    expect(result.error?.message).not.toContain('access_denied');
    expect(result.error?.message).not.toContain('user_cancelled');
    expect(result.session).toBeNull();
  });

  it('maps assurance failures and hides unknown internal reasons', async () => {
    const provider = new ClaveAuthProvider(config());

    expect((await provider.completeFederation('/cb?error=loa_not_met')).error?.code).toBe(
      'loa_not_met',
    );

    const unknown = await provider.completeFederation(
      '/cb?error=signature_invalid&error_reason=the+assertion+did+not+verify',
    );

    expect(unknown.error?.code).toBe('federation_failed');
    expect(unknown.error?.message).not.toContain('signature');
    expect(unknown.error?.message).not.toContain('assertion');
  });

  it('succeeds with no session when the host reports no error', async () => {
    const provider = new ClaveAuthProvider(config());
    const result = await provider.completeOAuth('https://sede.example.es/cb?returnUrl=%2Finicio');

    expect(result.ok).toBe(true);
    expect(result.session).toBeNull();
    expect(result.error).toBeNull();
  });

  it('strips only the federation parameters from the clean URL', () => {
    const outcome = inspectFederationCallback(
      'https://sede.example.es/clave/callback?keep=1&error=federation_failed&error_reason=x&returnUrl=%2Fexpedientes',
    );

    expect(outcome.cleanUrl).toBe(
      'https://sede.example.es/clave/callback?keep=1&returnUrl=%2Fexpedientes',
    );
    expect(outcome.returnUrl).toBe('/expedientes');
    expect(outcome.ok).toBe(false);
  });

  it('treats an empty callback as a federation failure', async () => {
    const provider = new ClaveAuthProvider(config());

    expect((await provider.completeFederation('   ')).error?.code).toBe('federation_failed');
  });

  it('does not perform a token exchange on the callback', async () => {
    const provider = new ClaveAuthProvider(config());
    const fetchSpy = vi.fn(() => Promise.reject(new Error('network is forbidden in tests')));
    vi.stubGlobal('fetch', fetchSpy);

    try {
      await provider.completeFederation('https://sede.example.es/cb?code=would-be-a-token');
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('rejects every flow that is not a federation with provider_disabled', async () => {
    const provider = new ClaveAuthProvider(config());

    const results = await Promise.all([
      provider.signInWithPassword('ada@example.com', 'secret'),
      provider.signUpWithPassword('ada@example.com', 'secret'),
      provider.sendMagicLink('ada@example.com'),
      provider.sendPasswordReset('ada@example.com'),
      provider.updatePassword('secret'),
      provider.sendEmailOtp('ada@example.com'),
      provider.verifyEmailOtp('ada@example.com', '123456'),
      provider.sendPhoneOtp('+34600000000'),
      provider.verifyPhoneOtp('+34600000000', '123456'),
    ]);

    for (const result of results) {
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('provider_disabled');
    }

    const password = await provider.signInWithPassword('ada@example.com', 'secret');
    expect(password.error?.message).toContain('not a password provider');
  });

  it('refuses to be used as a social provider', async () => {
    const provider = new ClaveAuthProvider(config());

    await expect(provider.beginOAuth('clave')).rejects.toThrow(/not an OAuth provider/);
  });

  it('builds URLs that keep an existing query string', () => {
    expect(
      buildClaveLoginUrl({
        loginPath: '/clave/login?tenant=caib',
        level: 'high',
        method: 'clave_movil',
      }),
    ).toBe('/clave/login?tenant=caib&loa=high&method=clave_movil');
  });

  it('rejects a configuration without a login path', () => {
    expect(() => new ClaveAuthProvider(config({ loginPath: '  ' }))).toThrowError(/loginPath/);
  });
});
