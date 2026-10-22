import { DEFAULT_AUTH_THEME, type AuthTheme } from './auth.models';

/**
 * Theme values are emitted as CSS custom properties, which makes them a potential style
 * injection vector. Sanitising here mirrors AuthTheme.ToCssVariables() in the .NET SDK.
 */
export function themeVariables(theme: AuthTheme = DEFAULT_AUTH_THEME): string {
  const entries: Array<[string, string]> = [
    ['--ak-primary', theme.primary],
    ['--ak-background', theme.background],
    ['--ak-surface', theme.surface],
    ['--ak-text', theme.text],
    ['--ak-text-muted', theme.textMuted],
    ['--ak-border', theme.border],
    ['--ak-danger', theme.danger],
    ['--ak-radius', theme.radius],
    ['--ak-spacing', theme.spacing],
    ['--ak-font-family', theme.fontFamily],
  ];

  return entries.map(([name, value]) => `${name}:${sanitize(value)}`).join(';');
}

/** Returns the logo URL when it is safe to render, otherwise null. */
export function safeLogoUrl(theme: AuthTheme = DEFAULT_AUTH_THEME): string | null {
  const url = theme.logoUrl?.trim();
  if (!url) {
    return null;
  }

  // "/\evil.example" becomes protocol-relative after browser normalisation.
  if (url.includes('\\') || /[\u0000-\u001f]/.test(url)) {
    return null;
  }

  if (url.startsWith('/') && !url.startsWith('//') && !url.includes(':')) {
    return url;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function sanitize(value: string | null | undefined): string {
  if (!value) {
    return 'inherit';
  }

  const cleaned = value.replace(/[;{}<>"'\\]/g, '');
  return /url\(|expression\(/i.test(cleaned) ? 'inherit' : cleaned;
}
