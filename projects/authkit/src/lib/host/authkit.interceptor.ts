import { HttpContextToken, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthKitService } from '../core/auth-kit.service';

/**
 * Opts a single request out of the Authorization header, for example a call to a public endpoint
 * or to a different origin that must not receive the token:
 *
 * ```ts
 * http.get('/public/status', { context: new HttpContext().set(AUTHKIT_SKIP, true) });
 * ```
 */
export const AUTHKIT_SKIP = new HttpContextToken<boolean>(() => false);

/**
 * Attaches `Authorization: Bearer <token>` when the current AuthKit session holds one.
 *
 * Rules:
 * - no token, no header: a cookie-based host (Cl@ve) never gets an empty or synthetic header;
 * - a header the caller already set is preserved, so a host can forward a different token;
 * - `AUTHKIT_SKIP` opts out;
 * - the interceptor does not import `@angular/router` (this entry point stays tree-shakeable).
 *
 * Register it with Angular's own primitive: `provideHttpClient(withInterceptors([authKitInterceptor]))`.
 */
export const authKitInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.context.get(AUTHKIT_SKIP)) {
    return next(request);
  }

  if (request.headers.has('Authorization')) {
    return next(request);
  }

  const token = inject(AuthKitService).session()?.accessToken;

  if (!token) {
    return next(request);
  }

  return next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
