import {
  HttpContext,
  HttpHeaders,
  HttpRequest,
  HttpResponse,
  type HttpHandlerFn,
} from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AUTH_PROVIDER } from '../core/auth-kit.options';
import { FakeAuthProvider, session } from '../testing/fake-auth.provider';
import { AUTHKIT_SKIP, authKitInterceptor } from './authkit.interceptor';

describe('authKitInterceptor', () => {
  let provider: FakeAuthProvider;

  beforeEach(() => {
    provider = new FakeAuthProvider();
    TestBed.configureTestingModule({
      providers: [{ provide: AUTH_PROVIDER, useValue: provider }],
    });
  });

  function dispatch(request: HttpRequest<unknown>): {
    request: HttpRequest<unknown>;
    forwarded: boolean;
  } {
    let seen = request;
    let forwarded = false;

    const next: HttpHandlerFn = (candidate) => {
      seen = candidate;
      forwarded = true;
      return of(new HttpResponse({ status: 204 }));
    };

    TestBed.runInInjectionContext(() => authKitInterceptor(request, next)).subscribe();

    return { request: seen, forwarded };
  }

  it('attaches the bearer token when a session has one', () => {
    provider.currentSession = session();

    const result = dispatch(new HttpRequest('GET', '/api/expedientes'));

    expect(result.forwarded).toBe(true);
    expect(result.request.headers.get('Authorization')).toBe('Bearer access');
  });

  it('does not attach an empty header when there is no session', () => {
    const result = dispatch(new HttpRequest('GET', '/api/public'));

    expect(result.request.headers.has('Authorization')).toBe(false);
  });

  it('honours AUTHKIT_SKIP', () => {
    provider.currentSession = session();

    const request = new HttpRequest('GET', '/api/public', {
      context: new HttpContext().set(AUTHKIT_SKIP, true),
    });
    const result = dispatch(request);

    expect(result.request.headers.has('Authorization')).toBe(false);
  });

  it('never overwrites an Authorization header the caller set', () => {
    provider.currentSession = session();

    const request = new HttpRequest('GET', '/api/external', {
      headers: new HttpHeaders({ Authorization: 'Bearer host-minted' }),
    });
    const result = dispatch(request);

    expect(result.request.headers.get('Authorization')).toBe('Bearer host-minted');
  });

  it('passes the original request through, untouched, when nothing applies', () => {
    const request = new HttpRequest('GET', '/api/public');
    const result = dispatch(request);

    expect(result.request).toBe(request);
  });
});
