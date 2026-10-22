import { createSupabaseClient, mapError, mapSession } from './supabase-auth.provider';
import type { Session } from '@supabase/supabase-js';

describe('Supabase provider mapping', () => {
  it('maps a Supabase session onto the AuthKit session', () => {
    const session = {
      access_token: 'access',
      refresh_token: 'refresh',
      expires_at: 1893456000,
      token_type: 'bearer',
      user: {
        id: 'user-1',
        email: 'ada@example.com',
        phone: null,
        email_confirmed_at: '2026-01-02T03:04:05Z',
        phone_confirmed_at: null,
        user_metadata: { display_name: 'Ada Lovelace', plan: 'pro' },
      },
    } as unknown as Session;

    const mapped = mapSession(session);

    expect(mapped.accessToken).toBe('access');
    expect(mapped.user.displayName).toBe('Ada Lovelace');
    expect(mapped.user.metadata['plan']).toBe('pro');
    expect(mapped.expiresAt).toBe(new Date(1893456000 * 1000).toISOString());
  });

  it('maps machine-readable error codes', () => {
    expect(mapError({ code: 'invalid_credentials', status: 400 }).code).toBe('invalid_credentials');
    expect(mapError({ code: 'email_not_confirmed', status: 400 }).code).toBe('email_not_confirmed');
    expect(mapError({ code: 'over_email_send_rate_limit', status: 429 }).code).toBe('rate_limited');
    expect(mapError({ code: 'mfa_required', status: 400 }).code).toBe('mfa_required');
  });

  it('falls back to status codes and never forwards server text', () => {
    const mapped = mapError({ status: 429, message: 'too many requests from 10.0.0.1' });

    expect(mapped.code).toBe('rate_limited');
    expect(mapped.message).not.toContain('10.0.0.1');
  });

  it('maps transport failures to network_error', () => {
    expect(mapError({ name: 'AuthRetryableFetchError', message: 'fetch failed' }).code).toBe(
      'network_error',
    );
  });

  it('refuses plain http project urls', () => {
    expect(() =>
      createSupabaseClient({ url: 'http://project.supabase.co', anonKey: 'key' }),
    ).toThrowError(/https/);
  });

  it('refuses a service role key', () => {
    const segment = (payload: object) => btoa(JSON.stringify(payload)).replace(/=+$/, '');
    const serviceKey = `${segment({ alg: 'HS256' })}.${segment({ role: 'service_role' })}.signature`;

    expect(() =>
      createSupabaseClient({ url: 'https://project.supabase.co', anonKey: serviceKey }),
    ).toThrowError(/service role/);
  });
});
