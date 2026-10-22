import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  ViewEncapsulation,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import type {
  AuthAssuranceLevel,
  AuthFederationMethod,
  AuthFederationProvider,
} from '../contract/auth.models';
import { safeLogoUrl, themeVariables } from '../contract/auth.theme';
import { AUTHKIT_OPTIONS } from '../core/auth-kit.options';
import { AuthKitProviders } from '../providers/authkit-providers';
import { AUTHKIT_STYLES } from '../components/authkit.styles';
import { buildClaveLoginUrl } from './clave-auth.provider';

/** Cl@ve 2 does not offer `low`; substantial is the default when a descriptor declares none. */
const FALLBACK_LEVEL: AuthAssuranceLevel = 'substantial';

const DEFAULT_LEVEL_LABELS: Readonly<Record<AuthAssuranceLevel, string>> = {
  low: 'Low',
  substantial: 'Substantial',
  high: 'High',
};

/**
 * Cl@ve sign-in control. `<ak-clave>`.
 *
 * One control per declared `AuthFederationMethod`, plus a level selector when more than one level
 * applies. Everything comes from the descriptors: there is no `switch` on a method or provider id
 * (spec-clave §8, R-16), so a new Cl@ve method needs no component change.
 *
 * Navigation belongs to the host. When `(navigate)` is bound the component renders buttons and
 * emits the login URL; when it is not, it renders real `<a href>` links, so it works in a plain
 * Angular app with no handler at all. It never calls `location.assign` or the router.
 *
 * ```html
 * <ak-clave [providers]="descriptors" returnUrl="/expedientes"
 *           (navigate)="go($event)" />
 * <ak-clave [providers]="descriptors" returnUrl="/expedientes" />
 * ```
 */
@Component({
  selector: 'ak-clave',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [AUTHKIT_STYLES],
  template: `
    <div class="ak-form ak-federation" [style]="themeVars" data-ak="clave">
      @if (logo) {
        <img class="ak-logo" [src]="logo" alt="" />
      }

      @if (effectiveProviders().length === 0) {
        <div class="ak-error" role="alert" data-ak-empty>{{ emptyMessage() }}</div>
      }

      @for (provider of effectiveProviders(); track provider.id) {
        <section class="ak-federation-provider" [attr.data-ak-provider]="provider.id">
          @if (provider.iconUrl) {
            <img class="ak-federation-icon" [src]="provider.iconUrl" alt="" />
          }

          <h2 class="ak-federation-name">{{ provider.displayName }}</h2>

          @if (provider.description) {
            <p class="ak-federation-description">{{ provider.description }}</p>
          }

          @if (showLevelSelector() && !level() && levelsFor(provider).length > 1) {
            <label class="ak-field ak-label">
              <span>{{ levelLabel() }}</span>
              <select
                class="ak-input"
                [attr.data-ak-level]="provider.id"
                [value]="selectedLevelFor(provider)"
                (change)="onLevelChange(provider, $event)"
              >
                @for (option of levelsFor(provider); track option) {
                  <option [value]="option" [selected]="option === selectedLevelFor(provider)">
                    {{ levelLabelFor(option) }}
                  </option>
                }
              </select>
            </label>
          }

          @if (provider.methods.length === 0) {
            <div class="ak-error" role="alert">{{ emptyMessage() }}</div>
          } @else {
            <div class="ak-federation-methods">
              @for (method of provider.methods; track method.id) {
                @if (navigate.observed) {
                  <button
                    class="ak-social ak-federation-method"
                    type="button"
                    [attr.data-ak-method]="method.id"
                    [attr.data-ak-provider]="provider.id"
                    [attr.data-ak-loa]="selectedLevelFor(provider)"
                    (click)="select(provider, method)"
                  >
                    <span>{{ method.displayName }}</span>
                    @if (method.description) {
                      <small class="ak-federation-hint">{{ method.description }}</small>
                    }
                  </button>
                } @else {
                  <a
                    class="ak-social ak-federation-method"
                    [href]="urlFor(provider, method)"
                    [attr.data-ak-method]="method.id"
                    [attr.data-ak-provider]="provider.id"
                    [attr.data-ak-loa]="selectedLevelFor(provider)"
                  >
                    <span>{{ method.displayName }}</span>
                    @if (method.description) {
                      <small class="ak-federation-hint">{{ method.description }}</small>
                    }
                  </a>
                }
              }
            </div>
          }
        </section>
      }
    </div>
  `,
})
export class AuthKitClaveComponent {
  private readonly options = inject(AUTHKIT_OPTIONS);
  private readonly registry = inject(AuthKitProviders);

