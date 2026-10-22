import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  DEFAULT_AUTH_THEME,
  type AuthAssuranceLevel,
  type AuthFederationMethod,
  type AuthFederationProvider,
} from '../contract/auth.models';
import { ENGLISH_AUTH_MESSAGES } from '../contract/auth.messages';
import { AUTH_PROVIDER, AUTHKIT_OPTIONS, type AuthKitOptions } from '../core/auth-kit.options';
import { FakeAuthProvider } from '../testing/fake-auth.provider';
import { AuthKitClaveComponent } from './clave.component';

const MOVIL: AuthFederationMethod = {
  id: 'clave_movil',
  displayName: 'Cl@ve Móvil',
  description: 'Approve on your phone',
  levels: ['high'],
  recommended: true,
};

const PIN: AuthFederationMethod = {
  id: 'clave_pin',
  displayName: 'Cl@ve PIN',
  description: null,
  levels: ['substantial'],
  recommended: false,
};

const DESCRIPTOR: AuthFederationProvider = {
  id: 'clave',
  kind: 'clave',
  displayName: 'Cl@ve',
  description: 'Spanish eIDAS identity',
  iconUrl: null,
  methods: [MOVIL, PIN],
  levels: ['substantial', 'high'],
  isPrimary: true,
};

function options(overrides: Partial<AuthKitOptions> = {}): AuthKitOptions {
  return {
    theme: DEFAULT_AUTH_THEME,
    messages: ENGLISH_AUTH_MESSAGES,
    redirectTo: null,
    minimumPasswordLength: 8,
    socialProviders: [],
    ...overrides,
  };
}

interface RenderConfig {
  readonly providers?: readonly AuthFederationProvider[];
  /** Descriptors the injected provider declares, for the defaulting test. */
  readonly federation?: readonly AuthFederationProvider[];
  readonly level?: AuthAssuranceLevel;
  readonly returnUrl?: string;
  readonly loginPath?: string;
  readonly emptyMessage?: string;
}

