import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { DEFAULT_AUTH_THEME, provideAuthKitMessagesFromUrl, provideAuthKitSupabase } from 'authkit';
import { demoConfig } from './config';
import { messagesBundle } from './i18n';

export function createAppConfig(): ApplicationConfig {
  const bundle = messagesBundle(navigator.language);

  return {
    providers: [
      provideBrowserGlobalErrorListeners(),
      // Registration is declarative: the catalog loads during app initialization, before render.
      ...(bundle ? [provideAuthKitMessagesFromUrl(bundle)] : []),
      provideAuthKitSupabase(
        {
          url: demoConfig.url,
          anonKey: demoConfig.anonKey,
          redirectTo: window.location.origin,
        },
        {
          theme: {
            ...DEFAULT_AUTH_THEME,
            primary: '#0f766e',
            radius: '10px',
          },
        },
      ),
    ],
  };
}
