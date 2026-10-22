# AuthKit for Angular

Native Angular authentication components for AuthKit: standalone components, signals, no wrapper
around `HttpClient`.

```bash
npm install @authkit/angular
```

This repository ships the Angular SDK only. The other platforms live in their own repositories:

| Platform | Repository                                                                    |
| -------- | ----------------------------------------------------------------------------- |
| .NET     | [AuthKit.Net](https://github.com/carloshenriquecarniatto/AuthKit.Net)         |
| Aurelia  | [AuthKit.Aurelia](https://github.com/carloshenriquecarniatto/AuthKit.Aurelia) |
| Contract | [`@authkit/contracts`](https://www.npmjs.com/package/@authkit/contracts)      |

## Providers

| Provider | Package entry point        | Notes                                                           |
| -------- | -------------------------- | --------------------------------------------------------------- |
| Supabase | `provideAuthKitSupabase`   | Email, magic link, OTP (email + phone), recovery, OAuth         |
| Cl@ve    | `provideAuthKitClave`      | Server-driven eIDAS federation; the browser never holds a token |
| Any      | `provideAuthKit(provider)` | Bring your own `AuthProvider`                                   |

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
- The contract is a committed copy of `contracts/authkit.contract.json`; a parity test and a CI
  drift check fail the build if it diverges from `AuthKit.Net`.

## The contract

`contracts/authkit.contract.json` is copied from
[AuthKit.Net](https://github.com/carloshenriquecarniatto/AuthKit.Net), which owns it. After a
contract change:

```bash
node scripts/sync-contract.mjs            # from ../AuthKit.Net
node scripts/sync-contract.mjs --remote   # or from GitHub
```

Then update `projects/authkit/src/lib/contract/auth.models.ts` in the same change. CI downloads the
canonical file and fails if the copy drifts.

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

## Browser pentest

`security/AuthKit.Pentest.Browser` signs a real user in through the Angular Supabase provider and
checks what an attacker can take from browser storage. It runs against the throwaway Supabase stack
from [AuthKit.Net](https://github.com/carloshenriquecarniatto/AuthKit.Net), which the scheduled
workflow checks out alongside this repository.

```bash
cd security/AuthKit.Pentest.Browser && npm ci && npx playwright install chromium
# with the stack running from AuthKit.Net:
AUTHKIT_PENTEST_URL=http://127.0.0.1:9999 AUTHKIT_PENTEST_ANON_KEY=... node run.mjs
```

## Try it locally

The demo needs Docker and the isolated Supabase stack from AuthKit.Net checked out next to this
repository (`../AuthKit.Net`). Override the location with `AUTHKIT_NET_ROOT`.

```bash
bash scripts/poc-up.sh     # http://127.0.0.1:8088
bash scripts/poc-down.sh
```

Sign up with any e-mail (confirmation is disabled in the stack) and a password of 8+ characters.
