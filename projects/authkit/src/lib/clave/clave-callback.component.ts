import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  OnInit,
  ViewEncapsulation,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { AuthMessageKey } from '../contract/auth.models';
import { themeVariables } from '../contract/auth.theme';
import { AUTHKIT_OPTIONS } from '../core/auth-kit.options';
import { AUTHKIT_STYLES } from '../components/authkit.styles';
import { inspectFederationCallback } from './clave-auth.provider';
import type { AuthKitFederationOutcome } from './clave.models';

/**
 * Mount `<ak-clave-callback>` on the route the host redirects to after the ACS handler ran.
 *
 * It reads `error` / `error_reason` from the URL, strips them, and raises the outcome. It performs
 * no network call, no token exchange and no navigation: success is inferred from the host's
 * session, which exists by the time this component renders (spec-clave §6).
 *
 * The browser history entry is left untouched unless the host opts in with
 * `[replaceHistory]="true"`; navigation is the host's decision.
 */
@Component({
  selector: 'ak-clave-callback',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [AUTHKIT_STYLES],
  template: `
    <div
      class="ak-form ak-federation"
      [style]="themeVars"
      data-ak="clave-callback"
      [attr.data-ak-ok]="outcome()?.ok"
    >
      @if (errorMessage()) {
        <div class="ak-error" role="alert" data-ak-error>{{ errorMessage() }}</div>
      } @else if (!outcome()) {
        <div class="ak-notice" role="status" aria-live="polite" data-ak-pending>
          <span class="ak-spinner"></span>
          {{ t('signingIn') }}
        </div>
      }
    </div>
  `,
})
export class AuthKitClaveCallbackComponent implements OnInit {
  private readonly options = inject(AUTHKIT_OPTIONS);
  private readonly document = inject(DOCUMENT);

  /** URL to inspect. Defaults to the current browser URL. */
  readonly callbackUrl = input<string | null>(null);

  /** Replaces the history entry with the cleaned URL. Off by default: the host owns navigation. */
  readonly replaceHistory = input(false);

  /** Raised once per mount with the parsed outcome. */
  readonly completed = output<AuthKitFederationOutcome>();

  readonly outcome = signal<AuthKitFederationOutcome | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly themeVars = themeVariables(this.options.theme);

  ngOnInit(): void {
    this.complete();
  }

  t(key: AuthMessageKey): string {
    return this.options.messages.get(key);
  }

  private complete(): void {
    const url = this.callbackUrl() ?? this.document.location?.href ?? '';

    if (!url) {
      return;
    }

    const result = inspectFederationCallback(url);
    this.outcome.set(result);
    this.errorMessage.set(result.error?.message ?? null);

    if (this.replaceHistory() && result.cleanUrl !== url && this.isSameOrigin(result.cleanUrl)) {
      this.document.defaultView?.history.replaceState(null, '', result.cleanUrl);
    }

    this.completed.emit(result);
  }

  /** `replaceState` throws on a cross-origin URL, so the check happens before touching history. */
  private isSameOrigin(cleanUrl: string): boolean {
    const view = this.document.defaultView;

    if (!view?.location) {
      return false;
    }

    try {
      return new URL(cleanUrl, view.location.href).origin === view.location.origin;
    } catch {
      return false;
    }
  }
}
