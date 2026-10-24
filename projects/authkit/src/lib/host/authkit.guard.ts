import { inject } from '@angular/core';
import { Router, type CanActivateFn, type Data, type UrlTree } from '@angular/router';
import type { AuthSession } from '../contract/auth.models';
import { DEFAULT_LOGIN_ROUTE, AUTHKIT_OPTIONS } from '../core/auth-kit.options';
import { AuthKitService } from '../core/auth-kit.service';

/** What a route can demand through `data.authKit`. */
export interface AuthKitRouteRequirement {
  readonly audience: string | null;
}

/**
 * Route guard expressed with Angular's own `CanActivateFn`. It returns `true` or a `UrlTree` to
 * the configured login route — it never calls `navigateByUrl`.
 *
 * ```ts
 * { path: 'account', canActivate: [authKitGuard],
 *   data: { authKit: { audience: 'clients' } } }
 * ```
 *
 * Fail-closed rules:
 * - no session → login route;
 * - `audience` required and the session's provider snapshot belongs to another audience → login.
 *
 * This module deliberately does not import `./authkit.interceptor`, so a host that only uses the
 * interceptor does not pull the guard (and `@angular/router`) into its bundle.
 */
export const authKitGuard: CanActivateFn = (route): boolean | UrlTree => {
  const auth = inject(AuthKitService);
  const router = inject(Router);
  const options = inject(AUTHKIT_OPTIONS);

  const loginRoute = options.loginRoute ?? DEFAULT_LOGIN_ROUTE;
  const requirement = readRequirement(route.data);

  return sessionSatisfies(auth.session(), requirement) ? true : router.parseUrl(loginRoute);
};

/** Reads `data.authKit` defensively: route data is untyped and can come from a lazy route. */
export function readRequirement(data: Data): AuthKitRouteRequirement {
  const value: unknown = data['authKit'];

  if (!isRecord(value)) {
    return { audience: null };
  }

  const audience = value['audience'];

  return {
    audience: typeof audience === 'string' && audience.trim() ? audience.trim() : null,
  };
}

/** Exposed so hosts and tests can ask the same question the guard asks. */
export function sessionSatisfies(
  session: AuthSession | null,
  requirement: AuthKitRouteRequirement,
): boolean {
  if (!session) {
    return false;
  }

  return !requirement.audience || session.provider?.audience === requirement.audience;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
