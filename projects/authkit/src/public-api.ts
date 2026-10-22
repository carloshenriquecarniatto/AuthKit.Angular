/*
 * Public API surface of AuthKit for Angular.
 */

// Contract
export * from './lib/contract/auth.models';
export * from './lib/contract/auth.provider';
export * from './lib/contract/auth.messages';
export * from './lib/contract/auth.theme';
export * from './lib/contract/auth.validation';

// Core
export * from './lib/core/auth-kit.options';
export * from './lib/core/auth-kit.messages';
export * from './lib/core/auth-kit.service';

// Supabase provider
export * from './lib/supabase/supabase-auth.provider';

// Cl@ve (eIDAS) — server-driven federation
export * from './lib/clave/clave.models';
export * from './lib/clave/clave-auth.provider';
export * from './lib/clave/clave.options';
export * from './lib/clave/clave.component';
export * from './lib/clave/clave-callback.component';

// Host integration (interceptor and guard are independent entry points at runtime)
export * from './lib/providers/authkit-providers';
export * from './lib/host/authkit.interceptor';
export * from './lib/host/authkit.guard';

// Components
export * from './lib/components/auth-metadata-field';
export * from './lib/components/authkit.styles';
export * from './lib/components/email.component';
export * from './lib/components/magic-link.component';
export * from './lib/components/reset-password.component';
export * from './lib/components/socials.component';
export * from './lib/components/callback.component';
