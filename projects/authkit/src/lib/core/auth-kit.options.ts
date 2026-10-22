import { InjectionToken, inject, type Provider, makeEnvironmentProviders } from '@angular/core';
import { DEFAULT_AUTH_THEME, type AuthTheme } from '../contract/auth.models';
import { ENGLISH_AUTH_MESSAGES, type AuthMessages } from '../contract/auth.messages';
import { AUTHKIT_MESSAGES } from './auth-kit.messages';
import { DEFAULT_MINIMUM_PASSWORD_LENGTH } from '../contract/auth.validation';
import type { AuthProvider } from '../contract/auth.provider';
import { SupabaseAuthProvider, type SupabaseAuthOptions } from '../supabase/supabase-auth.provider';

/** Route `authKitGuard` sends an unauthenticated user to when the host declares no other. */
export const DEFAULT_LOGIN_ROUTE = '/login';

/** UI settings shared by every AuthKit component. */
export interface AuthKitOptions {
  readonly theme: AuthTheme;
  readonly messages: AuthMessages;
  readonly redirectTo: string | null;
  readonly minimumPasswordLength: number;
  readonly socialProviders: readonly string[];
  /** Route `authKitGuard` returns a UrlTree to. */
  readonly loginRoute?: string;
}

export const AUTH_PROVIDER = new InjectionToken<AuthProvider>('AUTHKIT_PROVIDER');

export const AUTHKIT_OPTIONS = new InjectionToken<AuthKitOptions>('AUTHKIT_OPTIONS', {
  factory: () => ({
    theme: DEFAULT_AUTH_THEME,
    messages: inject(AUTHKIT_MESSAGES),
    redirectTo: null,
    minimumPasswordLength: DEFAULT_MINIMUM_PASSWORD_LENGTH,
    socialProviders: [],
    loginRoute: DEFAULT_LOGIN_ROUTE,
  }),
});

export interface AuthKitUiOptions {
  readonly theme?: AuthTheme;
  readonly messages?: AuthMessages;
  readonly redirectTo?: string;
  readonly minimumPasswordLength?: number;
  readonly socialProviders?: readonly string[];
  /** Route the guard returns when the visitor is not authenticated. Defaults to `/login`. */
  readonly loginRoute?: string;
}

/** Registers Supabase Auth as the AuthKit provider. */
export function provideAuthKitSupabase(
  supabase: SupabaseAuthOptions,
  ui: AuthKitUiOptions = {},
): ReturnType<typeof makeEnvironmentProviders> {
  return makeEnvironmentProviders([
    {
      provide: AUTH_PROVIDER,
      useFactory: () => new SupabaseAuthProvider(supabase),
    },
    {
      provide: AUTHKIT_OPTIONS,
      useFactory: () =>
        toOptions(ui, supabase.redirectTo, supabase.socialProviders, inject(AUTHKIT_MESSAGES)),
    },
  ]);
}

/** Registers any AuthProvider implementation. */
export function provideAuthKit(
  provider: AuthProvider | (() => AuthProvider),
  ui: AuthKitUiOptions = {},
): ReturnType<typeof makeEnvironmentProviders> {
  const providers: Provider[] = [
    typeof provider === 'function'
      ? { provide: AUTH_PROVIDER, useFactory: provider }
      : { provide: AUTH_PROVIDER, useValue: provider },
    {
      provide: AUTHKIT_OPTIONS,
      useFactory: () => toOptions(ui, undefined, undefined, inject(AUTHKIT_MESSAGES)),
    },
  ];

  return makeEnvironmentProviders(providers);
}

function toOptions(
  ui: AuthKitUiOptions,
  redirectTo?: string,
  socialProviders?: readonly string[],
  injectedMessages: AuthMessages = ENGLISH_AUTH_MESSAGES,
): AuthKitOptions {
  return {
    theme: ui.theme ?? DEFAULT_AUTH_THEME,
    messages: ui.messages ?? injectedMessages,
    redirectTo: ui.redirectTo ?? redirectTo ?? null,
    minimumPasswordLength: ui.minimumPasswordLength ?? DEFAULT_MINIMUM_PASSWORD_LENGTH,
    socialProviders: ui.socialProviders ?? socialProviders ?? [],
    loginRoute: ui.loginRoute ?? DEFAULT_LOGIN_ROUTE,
  };
}
