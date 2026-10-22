import { makeEnvironmentProviders } from '@angular/core';
import { provideAuthKit, type AuthKitUiOptions } from '../core/auth-kit.options';
import { ClaveAuthProvider } from './clave-auth.provider';
import type { AuthFederationOptions } from './clave.models';

/**
 * Registers Cl@ve as the AuthKit provider.
 *
 * ```ts
 * providers: [
 *   provideAuthKitClave({
 *     loginPath: '/clave/login',
 *     providers: claveDescriptors,
 *     returnUrl: '/expedientes',
 *   }),
 * ]
 * ```
 *
 * The host still maps `MapClave()` (or the Node equivalent) and owns the certificates, the ACS
 * and the session. This function only wires the browser side (spec-clave §6).
 *
 * `provideAuthKit` stays the single registration path; this is a thin, typed wrapper over it.
 */
export function provideAuthKitClave(
  config: AuthFederationOptions,
  ui: AuthKitUiOptions = {},
): ReturnType<typeof makeEnvironmentProviders> {
  const redirectTo = ui.redirectTo ?? config.returnUrl;

  return provideAuthKit(
    () => new ClaveAuthProvider(config),
    redirectTo ? { ...ui, redirectTo } : ui,
  );
}
