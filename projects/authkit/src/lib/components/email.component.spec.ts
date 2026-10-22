import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { DEFAULT_AUTH_THEME } from '../contract/auth.models';
import { ENGLISH_AUTH_MESSAGES } from '../contract/auth.messages';
import { AuthKitEmailComponent } from './email.component';
import { AUTH_PROVIDER, AUTHKIT_OPTIONS, type AuthKitOptions } from '../core/auth-kit.options';
import { FakeAuthProvider } from '../testing/fake-auth.provider';
import type { AuthSession } from '../contract/auth.models';

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

async function render(
  provider: FakeAuthProvider,
  ui: AuthKitOptions = options(),
): Promise<ComponentFixture<AuthKitEmailComponent>> {
  await TestBed.configureTestingModule({
    imports: [AuthKitEmailComponent],
    providers: [
      { provide: AUTH_PROVIDER, useValue: provider },
      { provide: AUTHKIT_OPTIONS, useValue: ui },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(AuthKitEmailComponent);
  fixture.detectChanges();
  return fixture;
}

function type(
  fixture: ComponentFixture<AuthKitEmailComponent>,
  selector: string,
  value: string,
): void {
  const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

async function submit(fixture: ComponentFixture<AuthKitEmailComponent>): Promise<void> {
  const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
  form.dispatchEvent(new Event('submit'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
}

describe('AuthKitEmailComponent', () => {
  let provider: FakeAuthProvider;

  beforeEach(() => {
    provider = new FakeAuthProvider();
  });

  it('renders email, password and the sign-in button', async () => {
    const fixture = await render(provider);

    expect(fixture.nativeElement.querySelector('#ak-email')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#ak-password')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('button[type=submit]').textContent).toContain(
      'Sign In',
    );
  });

  it('hides the sign-up toggle when the provider does not support sign-up', async () => {
    provider.capabilities = { ...provider.capabilities, signUp: false };
    const fixture = await render(provider);

    expect(fixture.nativeElement.textContent).not.toContain("Don't have an account");
  });

  it('toggles to sign-up', async () => {
    const fixture = await render(provider);

    const toggle = Array.from(
      fixture.nativeElement.querySelectorAll('button.ak-link') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.includes("Don't have an account"));

    toggle?.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button[type=submit]').textContent).toContain(
      'Sign Up',
    );
  });

  it('signs in and emits the session', async () => {
    const fixture = await render(provider);
    let received: AuthSession | null = null;
    fixture.componentInstance.signInComplete.subscribe((value) => (received = value));

    type(fixture, '#ak-email', 'ada@example.com');
    type(fixture, '#ak-password', 'correct horse battery');
    await submit(fixture);

    expect(provider.lastEmail).toBe('ada@example.com');
    expect(received!.user.id).toBe('user-1');
  });

  it('never calls the provider with an invalid email', async () => {
    const fixture = await render(provider);

    type(fixture, '#ak-email', 'not-an-email');
    type(fixture, '#ak-password', 'correct horse battery');
    await submit(fixture);

    expect(provider.lastEmail).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('valid email');
  });

  it('renders a safe provider failure', async () => {
    provider.failNextWith('invalid_credentials');
    const fixture = await render(provider);

    type(fixture, '#ak-email', 'ada@example.com');
    type(fixture, '#ak-password', 'wrong-password');
    await submit(fixture);

    expect(fixture.nativeElement.textContent).toContain('Invalid email or password.');
    expect(fixture.nativeElement.querySelector('[role=alert]')).toBeTruthy();
  });

  it('applies theme tokens as CSS variables', async () => {
    const fixture = await render(
      provider,
      options({ theme: { ...DEFAULT_AUTH_THEME, primary: '#ff0000' } }),
    );

    const style = (fixture.nativeElement.querySelector('div.ak-form') as HTMLElement).getAttribute(
      'style',
    );
    expect(style).toMatch(/--ak-primary:\s*#ff0000/);
  });

  it('rejects a password shorter than the configured minimum', async () => {
    const fixture = await render(provider);

    Array.from(
      fixture.nativeElement.querySelectorAll('button.ak-link') as NodeListOf<HTMLButtonElement>,
    )
      .find((button) => button.textContent?.includes("Don't have an account"))
      ?.click();
    fixture.detectChanges();

    type(fixture, '#ak-email', 'ada@example.com');
    type(fixture, '#ak-password', 'short');
    await submit(fixture);

    expect(fixture.nativeElement.textContent).toContain('at least 8 characters');
    expect(provider.lastEmail).toBeNull();
  });
});
