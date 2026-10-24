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
import { isValidEmail, isValidPassword, passwordsMatch } from '../contract/auth.validation';
import { messageWith } from '../contract/auth.messages';
import { safeLogoUrl, themeVariables } from '../contract/auth.theme';
import { AUTH_PROVIDER, AUTHKIT_OPTIONS } from '../core/auth-kit.options';
import { AUTHKIT_STYLES } from './authkit.styles';

type ResetMode = 'request' | 'update';

/** Password recovery and password update form. Mirrors SupaResetPassword. */
@Component({
  selector: 'ak-reset-password',
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

      @if (mode() === 'request') {
        <form (submit)="request($event)">
          <div class="ak-field">
            <label class="ak-label" for="ak-reset-email">{{ t('email') }}</label>
            <input
              id="ak-reset-email"
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

          @if (notice()) {
            <div class="ak-notice" role="status">{{ notice() }}</div>
          }

          <button class="ak-button" type="submit" [disabled]="busy()">
            @if (busy()) {
              <span class="ak-spinner"></span>
            }
            {{ t('sendResetEmail') }}
          </button>
        </form>
      } @else {
        <form (submit)="update($event)">
          <div class="ak-field">
            <label class="ak-label" for="ak-new-password">{{ t('newPassword') }}</label>
            <input
              id="ak-new-password"
              class="ak-input"
              [type]="showPassword() ? 'text' : 'password'"
              autocomplete="new-password"
              [attr.aria-invalid]="passwordError() ? 'true' : null"
              [value]="password()"
              (input)="password.set(valueOf($event))"
            />
            <button class="ak-link" type="button" (click)="showPassword.set(!showPassword())">
              {{ t(showPassword() ? 'hidePassword' : 'showPassword') }}
            </button>
            @if (passwordError()) {
              <span class="ak-hint">{{ passwordError() }}</span>
            }
          </div>

          <div class="ak-field">
            <label class="ak-label" for="ak-new-password-confirm">{{ t('confirmPassword') }}</label>
            <input
              id="ak-new-password-confirm"
              class="ak-input"
              [type]="showPassword() ? 'text' : 'password'"
              autocomplete="new-password"
              [attr.aria-invalid]="confirmError() ? 'true' : null"
              [value]="confirmPassword()"
              (input)="confirmPassword.set(valueOf($event))"
            />
            @if (confirmError()) {
              <span class="ak-hint">{{ confirmError() }}</span>
            }
          </div>

          @if (notice()) {
            <div class="ak-notice" role="status">{{ notice() }}</div>
          }

          <button class="ak-button" type="submit" [disabled]="busy()">
            @if (busy()) {
              <span class="ak-spinner"></span>
            }
            {{ t('updatePassword') }}
          </button>
        </form>
      }
    </div>
  `,
})
export class AuthKitResetPasswordComponent implements OnChanges {
  private readonly provider = inject(AUTH_PROVIDER);
  private readonly options = inject(AUTHKIT_OPTIONS);

  @Input() redirectTo: string | null = null;
  @Input() prefilledEmail = '';

  /** Per-instance label overrides; missing keys use the configured catalog. */
  @Input() labels: Partial<Record<AuthMessageKey, string>> = {};

  /** Starts directly on the update form, for the page the recovery link lands on. */
  @Input() set updateMode(value: boolean) {
    this.mode.set(value ? 'update' : 'request');
  }

  @Output() readonly resetRequested = new EventEmitter<void>();
  @Output() readonly passwordUpdated = new EventEmitter<void>();
  @Output() readonly failed = new EventEmitter<AuthError | null>();

  readonly mode = signal<ResetMode>('request');
  readonly email = signal('');
  readonly password = signal('');
  readonly confirmPassword = signal('');
  readonly emailError = signal<string | null>(null);
  readonly passwordError = signal<string | null>(null);
  readonly confirmError = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly busy = signal(false);
  readonly showPassword = signal(false);

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

  async request(event: Event): Promise<void> {
    event.preventDefault();
    this.notice.set(null);
    this.emailError.set(isValidEmail(this.email()) ? null : this.t('invalidEmail'));

    if (this.emailError()) {
      return;
    }

    this.busy.set(true);
    this.errorMessage.set(null);

    try {
      const result = await this.provider.sendPasswordReset(
        this.email(),
        this.redirectTo ?? this.options.redirectTo ?? undefined,
      );

      if (!result.ok) {
        this.fail(result.error);
        return;
      }

      this.notice.set(this.t('resetEmailSent'));
      this.resetRequested.emit();
    } finally {
      this.busy.set(false);
    }
  }

  async update(event: Event): Promise<void> {
    event.preventDefault();
    this.notice.set(null);

    this.passwordError.set(
      isValidPassword(this.password(), this.options.minimumPasswordLength)
        ? null
        : messageWith(this.t('passwordTooShort'), {
            min: String(this.options.minimumPasswordLength),
          }),
    );

    this.confirmError.set(
      passwordsMatch(this.password(), this.confirmPassword()) ? null : this.t('passwordMismatch'),
    );

    if (this.passwordError() || this.confirmError()) {
      return;
    }

    this.busy.set(true);
    this.errorMessage.set(null);

    try {
      const result = await this.provider.updatePassword(this.password());
      if (!result.ok) {
        this.fail(result.error);
        return;
      }

      this.notice.set(this.t('passwordUpdated'));
      this.passwordUpdated.emit();
    } finally {
      this.busy.set(false);
    }
  }

  private fail(error: AuthError | null): void {
    this.errorMessage.set(error?.message ?? this.t('unexpectedError'));
    this.failed.emit(error);
  }
}
