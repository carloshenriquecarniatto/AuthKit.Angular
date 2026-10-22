import { inject } from '@angular/core';
import { Router, type CanActivateFn, type Data, type UrlTree } from '@angular/router';
import type { AuthAssuranceLevel, AuthSession } from '../contract/auth.models';
import { DEFAULT_LOGIN_ROUTE, AUTHKIT_OPTIONS } from '../core/auth-kit.options';
import { AuthKitService } from '../core/auth-kit.service';

/** Ordered weakest to strongest. Policy comparisons are ordinal, as in the .NET SDK. */
const LOA_RANK: Readonly<Record<AuthAssuranceLevel, number>> = {
  low: 0,
  substantial: 1,
  high: 2,
};

/** What a route can demand through `data.authKit`. */
export interface AuthKitRouteRequirement {
  readonly loa: AuthAssuranceLevel | null;
  readonly audience: string | null;
}

/**
 * Route guard expressed with Angular's own `CanActivateFn`. It returns `true` or a `UrlTree` to
 * the configured login route — it never calls `navigateByUrl` (spec-host-integration §6).
 *
 * ```ts
 * { path: 'expedientes', canActivate: [authKitGuard],
 *   data: { authKit: { loa: 'high', audience: 'clientes' } } }
 * ```
 *
 * Fail-closed rules (spec-host-integration §8.6):
 * - no session → login route;
 * - `loa` required and the session carries no identity level → login route;
 * - `loa` required and granted < required → login route;
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

/**
 * Compares a granted level against a required one. A missing granted level never satisfies a
 * requirement (spec-host-integration §3.4).
 */
export function meetsAssuranceLevel(
  granted: AuthAssuranceLevel | null,
  required: AuthAssuranceLevel | null,
): boolean {
  if (!required) {
    return true;
  }

  if (!granted) {
    return false;
  }

  return LOA_RANK[granted] >= LOA_RANK[required];
}

/** Reads `data.authKit` defensively: route data is untyped and can come from a lazy route. */
export function readRequirement(data: Data): AuthKitRouteRequirement {
  const value: unknown = data['authKit'];

  if (!isRecord(value)) {
    return { loa: null, audience: null };
  }

  const loa = value['loa'];
  const audience = value['audience'];

  return {
    loa: isAssuranceLevel(loa) ? loa : null,
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

  if (!meetsAssuranceLevel(session.user.identity?.level ?? null, requirement.loa)) {
    return false;
  }

  return !requirement.audience || session.provider?.audience === requirement.audience;
}

function isAssuranceLevel(value: unknown): value is AuthAssuranceLevel {
  return typeof value === 'string' && Object.hasOwn(LOA_RANK, value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