async function render(config: RenderConfig = {}): Promise<ComponentFixture<AuthKitClaveComponent>> {
  const provider = new FakeAuthProvider();

  if (config.federation) {
    provider.capabilities = { ...provider.capabilities, federation: config.federation };
  }

  await TestBed.configureTestingModule({
    imports: [AuthKitClaveComponent],
    providers: [
      { provide: AUTH_PROVIDER, useValue: provider },
      { provide: AUTHKIT_OPTIONS, useValue: options() },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(AuthKitClaveComponent);

  if (config.providers !== undefined) {
    fixture.componentRef.setInput('providers', config.providers);
  }

  if (config.level !== undefined) {
    fixture.componentRef.setInput('level', config.level);
  }

  if (config.returnUrl !== undefined) {
    fixture.componentRef.setInput('returnUrl', config.returnUrl);
  }

  if (config.loginPath !== undefined) {
    fixture.componentRef.setInput('loginPath', config.loginPath);
  }

  if (config.emptyMessage !== undefined) {
    fixture.componentRef.setInput('emptyMessage', config.emptyMessage);
  }

  fixture.detectChanges();
  return fixture;
}

function query(fixture: ComponentFixture<AuthKitClaveComponent>, selector: string): HTMLElement {
  return fixture.nativeElement.querySelector(selector) as HTMLElement;
}

function queryAll(
  fixture: ComponentFixture<AuthKitClaveComponent>,
  selector: string,
): HTMLElement[] {
  return Array.from(fixture.nativeElement.querySelectorAll(selector) as NodeListOf<HTMLElement>);
}

/** How a host actually binds the component: the output exists before the first render. */
@Component({
  imports: [AuthKitClaveComponent],
  template: `
    <ak-clave
      [providers]="providers"
      [returnUrl]="returnUrl"
      loginPath="/clave/login"
      (navigate)="onNavigate($event)"
    />
  `,
})
class ClaveHostComponent {
  readonly providers: readonly AuthFederationProvider[] = [DESCRIPTOR];
  readonly returnUrl = '/expedientes';
  readonly urls: string[] = [];

  onNavigate(url: string): void {
    this.urls.push(url);
  }
}

describe('AuthKitClaveComponent', () => {
  it('renders one control per declared method, from data', async () => {
    const fixture = await render({ providers: [DESCRIPTOR] });
    const controls = queryAll(fixture, '[data-ak-method]');

    expect(controls.map((control) => control.dataset['akMethod'])).toEqual([
      'clave_movil',
      'clave_pin',
    ]);
    expect(fixture.nativeElement.textContent).toContain('Cl@ve Móvil');
    expect(fixture.nativeElement.textContent).toContain('Cl@ve PIN');
    expect(fixture.nativeElement.textContent).toContain('Approve on your phone');
  });

  it('renders the level selector only when more than one level applies', async () => {
    const fixture = await render({ providers: [DESCRIPTOR] });
    const selector = query(fixture, '[data-ak-level]') as HTMLSelectElement;

    expect(selector).toBeTruthy();
    expect(Array.from(selector.options).map((option) => option.value)).toEqual([
      'substantial',
      'high',
    ]);
  });

  it('hides the level selector when the descriptor declares a single level', async () => {
    const fixture = await render({
      providers: [{ ...DESCRIPTOR, levels: ['substantial'], methods: [PIN] }],
    });

    expect(queryAll(fixture, '[data-ak-level]').length).toBe(0);
  });

  it('hides the selector and forces the level when the host sets it', async () => {
    const fixture = await render({ providers: [DESCRIPTOR], level: 'high' });

    expect(queryAll(fixture, '[data-ak-level]').length).toBe(0);
    expect(query(fixture, '[data-ak-method="clave_pin"]').getAttribute('data-ak-loa')).toBe('high');
  });

  it('prefers the level of the recommended method as the default', async () => {
    const fixture = await render({ providers: [DESCRIPTOR] });

    expect(query(fixture, '[data-ak-method="clave_movil"]').getAttribute('data-ak-loa')).toBe(
      'high',
    );
  });

  it('renders plain links when the host does not bind (navigate)', async () => {
    const fixture = await render({
      providers: [DESCRIPTOR],
      returnUrl: '/expedientes',
      loginPath: '/clave/login',
    });
    const link = query(fixture, 'a[data-ak-method="clave_movil"]') as HTMLAnchorElement;

    expect(link.href).toContain('/clave/login?');
    expect(link.href).toContain('loa=high');
    expect(link.href).toContain('method=clave_movil');
    expect(link.href).toContain('returnUrl=%2Fexpedientes');
  });

  it('emits the login URL when the host binds (navigate)', async () => {
    await TestBed.configureTestingModule({
      imports: [ClaveHostComponent],
      providers: [
        { provide: AUTH_PROVIDER, useValue: new FakeAuthProvider() },
        { provide: AUTHKIT_OPTIONS, useValue: options() },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ClaveHostComponent);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      'button[data-ak-method="clave_movil"]',
    ) as HTMLButtonElement | null;

    expect(button).not.toBeNull();
    button?.click();

    const emitted = fixture.componentInstance.urls[0];

    expect(emitted).toContain('/clave/login?loa=high');
    expect(emitted).toContain('method=clave_movil');
    expect(emitted).toContain('returnUrl=%2Fexpedientes');
  });

  it('rebuilds the URL when the user picks another level', async () => {
    const fixture = await render({ providers: [DESCRIPTOR] });
    const selector = query(fixture, '[data-ak-level]') as HTMLSelectElement;

    selector.value = 'substantial';
    selector.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(query(fixture, '[data-ak-method="clave_movil"]').getAttribute('data-ak-loa')).toBe(
      'substantial',
    );
  });

  it('defaults the descriptors to the ones the provider declares', async () => {
    const fixture = await render({ federation: [DESCRIPTOR] });

    expect(queryAll(fixture, '[data-ak-method]').length).toBe(2);
  });

  it('shows the empty message when a descriptor declares no method', async () => {
    const fixture = await render({
      providers: [{ ...DESCRIPTOR, methods: [] }],
      emptyMessage: 'Nothing to show',
    });

    expect(query(fixture, '[role="alert"]').textContent).toContain('Nothing to show');
  });

  it('renders nothing provider-specific: a new method needs no component change', async () => {
    const invented: AuthFederationMethod = {
      id: 'clave_dnie',
      displayName: 'DNIe',
      description: null,
      levels: ['high'],
      recommended: false,
    };

    const fixture = await render({ providers: [{ ...DESCRIPTOR, methods: [invented] }] });

    expect(query(fixture, '[data-ak-method="clave_dnie"]').textContent).toContain('DNIe');
  });
});
