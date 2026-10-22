import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
  inject,
  signal,
} from '@angular/core';
import {
  DEFAULT_AUTH_THEME,
  type AuthError,
  type AuthMessageKey,
  type AuthTheme,
} from '../contract/auth.models';
import { safeLogoUrl, themeVariables } from '../contract/auth.theme';
import { AUTH_PROVIDER, AUTHKIT_OPTIONS } from '../core/auth-kit.options';
import { AUTHKIT_STYLES } from './authkit.styles';

export type SocialButtonVariant = 'icon' | 'icon-and-text';

const BRAND_COLORS: Record<string, string> = {
  google: '#ffffff',
  github: '#24292f',
  apple: '#000000',
  azure: '#0078d4',
  facebook: '#1877f2',
  discord: '#5865f2',
  gitlab: '#fc6d26',
  linkedin: '#0a66c2',
  slack: '#4a154b',
  spotify: '#1db954',
  twitch: '#9146ff',
  twitter: '#000000',
  x: '#000000',
  zoom: '#0b5cff',
};

const LIGHT_BRANDS = new Set(['google']);

/** Social sign-in buttons. Mirrors SupaSocialsAuth from supabase_auth_ui. */
@Component({
  selector: 'ak-socials',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [AUTHKIT_STYLES],
  template: `
    <div class="ak-form" [style]="themeVars">
      @if (logo) {
        <img class="ak-logo" [src]="logo" alt="" />
      }

      @if (errorMessage()) {
        <div class="ak-error" role="alert">{{ errorMessage() }}</div>
      }

      <div class="ak-socials" [class.ak-inline]="variant === 'icon-and-text'">
        @for (provider of effectiveProviders; track provider) {
          <button
            class="ak-social"
            type="button"
            [style]="colored ? brandStyle(provider) : null"
            [disabled]="busy()"
            (click)="start(provider)"
          >
            @if (busy()) {
              <span class="ak-spinner"></span>
            } @else {
              <span aria-hidden="true">{{ initial(provider) }}</span>
            }
            @if (variant === 'icon-and-text') {
              <span>{{ t('continueWithProvider', displayName(provider)) }}</span>
            } @else {
              <span class="ak-visually-hidden">{{ displayName(provider) }}</span>
            }
          </button>
        }
      </div>
    </div>
  `,
})
export class AuthKitSocialsComponent {
  private readonly provider = inject(AUTH_PROVIDER);
  private readonly options = inject(AUTHKIT_OPTIONS);

  @Input() providers: readonly string[] | null = null;
  @Input() colored = true;
  @Input() variant: SocialButtonVariant = 'icon-and-text';
  @Input() redirectTo: string | null = null;

  @Output() readonly oauthRequested = new EventEmitter<string>();
  @Output() readonly failed = new EventEmitter<AuthError | null>();

  readonly errorMessage = signal<string | null>(null);
  readonly busy = signal(false);

  readonly themeVars = themeVariables(this.options.theme ?? DEFAULT_AUTH_THEME);
  readonly logo = safeLogoUrl(this.options.theme);

  get effectiveProviders(): readonly string[] {
    return this.providers ?? this.options.socialProviders;
  }

  t(key: AuthMessageKey, provider?: string): string {
    return this.options.messages.get(key, provider);
  }

  initial(provider: string): string {
    return provider.length === 0 ? '?' : provider.charAt(0).toUpperCase();
  }

  displayName(provider: string): string {
    const cleaned = provider.replace('custom:', '').replace('_oidc', '');
    return cleaned.length === 0 ? provider : cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  brandStyle(provider: string): Record<string, string> {
    const background = BRAND_COLORS[provider.toLowerCase()] ?? 'transparent';
    const color = LIGHT_BRANDS.has(provider.toLowerCase()) ? '#111827' : '#ffffff';
    return { background, color };
  }

  async start(provider: string): Promise<void> {
    this.busy.set(true);
    this.errorMessage.set(null);

    try {
      const url = await this.provider.beginOAuth(
        provider,
        this.redirectTo ?? this.options.redirectTo ?? undefined,
      );

      this.oauthRequested.emit(url);

      // Default web behaviour: full-page redirect. Hosts that prefer a popup or a native
      // browser listen to oauthRequested instead.
      if (!this.oauthRequested.observed) {
        globalThis.location?.assign(url);
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message.startsWith('AuthKit:')
          ? error.message
          : this.t('unexpectedError');

      this.errorMessage.set(message);
      this.failed.emit({ code: 'unknown', message, statusCode: null });
    } finally {
      this.busy.set(false);
    }
  }
}
