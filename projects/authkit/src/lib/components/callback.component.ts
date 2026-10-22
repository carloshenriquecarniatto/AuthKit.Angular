import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Inject,
  Input,
  OnInit,
  Output,
  ViewEncapsulation,
  inject,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import type { AuthError, AuthMessageKey, AuthSession } from '../contract/auth.models';
import { safeLogoUrl, themeVariables } from '../contract/auth.theme';
import { AUTH_PROVIDER, AUTHKIT_OPTIONS } from '../core/auth-kit.options';
import { AUTHKIT_STYLES } from './authkit.styles';

/**
 * Completes an OAuth or PKCE callback. Mount it on the route the provider redirects to.
 */
@Component({
  selector: 'ak-callback',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [AUTHKIT_STYLES],
  template: `
    <div class="ak-form" [style]="themeVars">
      @if (errorMessage()) {
        <div class="ak-error" role="alert">{{ errorMessage() }}</div>
      } @else if (!completed()) {
        <div class="ak-notice" role="status" aria-live="polite">
          <span class="ak-spinner"></span>
          {{ t('signingIn') }}
        </div>
      }
    </div>
  `,
})
export class AuthKitCallbackComponent implements OnInit {
  private readonly provider = inject(AUTH_PROVIDER);
  private readonly options = inject(AUTHKIT_OPTIONS);

  /** Optional URL to replace the current one after success, stripping the code from history. */
  @Input() redirectTo: string | null = null;

  @Output() readonly completedSession = new EventEmitter<AuthSession>();
  @Output() readonly failed = new EventEmitter<AuthError | null>();

  readonly errorMessage = signal<string | null>(null);
  readonly completed = signal(false);
  readonly themeVars = themeVariables(this.options.theme);
  readonly logo = safeLogoUrl(this.options.theme);

  constructor(@Inject(DOCUMENT) private readonly document: Document) {}

  t(key: AuthMessageKey): string {
    return this.options.messages.get(key);
  }

  ngOnInit(): void {
    void this.complete();
  }

  private async complete(): Promise<void> {
    const url = this.document.location?.href ?? '';

    if (!this.looksLikeCallback(url)) {
      this.completed.set(true);
      return;
    }

    const result = await this.provider.completeOAuth(url);
    if (!result.ok) {
      this.errorMessage.set(result.error?.message ?? this.t('unexpectedError'));
      this.failed.emit(result.error);
      return;
    }

    this.completed.set(true);

    if (result.session) {
      this.completedSession.emit(result.session);
    }

    const target = this.redirectTo ?? this.options.redirectTo;
    if (target) {
      // replaceState keeps the code and tokens out of browser history.
      this.document.defaultView?.history.replaceState(null, '', target);
    }
  }

  private looksLikeCallback(url: string): boolean {
    return /code=|access_token=|error=/i.test(url);
  }
}
