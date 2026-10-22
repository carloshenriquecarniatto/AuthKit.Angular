import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { DEFAULT_AUTH_THEME } from '../contract/auth.models';
import { ENGLISH_AUTH_MESSAGES } from '../contract/auth.messages';
import { AUTHKIT_OPTIONS, type AuthKitOptions } from '../core/auth-kit.options';
import type { AuthKitFederationOutcome } from './clave.models';
import { AuthKitClaveCallbackComponent } from './clave-callback.component';

function options(): AuthKitOptions {
  return {
    theme: DEFAULT_AUTH_THEME,
    messages: ENGLISH_AUTH_MESSAGES,
    redirectTo: null,
    minimumPasswordLength: 8,
    socialProviders: [],
  };
}

interface RenderConfig {
  readonly callbackUrl?: string;
  readonly replaceHistory?: boolean;
}

async function render(
  config: RenderConfig = {},
): Promise<ComponentFixture<AuthKitClaveCallbackComponent>> {
  await TestBed.configureTestingModule({
    imports: [AuthKitClaveCallbackComponent],
    providers: [{ provide: AUTHKIT_OPTIONS, useValue: options() }],
  }).compileComponents();

  const fixture = TestBed.createComponent(AuthKitClaveCallbackComponent);

  if (config.callbackUrl !== undefined) {
    fixture.componentRef.setInput('callbackUrl', config.callbackUrl);
  }

  if (config.replaceHistory !== undefined) {
    fixture.componentRef.setInput('replaceHistory', config.replaceHistory);
  }

  return fixture;
}

describe('AuthKitClaveCallbackComponent', () => {
  it('emits a successful outcome and strips the federation parameters', async () => {
    const fixture = await render({
      callbackUrl:
        'https://sede.example.es/clave/callback?returnUrl=%2Fexpedientes&keep=1&error=&error_reason=',
    });
    const outcomes: AuthKitFederationOutcome[] = [];

    fixture.componentInstance.completed.subscribe((value) => outcomes.push(value));
    fixture.detectChanges();

    const outcome = outcomes[0];

    expect(outcome).toBeDefined();
    expect(outcome?.ok).toBe(true);
    expect(outcome?.error).toBeNull();
    expect(outcome?.cleanUrl).toBe(
      'https://sede.example.es/clave/callback?returnUrl=%2Fexpedientes&keep=1',
    );
    expect(outcome?.returnUrl).toBe('/expedientes');
  });

  it('emits a generic failure without echoing error_reason', async () => {
    const fixture = await render({
      callbackUrl:
        'https://sede.example.es/clave/callback?error=access_denied&error_reason=user_cancelled&returnUrl=%2Fexpedientes',
    });
    const outcomes: AuthKitFederationOutcome[] = [];

    fixture.componentInstance.completed.subscribe((value) => outcomes.push(value));
    fixture.detectChanges();

    const outcome = outcomes[0];

    expect(outcome?.ok).toBe(false);
    expect(outcome?.error?.code).toBe('federation_cancelled');
    expect(outcome?.cleanUrl).toBe(
      'https://sede.example.es/clave/callback?returnUrl=%2Fexpedientes',
    );
    expect(outcome?.returnUrl).toBe('/expedientes');
    expect(outcome?.error?.message).not.toContain('user_cancelled');
  });

  it('renders the failure in an alert and nothing while pending', async () => {
    const fixture = await render({
      callbackUrl: 'https://sede.example.es/clave/callback?error=federation_failed',
    });

    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('did not complete the sign in');
    expect(fixture.nativeElement.querySelector('[data-ak-pending]')).toBeNull();
  });

  it('raises the outcome exactly once per mount', async () => {
    const fixture = await render({ callbackUrl: 'https://sede.example.es/clave/callback' });
    let calls = 0;

    fixture.componentInstance.completed.subscribe(() => calls++);
    fixture.detectChanges();
    fixture.detectChanges();

    expect(calls).toBe(1);
  });

  it('does not touch the browser history by default', async () => {
    const replace = vi.spyOn(window.history, 'replaceState');
    const fixture = await render({
      callbackUrl: 'https://sede.example.es/clave/callback?error=access_denied',
    });

    fixture.detectChanges();

    expect(replace).not.toHaveBeenCalled();
    replace.mockRestore();
  });

  it('rewrites the history entry only when the host opts in', async () => {
    const replace = vi.spyOn(window.history, 'replaceState');
    const origin = window.location.origin;
    const fixture = await render({
      callbackUrl: `${origin}/clave/callback?error=access_denied`,
      replaceHistory: true,
    });

    fixture.detectChanges();

    expect(replace).toHaveBeenCalledWith(null, '', `${origin}/clave/callback`);
    replace.mockRestore();
  });

  it('never rewrites history to another origin', async () => {
    const replace = vi.spyOn(window.history, 'replaceState');
    const fixture = await render({
      callbackUrl: 'https://sede.example.es/clave/callback?error=access_denied',
      replaceHistory: true,
    });

    fixture.detectChanges();

    expect(replace).not.toHaveBeenCalled();
    replace.mockRestore();
  });
});
