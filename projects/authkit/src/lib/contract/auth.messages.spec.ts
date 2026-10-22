import { AUTHKIT_CONTRACT } from '@authkit/contracts/testing';
import {
  DictionaryAuthMessages,
  ENGLISH_AUTH_MESSAGES,
  HttpAuthMessagesSource,
  JsonAuthMessages,
  MAXIMUM_MESSAGES_BYTES,
  loadAuthMessages,
  parseMessages,
} from './auth.messages';

describe('Auth messages adapters', () => {
  it('English resolves every key in the contract', () => {
    for (const key of AUTHKIT_CONTRACT.messageKeys) {
      expect(ENGLISH_AUTH_MESSAGES.get(key)).toBeTruthy();
    }
  });

  it('DictionaryAuthMessages falls back per key', () => {
    const partial = new DictionaryAuthMessages({ signIn: 'Entrar' }, ENGLISH_AUTH_MESSAGES);

    expect(partial.get('signIn')).toBe('Entrar');
    expect(partial.get('email')).toBe('Enter your email');
  });

  it('DictionaryAuthMessages interpolates the provider', () => {
    expect(ENGLISH_AUTH_MESSAGES.get('continueWithProvider', 'Github')).toBe(
      'Continue with Github',
    );
    expect(ENGLISH_AUTH_MESSAGES.get('continueWithProvider')).toContain('{provider}');
  });

  it('JsonAuthMessages accepts camelCase and case-insensitive keys, ignoring unknown ones', () => {
    const messages = new JsonAuthMessages(
      JSON.stringify({ SIGNIN: 'Entrar', email: 'Correo', notAKey: 'ignored' }),
    );

    expect(messages.get('signIn')).toBe('Entrar');
    expect(messages.get('email')).toBe('Correo');
    expect(messages.get('password')).toBe('Enter your password');
  });

  it('JsonAuthMessages rejects invalid documents', () => {
    expect(() => new JsonAuthMessages('{ not json')).toThrowError(/not valid JSON/);
    expect(() => new JsonAuthMessages('[]')).toThrowError(/JSON object/);
    expect(() => new JsonAuthMessages('')).toThrowError(/empty or larger/);
  });

  it('JsonAuthMessages rejects payloads above the limit', () => {
    const huge = JSON.stringify({ signIn: 'a'.repeat(MAXIMUM_MESSAGES_BYTES + 1) });

    expect(() => parseMessages(huge)).toThrowError(/larger than 1 MB/);
  });

  it('HttpAuthMessagesSource fetches and decodes the catalog', async () => {
    const calls: string[] = [];
    const fakeFetch = (async (url: string) => {
      calls.push(url);
      return new Response(JSON.stringify({ signIn: 'Entrar' }), { status: 200 });
    }) as unknown as typeof fetch;

    const messages = await new HttpAuthMessagesSource(
      '/assets/pt.json',
      ENGLISH_AUTH_MESSAGES,
      fakeFetch,
    ).load();

    expect(messages.get('signIn')).toBe('Entrar');
    expect(messages.get('email')).toBe('Enter your email');
    expect(calls).toEqual(['/assets/pt.json']);
  });

  it('HttpAuthMessagesSource surfaces the status code', async () => {
    const fakeFetch = (async () => new Response('', { status: 404 })) as unknown as typeof fetch;

    await expect(
      new HttpAuthMessagesSource('/missing.json', ENGLISH_AUTH_MESSAGES, fakeFetch).load(),
    ).rejects.toThrowError(/HTTP 404/);
  });

  it('loadAuthMessages is a one-line wrapper', async () => {
    const fakeFetch = (async () =>
      new Response(JSON.stringify({ signIn: 'Entrar' }), {
        status: 200,
      })) as unknown as typeof fetch;

    const messages = await new HttpAuthMessagesSource(
      '/pt.json',
      ENGLISH_AUTH_MESSAGES,
      fakeFetch,
    ).load();

    expect(messages.get('signIn')).toBe('Entrar');
    expect(typeof loadAuthMessages).toBe('function');
  });
});
