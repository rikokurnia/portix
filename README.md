# portix

PORTIX is a frontend for tokenized-stock trading and carry-yield vaults. It includes Market, pxPrime and pxBoost vaults, direct deposit/withdraw forms, interactive TradingView Lightweight Charts, and one shared portfolio with wallet holdings and activity.

## Run locally

Use Node.js 22 LTS (also pinned in `.nvmrc` and `package.json`).

```sh
npm ci
npm run dev
```

Open the local URL printed by Next.js. `/` redirects to `/vault`; Market is at `/market`.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

## Deploy on Vercel

Import **rikokurnia/portix**, select branch **main**, and use:

| Setting | Value |
| --- | --- |
| Root Directory | `.` (repository root) |
| Framework Preset | Next.js |
| Node.js | 22.x |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | Leave the Next.js default |
| Environment Variables | **None required** |

`vercel.json` contains the framework, install, and build settings. The contents of the local `project/` folder form the repository root; do not set Vercel's Root Directory to `project`. See Vercel's [Next.js support](https://vercel.com/docs/frameworks/full-stack/nextjs) and [Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

## Data and account behavior

Stock prices, Market candles, account balances, and portfolio activity are local fixtures. Vault protocol APY/TVL and history are fetched from public DefiLlama endpoints, with visible source timestamps and a 60-second refresh schedule. These benchmark rates are not PORTIX realized returns. Account state survives client route navigation and resets on reload. Market quotes and account actions share a 0.1% trade-fee calculation. Vault shares are calculated from collateral USD value: $100 per pxPrime share and $125 per pxBoost share. Withdrawals return proportional collateral and earned pUSDC.

No API key, RPC URL, wallet SDK, backend, database, private key, or signing operation is required. Brand assets are cached locally and charts run in the browser. Never add private keys or credentials to `NEXT_PUBLIC_*` variables or frontend code.

The local `contracts/` directory is intentionally excluded from this frontend repository and Vercel uploads. Environment files, local credentials, build output, and dependencies are also ignored. Contract source files remain untouched locally.

## Developer references

- [Shared interface](./SHARED_INTERFACE.md)
- [Vault and shared asset sources](./ASSET_SOURCES.md)
- [Market asset sources](./ASSET_SOURCES_MARKET.md)
- [Integration and release validation](./VALIDATION.md)
- [Market implementation notes](./VALIDATION_MARKET.md)

## Vault detail pages

Deposit opens `/vault/pxPrime` or `/vault/pxBoost`, with Chart/About tabs on the left and a direct account form on the right. The interactive carry animation explains the planned multichain route. PORTIX/bridge contracts remain undeployed; About lists destination protocol contracts separately. See [Vault data sources and behavior](./VAULT_EXPERIENCE.md).
