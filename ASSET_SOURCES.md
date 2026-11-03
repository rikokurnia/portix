# Assets and fixture provenance

- `public/assets/logo.png`: supplied PORTIX identity; shared navbar.
- `video-bg.mp4`: supplied shared background, including mascot. No additional mascot artwork.
- `background.jpg`: unmodified composition extracted at 1 second from the supplied video with FFmpeg; poster, failed-video and reduced-motion fallback.
- `vault-prime.png`, `vault-boost.png`: supplied vault identities; cards, portfolio and detail form.
- `../random/design-reference/vault-2card.png`: HTML strategy-card visual reference.
- `../random/design-reference/vault-portfolio.png`: HTML portfolio visual reference.
- `../random/design-reference/vault-deposit.png`: original form hierarchy reference; the form now lives on a Vault detail page.
- Morpho (`morpho`), Aave (`aave`), Compound (`compound-governance-token`), Uniswap (`uniswap`): CoinGecko coin metadata API, then downloaded `image.small`. Each image visually verified against its identity. Exact returned image URLs in `public/assets/sources.json`.
- Apple, Google/Alphabet, Netflix, Microsoft, Meta: Google's domain favicon API, downloaded at requested 128px and visually inspected. Domain-to-ticker mappings and URLs in `sources.json`. No API secrets or runtime network requests.
- TradingView notice in `public/assets/LIGHTWEIGHT_CHARTS_NOTICE.txt`; charts retain built-in TradingView attribution links.

Stock prices, opening account balances, and earned portfolio yield remain frontend fixtures in `src/lib/assets.ts` and `src/lib/portfolio-store.ts`. Vault protocol APYs, benchmark TVL, and chart histories now come from public DefiLlama feeds defined in `src/lib/vault-market-data.ts`; the old fixed Vault chart samples and volume values are removed. Source identities, timestamps, new USDC/Portaldot logo provenance, and refresh behavior are documented in `VAULT_EXPERIENCE.md`. Share conversion: collateral USD value / $100 (pxPrime) or $125 (pxBoost). Deposits start with zero earned yield; opening positions include a fixed earned amount. Withdrawals return proportional original stock and earned pUSDC. There is no time-based accrual, server, transaction, wallet SDK, or explorer integration. State resets on reload.

Documentation checked via Context7, local 5.2.1 typings and official [Lightweight Charts docs](https://tradingview.github.io/lightweight-charts/docs) through Firecrawl. Requested design and React skills installed from their official GitHub repositories.

Release integration: the shared price fixtures are AAPL $300, GOOGL $300, NFLX $120, MSFT $510, META $720. Market quotes use these same prices. Opening vault shares are derived from these prices at the fixed $100/$125 share values. Trading fees are 0.1% and are included in the actual local account balance changes.
