import type { AuthError, AuthState } from './auth.models';

/** Default minimum password length. Deliberately stricter than Supabase's floor of 6. */
export const DEFAULT_MINIMUM_PASSWORD_LENGTH = 8;

/** Upper bound accepted by the forms, so a hostile paste cannot exhaust the client. */
export const MAXIMUM_PASSWORD_LENGTH = 1024;

// Bounded, non-backtracking pattern: no nested quantifiers, so hostile input cannot trigger
// catastrophic backtracking (ReDoS).
const EMAIL_PATTERN = /^[^@\s]{1,64}@[^@\s.]+(\.[^@\s.]+)+$/;

export function isValidEmail(email: string | null | undefined): boolean {
  if (!email || email.length > 254) {
    return false;
  }

  return EMAIL_PATTERN.test(email);
}

export function isValidPassword(
  password: string | null | undefined,
  minimumLength: number = DEFAULT_MINIMUM_PASSWORD_LENGTH,
): boolean {
  return (
    !!password && password.length >= minimumLength && password.length <= MAXIMUM_PASSWORD_LENGTH
  );
}

export function passwordsMatch(password: string, confirmation: string): boolean {
  return password === confirmation;
}

/**
 * Form-flow state machine shared by every renderer.
 * Guards against double submission, which is both a UX bug and an amplification vector
 * against the provider's rate limits.
 */
export class AuthFlow {
  private stateValue: AuthState = 'idle';
  private errorValue: AuthError | null = null;
  private busy = false;
  private readonly listeners = new Set<() => void>();

  get state(): AuthState {
    return this.stateValue;
  }

  get error(): AuthError | null {
    return this.errorValue;
  }

  get isBusy(): boolean {
    return this.busy;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setState(state: AuthState, clearError = false): void {
    this.stateValue = state;
    if (clearError) {
      this.errorValue = null;
    }
    this.emit();
  }

  async run(
    operation: () => Promise<import('./auth.models').AuthResult>,
  ): Promise<import('./auth.models').AuthResult> {
    if (this.busy) {
      return {
        ok: false,
        session: null,
        error: {
          code: 'unknown',
          message: 'An authentication request is already in progress.',
          statusCode: null,
        },
        nextStep: 'none',
      };
    }

    this.busy = true;
    this.errorValue = null;
    this.stateValue = 'submitting';
    this.emit();

    let result: import('./auth.models').AuthResult;
    try {
      result = await operation();
    } catch {
      // A provider that throws is a provider bug; never surface its exception text.
      result = {
        ok: false,
        session: null,
        error: { code: 'unknown', message: 'An unexpected error occurred.', statusCode: null },
        nextStep: 'none',
      };
    } finally {
      this.busy = false;
    }

    if (!result.ok) {
      this.errorValue = result.error ?? {
        code: 'unknown',
        message: 'An unexpected error occurred.',
        statusCode: null,
      };
      this.stateValue = 'error';
    } else {
      this.stateValue =
        result.nextStep === 'confirm_email'
          ? 'awaiting_email_confirmation'
          : result.nextStep === 'verify_otp'
            ? 'awaiting_otp'
            : result.session
              ? 'authenticated'
              : 'idle';
    }

    this.emit();
    return result;
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
