import {
  InjectionToken,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import {
  DeferredAuthMessages,
  ENGLISH_AUTH_MESSAGES,
  HttpAuthMessagesSource,
  JsonAuthMessages,
  type AuthMessages,
} from '../contract/auth.messages';

/**
 * Port for the current catalog. Components read it through AuthKitOptions, so registering a
 * source is enough — no need to pass messages into provideAuthKitSupabase.
 */
export const AUTHKIT_MESSAGES = new InjectionToken<AuthMessages>('AUTHKIT_MESSAGES', {
  factory: () => ENGLISH_AUTH_MESSAGES,
});

/**
 * Registers a JSON catalog loaded from a URL (app asset, CDN or your API).
 *
 * An app initializer awaits the fetch before the first render, so there is no flash of untranslated
 * text. Pass `messages` explicitly to provideAuthKitSupabase only when you want to override it.
 */
export function provideAuthKitMessagesFromUrl(
  url: string,
  fallback: AuthMessages = ENGLISH_AUTH_MESSAGES,
): ReturnType<typeof makeEnvironmentProviders> {
  return makeEnvironmentProviders([
    {
      provide: AUTHKIT_MESSAGES,
      useFactory: () =>
        new DeferredAuthMessages(new HttpAuthMessagesSource(url, fallback), fallback),
    },
    provideAppInitializer(async () => {
      const messages = inject(AUTHKIT_MESSAGES);

      if (messages instanceof DeferredAuthMessages) {
        // A broken bundle must not take the app down: keep the fallback and let the host retry.
        await messages.ensureLoaded().catch((error: unknown) => {
          console.warn(
            'AuthKit: the message catalog could not be loaded; keeping the fallback.',
            error,
          );
        });
      }
    }),
  ]);
}

/** Registers a catalog decoded from a JSON string that already ships with the app. */
export function provideAuthKitMessagesFromJson(
  json: string,
  fallback: AuthMessages = ENGLISH_AUTH_MESSAGES,
): ReturnType<typeof makeEnvironmentProviders> {
  return makeEnvironmentProviders([
    { provide: AUTHKIT_MESSAGES, useValue: new JsonAuthMessages(json, fallback) },
  ]);
}
