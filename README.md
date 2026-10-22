# AuthKit for Angular

Native Angular authentication components for AuthKit: standalone components, signals, no wrapper
around `HttpClient`.

```bash
npm install @authkit/angular @authkit/contracts
```

This repository ships the Angular SDK only. The other platforms live in their own repositories:

| Platform | Repository                                                                  |
| -------- | --------------------------------------------------------------------------- |
| .NET     | [AuthKit.Net](https://github.com/carloshenriquecarniatto/AuthKit.Net)        |
| Aurelia  | [AuthKit.Aurelia](https://github.com/carloshenriquecarniatto/AuthKit.Aurelia) |
| Contract | [`@authkit/contracts`](https://www.npmjs.com/package/@authkit/contracts)      |

## Providers

| Provider   | Package entry point   | Notes                                                              |
| ---------- | --------------------- | ------------------------------------------------------------------ |
| Supabase   | `provideAuthKitSupabase` | Email, magic link, OTP (email + phone), recovery, OAuth         |
| Cl@ve      | `provideAuthKitClave`    | Server-driven eIDAS federation; the browser never holds a token |
| Any        | `provideAuthKit(provider)` | Bring your own `AuthProvider`                                |

```ts
bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withInterceptors([authKitInterceptor])),
    provideAuthKitClave({
      loginPath: '/clave/login',
      audience: 'clientes',
      providers: [claveDescriptor],
    }),
    provideRouter(routes),
  ],
});
```

```html
<ak-clave [returnUrl]="'/expedientes'" (navigate)="go($event)" />
<ak-clave-callback (completed)="onCompleted($event)" />
```

## Rules the SDK follows

- `HttpClient` stays `HttpClient`; the interceptor is an `HttpInterceptorFn`.
- Guards are `CanActivateFn` and return a `UrlTree`, never call the router.
- State is signals, not `BehaviorSubject`.
- Federation UI is descriptor-driven: one control per declared method, no `switch` on a method id.
- The contract comes from `@authkit/contracts`; a parity test fails the build if it drifts.

## Development

```bash
npm install
npm run build          # library + demo
npm test               # unit tests (vitest through the Angular builder)
npx prettier --check "projects/**/*.{ts,html,css,json}"
```

If the checkout path contains `#`, `?` or `%`, `npm test` mirrors the workspace into a temporary
directory before running, because Vite treats `#` as a URL fragment. CI runs in place.

The demo in `projects/demo` is Supabase-only and exists to exercise the components against a real
backend; the Cl@ve adapter needs a host that maps the federation endpoints (see `AuthKit.Net`).

## License

MIT — see [LICENSE](LICENSE).
