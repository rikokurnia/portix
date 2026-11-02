# Frontend release validation

The repository root is the local `project/` directory. Market and Vault are integrated; smart contracts remain untouched locally and are excluded from Git and Vercel uploads.

## Build and automated checks

Verified with the official Node.js 22.23.4 binary (archive SHA-256 verified against Node's SHASUMS), npm 10.9.9, and a clean `npm ci` installation:

- `npm run typecheck` — passed.
- `npm run lint` — passed without warnings.
- `npm test` — both portfolio and Market suites passed. Covers invalid amounts, decimal limits, insufficient balances, fee-inclusive quoted payments/payouts, shared price consistency, USD-based share conversions, proportional/full withdrawals, earned pUSDC, SMA calculations, and OHLCV fixtures.
- `npm run build` — passed. `/`, `/vault`, and `/market` prerender successfully; `/` redirects to `/vault`.

## Integration corrections

- Market buy confirmation debits the exact reviewed pUSDC payment, including its 0.1% fee. Store validation rejects a payment that does not quote the requested quantity.
- Market sell confirmation credits the same net payout shown in its review.
- One shared trade-calculation module serves previews and account actions.
- Opening Vault positions derive share counts from the current shared prices: 2.5 GOOGL → 7.5 pxPrime; 4 AAPL → 9.6 pxBoost.
- Market OHLCV fixtures use UTC dates consistently and share the catalog's current prices.

## Credentials and repository scope

Gitleaks 8.30.1 found no secrets in the staged frontend snapshot. Supplemental checks found no 64-character hexadecimal private-key candidates, private-key blocks, or credential-bearing URLs. Ignored paths were checked for contracts, environment files, local Vercel state, build output, and dependencies.

No frontend API keys or Vercel environment variables are required. No signing keys are used or shipped. Account data is local fixture state; no wallet SDK, chain execution, backend, or database is integrated.

## Dependency audit

`npm audit --omit=dev`: **0 vulnerabilities** in production dependencies. The full audit reports **16 moderate, 0 high, 0 critical** findings in the development lint dependency graph, rooted in [minimatch GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). npm proposes breaking downgrades of ESLint/Next's lint config, so no forced downgrade or incompatible transitive-major override was applied. These tools process repository files during development and are not served in the frontend runtime.

## Browser coverage

Prior desktop/mobile checks covered both routes, all cached logos, chart resizing, indicator/timeframe controls, modal focus handling, Escape dismissal, balance validation, wallet/activity updates, deposit/withdraw review, and video error fallback. Final production-server checks are recorded below.

Reduced motion uses CSS and a matchMedia listener that pauses/unloads the video and displays the extracted still. This branch was code-reviewed; gstack's CDP allowlist blocks media-preference emulation, so OS-level reduced-motion verification remains a manual check.

## Vercel import

Use repository `rikokurnia/portix`, branch `main`, Root Directory `.`, Next.js preset, Node.js 22.x, install `npm ci`, build `npm run build`, and the default output directory. `vercel.json` supplies these commands. No deployment was performed as part of this repository push.

### Final production-server results (Node.js 22, `npm start`)

- Market returned 200 and rendered its chart at 390×844 and 1280×800. Both document widths matched the viewport; the five-stock selector scrolls inside its own panel on mobile. All logos loaded; seven chart canvases rendered; no browser console errors.
- Buying with 300 pUSDC credited exactly 0.999 AAPL and reduced pUSDC from 2,500 to 2,200. Client navigation to Vault retained the 4.999 AAPL wallet balance and completed Buy activity.
- Selling 1 AAPL displayed and credited 299.70 pUSDC; account balance became 2,499.70. Escape dismissed each modal.
- The final mobile grid fix sets `min-width: 0` on Market panels and uses a bounded grid track, preventing the selector's intrinsic width from expanding the page.
