/**
 * The normative contract now lives in `@authkit/contracts`, shared with the Aurelia SDK.
 * This module re-exports it so existing imports keep working, and keeps the one UI-only value:
 * the default theme.
 */

export type {
  AuthAssuranceLevel,
  AuthCapabilities,
  AuthDocumentType,
  AuthError,
  AuthErrorCode,
  AuthFederationMethod,
  AuthFederationProvider,
  AuthIdentity,
  AuthMessageKey,
  AuthNextStep,
  AuthProviderRef,
  AuthProviderSnapshot,
  AuthResult,
  AuthSession,
  AuthState,
  AuthTheme,
  AuthUser,
} from '@authkit/contracts';

export { authError, fail, next, ok } from '@authkit/contracts';

import type { AuthTheme } from '@authkit/contracts';

export const DEFAULT_AUTH_THEME: AuthTheme = {
  primary: '#4f46e5',
  background: '#ffffff',
  surface: '#ffffff',
  text: '#111827',
  textMuted: '#6b7280',
  border: '#d1d5db',
  danger: '#dc2626',
  radius: '8px',
  spacing: '16px',
  fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  logoUrl: null,
};
