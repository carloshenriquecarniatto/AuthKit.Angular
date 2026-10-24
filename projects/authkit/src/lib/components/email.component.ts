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
import type { AuthError, AuthMessageKey, AuthResult, AuthSession } from '../contract/auth.models';
import { isValidEmail, isValidPassword, passwordsMatch } from '../contract/auth.validation';
import { messageWith } from '../contract/auth.messages';
import { safeLogoUrl, themeVariables } from '../contract/auth.theme';
import { AUTH_PROVIDER, AUTHKIT_OPTIONS } from '../core/auth-kit.options';
import type { AuthMetadataField } from './auth-metadata-field';
import { AUTHKIT_STYLES } from './authkit.styles';

type EmailMode = 'sign-in' | 'sign-up' | 'recover';

/**
 * Email and password sign-in / sign-up form.
 * Mirrors SupaEmailAuth from supabase_auth_ui, including the recovery toggle and
 * metadata fields.
 */
@Component({
  selector: 'ak-email',
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

      @if (mode() === 'recover') {
        <form (submit)="sendReset($event)">
          <div class="ak-field">
            <label class="ak-label" for="ak-recover-email">{{ t('email') }}</label>
            <input
              id="ak-recover-email"
              class="ak-input"
              type="email"
              autocomplete="email"
              [value]="email()"
              (input)="email.set(valueOf($event))"
            />
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

        <button class="ak-link" type="button" (click)="mode.set('sign-in')">
          {{ t('backToSignIn') }}
        </button>
      } @else {
        <form (submit)="submit($event)">
          <div class="ak-field">
            <label class="ak-label" for="ak-email">{{ t('email') }}</label>
            <input
              id="ak-email"
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

          <div class="ak-field">
            <label class="ak-label" for="ak-password">{{ t('password') }}</label>
            <input
              id="ak-password"
              class="ak-input"
              [type]="showPassword() ? 'text' : 'password'"
              [attr.autocomplete]="mode() === 'sign-up' ? 'new-password' : 'current-password'"
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

          @if (showConfirmPasswordField && mode() === 'sign-up') {
            <div class="ak-field">
              <label class="ak-label" for="ak-confirm">{{ t('confirmPassword') }}</label>
              <input
                id="ak-confirm"
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
          }

          @if (mode() === 'sign-up') {
            @for (field of metadataFields; track field.key) {
              @if (field.kind === 'boolean') {
                <label class="ak-checkbox" [attr.for]="'ak-meta-' + field.key">
                  <input
                    [id]="'ak-meta-' + field.key"
                    type="checkbox"
                    [checked]="booleans()[field.key] ?? false"
                    (change)="setBoolean(field.key, $event)"
                  />
                  {{ field.label }}
                </label>
              } @else {
                <div class="ak-field">
                  <label class="ak-label" [attr.for]="'ak-meta-' + field.key">{{
                    field.label
                  }}</label>
                  <input
                    [id]="'ak-meta-' + field.key"
                    class="ak-input"
                    type="text"
                    [attr.placeholder]="field.placeholder ?? null"
                    [value]="texts()[field.key] ?? ''"
                    (input)="setText(field.key, $event)"
                  />
                </div>
              }
            }
          }

          <button class="ak-button" type="submit" [disabled]="busy()">
            @if (busy()) {
              <span class="ak-spinner"></span>
            }
            {{ t(mode() === 'sign-up' ? 'signUp' : 'signIn') }}
          </button>

          @if (mode() === 'sign-in' && showForgotPassword) {
            <button class="ak-link" type="button" (click)="startRecovery()">
              {{ t('forgotPassword') }}
            </button>
          }

          @if (capabilities.signUp && showSignUp) {
            <button class="ak-link" type="button" (click)="toggleMode()">
              {{ t(mode() === 'sign-up' ? 'haveAccount' : 'dontHaveAccount') }}
            </button>
          }
        </form>
      }
    </div>
  `,
})
export class AuthKitEmailComponent implements OnChanges {
  private readonly provider = inject(AUTH_PROVIDER);
  private readonly options = inject(AUTHKIT_OPTIONS);

  /** Extra sign-up fields mapped to user metadata. */
  @Input() metadataFields: readonly AuthMetadataField[] = [];

  /** Shows a second password field on sign-up. */
  @Input() showConfirmPasswordField = false;

  @Input() prefilledEmail = '';
  @Input() prefilledPassword = '';

  /** Overrides the redirect URL configured at bootstrap. */
  @Input() redirectTo: string | null = null;

  /** Hides the "forgot your password?" link on the sign-in form. */
  @Input() showForgotPassword = true;

  /** Hides the sign-in/sign-up switch even when the provider supports sign-up. */
  @Input() showSignUp = true;

  /** Per-instance label overrides; missing keys use the configured catalog. */
  @Input() labels: Partial<Record<AuthMessageKey, string>> = {};

  @Output() readonly signInComplete = new EventEmitter<AuthSession>();
  @Output() readonly signUpComplete = new EventEmitter<AuthResult>();
  @Output() readonly passwordResetSent = new EventEmitter<void>();
  @Output() readonly failed = new EventEmitter<AuthError | null>();

  readonly mode = signal<EmailMode>('sign-in');
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
  readonly texts = signal<Record<string, string>>({});
  readonly booleans = signal<Record<string, boolean>>({});

  readonly themeVars = themeVariables(this.options.theme);
  readonly logo = safeLogoUrl(this.options.theme);
  readonly capabilities = this.provider.capabilities;

  constructor() {
    this.email.set(this.prefilledEmail);
    this.password.set(this.prefilledPassword);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['prefilledEmail']) {
      this.email.set(this.prefilledEmail);
    }

    if (changes['prefilledPassword']) {
      this.password.set(this.prefilledPassword);
    }
  }

  t(key: AuthMessageKey): string {
    return this.labels[key] ?? this.options.messages.get(key);
  }

  valueOf(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  setText(key: string, event: Event): void {
    this.texts.update((values) => ({ ...values, [key]: this.valueOf(event) }));
  }

  setBoolean(key: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.booleans.update((values) => ({ ...values, [key]: checked }));
  }

  toggleMode(): void {
    this.mode.update((mode) => (mode === 'sign-up' ? 'sign-in' : 'sign-up'));
    this.clearErrors();
  }

  startRecovery(): void {
    this.mode.set('recover');
    this.notice.set(null);
    this.clearErrors();
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.notice.set(null);

    if (!this.validate()) {
      return;
    }

    this.busy.set(true);
    this.errorMessage.set(null);

    try {
      if (this.mode() === 'sign-up') {
        const result = await this.provider.signUpWithPassword(
          this.email(),
          this.password(),
          this.buildMetadata(),
        );

        if (!result.ok) {
          this.handleFailure(result);
          return;
        }

        if (result.session) {
          this.signInComplete.emit(result.session);
        }

        this.signUpComplete.emit(result);
        return;
      }

      const result = await this.provider.signInWithPassword(this.email(), this.password());
      if (!result.ok) {
        this.handleFailure(result);
        return;
      }

      if (result.session) {
        this.signInComplete.emit(result.session);
      }
    } finally {
      this.busy.set(false);
    }
  }

  async sendReset(event: Event): Promise<void> {
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
        this.handleFailure(result);
        return;
      }

      this.notice.set(this.t('resetEmailSent'));
      this.passwordResetSent.emit();
    } finally {
      this.busy.set(false);
    }
  }

  private validate(): boolean {
    this.emailError.set(isValidEmail(this.email()) ? null : this.t('invalidEmail'));

    if (this.mode() === 'sign-up') {
      this.passwordError.set(
        isValidPassword(this.password(), this.options.minimumPasswordLength)
          ? null
          : messageWith(this.t('passwordTooShort'), {
              min: String(this.options.minimumPasswordLength),
            }),
      );

      this.confirmError.set(
        this.showConfirmPasswordField && !passwordsMatch(this.password(), this.confirmPassword())
          ? this.t('passwordMismatch')
          : null,
      );
    } else {
      this.passwordError.set(this.password() ? null : this.t('requiredField'));
      this.confirmError.set(null);
    }

    const missingMetadata = this.metadataFields.some(
      (field) => field.required && (field.kind ?? 'text') === 'text' && !this.texts()[field.key],
    );

    return !this.emailError() && !this.passwordError() && !this.confirmError() && !missingMetadata;
  }

  private buildMetadata(): Record<string, string> | undefined {
    if (this.metadataFields.length === 0) {
      return undefined;
    }

    const metadata: Record<string, string> = {};
    for (const field of this.metadataFields) {
      if ((field.kind ?? 'text') === 'boolean') {
        metadata[field.key] = this.booleans()[field.key] ? 'true' : 'false';
      } else if (this.texts()[field.key]) {
        metadata[field.key] = this.texts()[field.key];
      }
    }

    return metadata;
  }

  private handleFailure(result: AuthResult): void {
    this.errorMessage.set(result.error?.message ?? this.t('unexpectedError'));
    this.failed.emit(result.error);
  }

  private clearErrors(): void {
    this.emailError.set(null);
    this.passwordError.set(null);
    this.confirmError.set(null);
    this.errorMessage.set(null);
  }
}