  /** Descriptors to render. Defaults to the ones the configured provider declares. */
  readonly providers = input<readonly AuthFederationProvider[] | null>(null);

  /** Forces a level. When null, the user picks among the descriptor's levels. */
  readonly level = input<AuthAssuranceLevel | null>(null);

  /** Where the user should land after the federation. Validated by the host (R-12). */
  readonly returnUrl = input<string | null>(null);

  /** Host login route that starts the federation, as mapped with MapClave(). */
  readonly loginPath = input<string>('/clave/login');

  /** Whether the level selector is rendered when more than one level applies. */
  readonly showLevelSelector = input(true);

  /** Label shown above the level selector. */
  readonly levelLabel = input('Level of assurance');

  /** Shown when a descriptor declares no method. */
  readonly emptyMessage = input('No login method is available.');

  /** Host-supplied labels for the level selector; the contract has no key for them yet. */
  readonly levelLabels = input<Partial<Record<AuthAssuranceLevel, string>>>(DEFAULT_LEVEL_LABELS);

  /**
   * Emitted when the host binds it. Unbound, the component renders links instead.
   *
   * `EventEmitter` rather than `output()` on purpose: Angular 22 removed
   * `OutputEmitterRef.observed`, and deciding between a button and a real `<a href>` requires
   * knowing whether the host listens. This is the same mechanism `ak-socials` uses.
   */
  @Output() readonly navigate = new EventEmitter<string>();

  readonly themeVars = themeVariables(this.options.theme);
  readonly logo = safeLogoUrl(this.options.theme);

  private readonly selectedLevels = signal<Partial<Record<string, AuthAssuranceLevel>>>({});

  readonly effectiveProviders = computed(
    () => this.providers() ?? this.registry.authKitProviders(),
  );

  /** Declared levels in descriptor order, falling back to the union of the method levels. */
  levelsFor(provider: AuthFederationProvider): readonly AuthAssuranceLevel[] {
    if (provider.levels.length > 0) {
      return provider.levels;
    }

    const levels: AuthAssuranceLevel[] = [];

    for (const method of provider.methods) {
      for (const level of method.levels) {
        if (!levels.includes(level)) {
          levels.push(level);
        }
      }
    }

    return levels;
  }

  /** The level a method will request right now. */
  selectedLevelFor(provider: AuthFederationProvider): AuthAssuranceLevel {
    const forced = this.level();

    if (forced) {
      return forced;
    }

    const levels = this.levelsFor(provider);
    const chosen = this.selectedLevels()[provider.id];

    if (chosen && (levels.length === 0 || levels.includes(chosen))) {
      return chosen;
    }

    const recommended = provider.methods.find((method) => method.recommended);
    const preferred = recommended?.levels[0];

    if (preferred && (levels.length === 0 || levels.includes(preferred))) {
      return preferred;
    }

    return levels[0] ?? FALLBACK_LEVEL;
  }

  levelLabelFor(level: AuthAssuranceLevel): string {
    return this.levelLabels()[level] ?? level;
  }

  urlFor(provider: AuthFederationProvider, method: AuthFederationMethod): string {
    return buildClaveLoginUrl({
      loginPath: this.loginPath(),
      level: this.selectedLevelFor(provider),
      method: method.id,
      returnUrl: this.returnUrl(),
    });
  }

  select(provider: AuthFederationProvider, method: AuthFederationMethod): void {
    this.navigate.emit(this.urlFor(provider, method));
  }

  onLevelChange(provider: AuthFederationProvider, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;

    if (!isAssuranceLevel(value)) {
      return;
    }

    this.selectedLevels.update((levels) => ({ ...levels, [provider.id]: value }));
  }
}

function isAssuranceLevel(value: string): value is AuthAssuranceLevel {
  return value === 'low' || value === 'substantial' || value === 'high';
}
