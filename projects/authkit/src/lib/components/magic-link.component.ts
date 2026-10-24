import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewEncapsulation,
  inject,
  signal,
} from '@angular/core';
import type { AuthError, AuthMessageKey } from '../contract/auth.models';
import { isValidEmail } from '../contract/auth.validation';
import { safeLogoUrl, themeVariables } from '../contract/auth.theme';
import { AUTH_PROVIDER, AUTHKIT_OPTIONS } from '../core/auth-kit.options';
import { AUTHKIT_STYLES } from './authkit.styles';

/** Passwordless sign-in form. Mirrors SupaMagicAuth from supabase_auth_ui. */
@Component({
  selector: 'ak-magic-link',
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

      @if (sent()) {
        <div class="ak-notice" role="status">{{ t('checkYourEmail') }}</div>
        <button class="ak-link" type="button" (click)="reset()">{{ t('backToSignIn') }}</button>
      } @else {
        <form (submit)="send($event)">
          <div class="ak-field">
            <label class="ak-label" for="ak-magic-email">{{ t('email') }}</label>
            <input
              id="ak-magic-email"
              class="ak-input"
              type="email"
              autocomplete="email"
              [attr.aria-invalid]="emailError() ? 'true' : null"
              [value]="email()"
              (input)="email.set(valueOf($event))"
            />
            @if (emailError()) {
              <span class="ak-hint">{{ emailError() }}</span>
            }
          </div>

          <button class="ak-button" type="submit" [disabled]="busy()">
            @if (busy()) {
              <span class="ak-spinner"></span>
            }
            {{ t('magicLink') }}
          </button>
        </form>
      }
    </div>
  `,
})
export class AuthKitMagicLinkComponent implements OnChanges {
  private readonly provider = inject(AUTH_PROVIDER);
  private readonly options = inject(AUTHKIT_OPTIONS);

  @Input() redirectTo: string | null = null;
  @Input() prefilledEmail = '';

  /** Per-instance label overrides; missing keys use the configured catalog. */
  @Input() labels: Partial<Record<AuthMessageKey, string>> = {};
  @Output() readonly sentLink = new EventEmitter<void>();
  @Output() readonly failed = new EventEmitter<AuthError | null>();

  readonly email = signal('');
  readonly emailError = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly busy = signal(false);
  readonly sent = signal(false);

  readonly themeVars = themeVariables(this.options.theme);
  readonly logo = safeLogoUrl(this.options.theme);

  constructor() {
    this.email.set(this.prefilledEmail);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['prefilledEmail']) {
      this.email.set(this.prefilledEmail);
    }
  }

  t(key: AuthMessageKey): string {
    return this.labels[key] ?? this.options.messages.get(key);
  }

  valueOf(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  reset(): void {
    this.sent.set(false);
    this.errorMessage.set(null);
  }

  async send(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.set(null);
    this.emailError.set(isValidEmail(this.email()) ? null : this.t('invalidEmail'));

    if (this.emailError()) {
      return;
    }

    this.busy.set(true);
    try {
      const result = await this.provider.sendMagicLink(
        this.email(),
        this.redirectTo ?? this.options.redirectTo ?? undefined,
      );

      if (!result.ok) {
        this.errorMessage.set(result.error?.message ?? this.t('unexpectedError'));
        this.failed.emit(result.error);
        return;
      }

      this.sent.set(true);
      this.sentLink.emit();
    } finally {
      this.busy.set(false);
    }
  }
}
