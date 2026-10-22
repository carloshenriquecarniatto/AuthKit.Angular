import type {
  AuthAssuranceLevel,
  AuthError,
  AuthFederationProvider,
  AuthResult,
} from '../contract/auth.models';
import type { AuthProvider } from '../contract/auth.provider';

/**
 * A request to start a server-driven federation. The level and the method are requests, not
 * parameters hidden inside a provider string (spec-clave §2).
 *
 * Mirrors AuthFederationRequest in the .NET SDK.
 */
export interface AuthFederationRequest {
  /** Canonical provider reference, for example `clientes/clave`. */
  readonly providerRef?: string;
  /** Level the caller asks for. Defaults to `substantial`, as on the server. */
  readonly level?: AuthAssuranceLevel;
  /** Method to force, when the host narrowed the journey. */
  readonly method?: string;
  /** Where the host wants the user to land afterwards. Validated by the host (R-12). */
  readonly returnUrl?: string;
}

/**
 * Browser configuration for Cl@ve. The SAML side (key, ACS, validation) is entirely the host's:
 * this object only says how to reach the host's own login route and which descriptors to render.
 */
export interface AuthFederationOptions {
  /** Origin of the host's own login route, when it is not the current origin. */
  readonly baseUrl?: string;
  /** Route the host mapped with MapClave(), for example `/clave/login`. */
  readonly loginPath: string;
  /** Audience the descriptors belong to. Host-declared, opaque (spec-providers §2.1). */
  readonly audience?: string;
  /** Canonical ref of the provider this screen is bound to, for example `clientes/clave`. */
  readonly providerRef?: string;
  /** Descriptors the UI renders. AuthKit never invents one. */
  readonly providers: readonly AuthFederationProvider[];
  /** Default landing URL, validated by the host. */
  readonly returnUrl?: string;
}

/**
 * What a server-driven provider adds to `AuthProvider`. The browser never sees a token, never
 * parses an assertion and never completes the flow: the host already did (spec-clave §6).
 */
export interface ServerDrivenAuthProvider extends AuthProvider {
  /** Builds the host's own login URL. AuthKit never navigates; the host decides. */
  beginFederation(request: AuthFederationRequest): Promise<string>;
  /** Reads `error` / `error_reason` from the redirect. No network call, no token exchange. */
  completeFederation(callbackUrl: string): Promise<AuthResult>;
}

/** The outcome a callback page raises, so the host can navigate and display a message. */
export interface AuthKitFederationOutcome {
  readonly ok: boolean;
  readonly error: AuthError | null;
  /** The callback URL without the federation parameters. */
  readonly cleanUrl: string;
  /** Landing URL the host put in the redirect, when present. */
  readonly returnUrl: string | null;
}
