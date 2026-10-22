import { Injectable, inject, signal } from '@angular/core';
import type { AuthErrorCode, AuthFederationProvider } from '../contract/auth.models';
import { AUTH_PROVIDER } from '../core/auth-kit.options';

/**
 * Reason codes for a failed resolution. These are a subset of the contract's `AuthErrorCode`,
 * introduced in 1.1.0 for the multi-provider registry (spec-providers §8).
 */
export type ProviderResolutionErrorCode = Extract<
  AuthErrorCode,
  'provider_ambiguous' | 'provider_not_configured' | 'provider_ref_malformed'
>;

export interface ProviderResolutionError {
  readonly code: ProviderResolutionErrorCode;
  readonly message: string;
}

export interface ProviderResolution {
  readonly provider: AuthFederationProvider | null;
  readonly error: ProviderResolutionError | null;
}

/**
 * A descriptor plus the audience it was registered for. Descriptors that carry no audience are
 * treated as already scoped by the caller — the host renders one audience at a time
 * (spec-providers §7.1). Routing never consults `kind` or registration order (spec-providers §3).
 */
export interface AuthProviderCandidate extends AuthFederationProvider {
  readonly audience?: string;
}

/**
 * Resolves a provider using spec-providers §3, rules 1 to 6 in order:
 *
 * 1. An explicit `providerRef` (`audience/id`) or `providerId` wins.
 * 2. Otherwise the audience in scope wins.
 * 3. Otherwise the audience's `isPrimary` provider wins.
 * 4. Otherwise a single provider wins.
 * 5. Otherwise the result is `provider_ambiguous` — never guessed, never first-registered.
 * 6. An audience boundary is never crossed.
 *
 * Pure on purpose: no DI, no signals, so it is testable and usable outside Angular.
 */
export function resolveProvider(
  providers: readonly AuthProviderCandidate[],
  providerRef?: string | null,
  audience?: string | null,
): ProviderResolution {
  const audienceKey = nonEmpty(audience);
  const scope = audienceKey
    ? providers.filter(
        (provider) => provider.audience === undefined || provider.audience === audienceKey,
      )
    : [...providers];

  const explicit = nonEmpty(providerRef);

  if (explicit) {
    return resolveExplicit(scope, explicit, audienceKey);
  }

  if (scope.length === 0) {
    return missing('No federation provider is configured for this audience.');
  }

  // Rule 2: an audience in scope narrows the candidates; rules 3 to 5 apply inside it.
  const inAudience = audienceKey
    ? scope.filter((provider) => provider.audience === audienceKey)
    : [];
  const pool = inAudience.length > 0 ? inAudience : scope;

  return decide(pool);
}

function resolveExplicit(
  scope: readonly AuthProviderCandidate[],
  explicit: string,
  audience: string | null,
): ProviderResolution {
  if (explicit.includes('/')) {
    const [refAudience, providerId, ...rest] = explicit.split('/');

    if (!refAudience || !providerId || rest.length > 0) {
      return malformed(explicit);
    }

    if (audience && refAudience !== audience) {
      return missing(`The provider "${explicit}" belongs to another audience.`);
    }

    const matches = scope.filter(
      (provider) =>
        provider.id === providerId &&
        (provider.audience === undefined || provider.audience === refAudience),
    );

    return decideExplicit(matches, explicit);
  }

  const matches = scope.filter(
    (provider) => provider.id === explicit || canonicalRef(provider) === explicit,
  );

  return decideExplicit(matches, explicit);
}

function decideExplicit(
  matches: readonly AuthProviderCandidate[],
  explicit: string,
): ProviderResolution {
  if (matches.length === 1) {
    return found(matches[0]);
  }

  if (matches.length === 0) {
    return missing(`No federation provider matches "${explicit}".`);
  }

  return ambiguous(matches);
}

function decide(pool: readonly AuthProviderCandidate[]): ProviderResolution {
  if (pool.length === 0) {
    return missing('No federation provider is configured for this audience.');
  }

  const primaries = pool.filter((provider) => provider.isPrimary);

  if (primaries.length === 1) {
    return found(primaries[0]);
  }

  // Two primaries in one audience is a configuration bug; failing loudly beats picking one.
  if (primaries.length > 1) {
    return ambiguous(primaries);
  }

  if (pool.length === 1) {
    return found(pool[0]);
  }

  return ambiguous(pool);
}

function found(provider: AuthProviderCandidate): ProviderResolution {
  return { provider, error: null };
}

function missing(message: string): ProviderResolution {
  return { provider: null, error: { code: 'provider_not_configured', message } };
}

function malformed(ref: string): ProviderResolution {
  return {
    provider: null,
    error: {
      code: 'provider_ref_malformed',
      message: `The provider reference "${ref}" is not of the form audience/providerId.`,
    },
  };
}

function ambiguous(providers: readonly AuthProviderCandidate[]): ProviderResolution {
  const candidates = providers.map(canonicalRef).join(', ');

  return {
    provider: null,
    error: {
      code: 'provider_ambiguous',
      message: `The provider is ambiguous between ${candidates}. Pass an explicit providerRef.`,
    },
  };
}

function canonicalRef(provider: AuthProviderCandidate): string {
  return provider.audience ? `${provider.audience}/${provider.id}` : provider.id;
}

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** The registry projection as a signal, so a picker is a loop over data and never a list. */
@Injectable({ providedIn: 'root' })
export class AuthKitProviders {
  private readonly provider = inject(AUTH_PROVIDER, { optional: true });
  private readonly state = signal<readonly AuthFederationProvider[]>(
    this.provider?.capabilities.federation ?? [],
  );

  /** Every descriptor the configured provider declares. Read-only by design. */
  readonly authKitProviders = this.state.asReadonly();

  /** Resolves against the declared descriptors, using the same rules as `resolveProvider`. */
  resolve(providerRef?: string | null, audience?: string | null): ProviderResolution {
    return resolveProvider(this.state(), providerRef, audience);
  }
}
