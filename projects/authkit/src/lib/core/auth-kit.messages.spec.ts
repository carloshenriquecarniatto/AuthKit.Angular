import { TestBed } from '@angular/core/testing';
import {
  AUTHKIT_MESSAGES,
  provideAuthKitMessagesFromJson,
  provideAuthKitMessagesFromUrl,
} from './auth-kit.messages';
import { AUTHKIT_OPTIONS, provideAuthKitSupabase } from './auth-kit.options';
import {
  DeferredAuthMessages,
  ENGLISH_AUTH_MESSAGES,
  JsonAuthMessages,
  type AuthMessagesSource,
} from '../contract/auth.messages';

function source(
  json: string,
  options: { delay?: number; failFirst?: boolean } = {},
): AuthMessagesSource & {
  calls: number;
} {
  const state = {
    calls: 0,
    async load() {
      state.calls++;
      if (options.delay) {
        await new Promise((resolve) => setTimeout(resolve, options.delay));
      }
      if (options.failFirst && state.calls === 1) {
        throw new Error('network down');
      }
      return new JsonAuthMessages(json);
    },
  };
  return state;
}

describe('DeferredAuthMessages', () => {
  it('serves the fallback before loading', () => {
    const messages = new DeferredAuthMessages(source('{"signIn":"Entrar"}'));

    expect(messages.isLoaded).toBe(false);
    expect(messages.get('signIn')).toBe('Sign In');
  });

  it('swaps the catalog once and shares concurrent loads', async () => {
    const catalog = source('{"signIn":"Entrar"}', { delay: 10 });
    const messages = new DeferredAuthMessages(catalog);

    await Promise.all(Array.from({ length: 10 }, () => messages.ensureLoaded()));

    expect(messages.isLoaded).toBe(true);
    expect(messages.get('signIn')).toBe('Entrar');
    expect(catalog.calls).toBe(1);
  });

  it('can retry after a failure', async () => {
    const catalog = source('{"signIn":"Entrar"}', { failFirst: true });
    const messages = new DeferredAuthMessages(catalog);

    await expect(messages.ensureLoaded()).rejects.toThrowError('network down');
    expect(messages.isLoaded).toBe(false);

    await messages.ensureLoaded();

    expect(messages.isLoaded).toBe(true);
    expect(catalog.calls).toBe(2);
  });
});

describe('message catalog registration', () => {
  const supabase = { url: 'https://project.supabase.co', anonKey: 'anon-key' };

  afterEach(() => TestBed.resetTestingModule());

  it('provideAuthKitSupabase resolves the catalog registered through the token', () => {
    TestBed.configureTestingModule({
      providers: [
        provideAuthKitSupabase(supabase),
        provideAuthKitMessagesFromJson('{"signIn":"Entrar"}'),
      ],
    });

    const options = TestBed.inject(AUTHKIT_OPTIONS);
    expect(options.messages.get('signIn')).toBe('Entrar');
    expect(options.messages.get('email')).toBe('Enter your email');
  });

  it('registration order does not matter', () => {
    TestBed.configureTestingModule({
      providers: [
        provideAuthKitMessagesFromJson('{"signIn":"Entrar"}'),
        provideAuthKitSupabase(supabase),
      ],
    });

    expect(TestBed.inject(AUTHKIT_OPTIONS).messages.get('signIn')).toBe('Entrar');
  });

  it('an explicit ui.messages still wins', () => {
    TestBed.configureTestingModule({
      providers: [
        provideAuthKitSupabase(supabase, { messages: ENGLISH_AUTH_MESSAGES }),
        provideAuthKitMessagesFromJson('{"signIn":"Entrar"}'),
      ],
    });

    expect(TestBed.inject(AUTHKIT_OPTIONS).messages.get('signIn')).toBe('Sign In');
  });

  it('provideAuthKitMessagesFromUrl registers a deferred catalog', () => {
    TestBed.configureTestingModule({
      providers: [provideAuthKitMessagesFromUrl('/assets/authkit.pt-BR.json')],
    });

    const messages = TestBed.inject(AUTHKIT_MESSAGES);
    expect(messages).toBeInstanceOf(DeferredAuthMessages);
    expect(messages.get('signIn')).toBe('Sign In');
  });
});
