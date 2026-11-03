# Vault detail experience

- `/vault` keeps two concise strategy cards and the shared portfolio. Deposit opens `/vault/pxPrime` or `/vault/pxBoost`.
- Each detail page has a large left information panel (Chart / About) and a right Deposit / Withdraw form, approximately 70:30 on desktop. The page reserves space for the supplied upper-right mascot. Mobile stacks the panels without page overflow.
- The form uses the same account actions as Market, with balance validation, up to six decimals, percentage shortcuts, stock-to-share conversion, proportional redemption, and inline success/error feedback. There is no review popup or wallet request. Market's Earn button and portfolio Manage actions use the same detail pages.
- The route animation is interactive: choose a node to pause and inspect it, or play/restart the loop. It explains collateral → 40% pUSDC borrow allocation → Portaldot bridge route → destination protocols → vault receipt. Reduced-motion preferences pause automatic playback and remove animated effects. It is a route preview, not a record of bridge execution.

## Public data

`src/lib/vault-market-data.ts` defines public benchmark sources. `useVaultMarketData.ts` shares one client cache across consumers and refreshes requests every 60 seconds. The first render has no invented APY/TVL. Errors retain available observations with an explicit warning and Retry control. No API keys or backend are required.

| Protocol | Chain | Benchmark | DefiLlama pool ID |
| --- | --- | --- | --- |
| Morpho | Base | STEAKUSDC | `ba68527f-8ec2-4c55-827a-8f4673ae047c` |
| Aave V3 | Ethereum | USDC | `aa70268e-4b52-42bf-a116-608b370f9501` |
| Compound III | Ethereum | USDC | `7da72d09-56ca-4ec5-a45f-59114353e487` |
| Uniswap V3 | Ethereum | USDC / WETH 0.05% | `665dc8bc-c79d-4800-97f7-304bf368e547` |

Pool identities were checked against `https://yields.llama.fi/pools`. History comes from `https://yields.llama.fi/chart/{poolId}`. Lending series use `apy`; Uniswap uses `apyBase` (fee yield). pxPrime's headline rate is TVL-weighted across its three benchmarks. TVL is the source markets' benchmark TVL, not PORTIX deposits. Displayed source observation times are separate from the browser's 60-second refresh schedule. The provider may update observations less frequently; these are not tick-by-tick feeds or realized/net returns on stock collateral.

Daily points are validated, sorted in UTC, and deduplicated using the newest observation per date. Invalid/missing feeds do not generate substitute rates. Charts support 7D / 30D and use Lightweight Charts 5 area series with restrained gradient fills. Financial account balances and stock prices retain the shared frontend fixture behavior.

## Contracts and multichain routing

About links to the destination protocols' core contracts and official address references, distinctly from benchmark pool instances and PORTIX adapters. Morpho's benchmark is on Base, not Ethereum. Aave, Compound and Uniswap benchmarks are on Ethereum.

The user confirmed PORTIX has not been deployed. The Portaldot contract and bridge adapter sections therefore show unconfigured deployment status. No addresses, bridge transfers, transaction hashes, or settlement confirmations are fabricated. Smart contracts remain excluded and untouched.

## Assets and references

- USDC: locally cached from the Trust Wallet asset registry: `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png`. Visually verified USDC emblem. The logo illustrates settlement currency; local pUSDC is not claimed to be Circle-issued USDC.
- Portaldot: locally cached from Google's favicon API for the official `portaldot.world` domain, requested at 128px. Visually verified gradient P mark.
- Protocol and vault identities reuse the existing supplied/cached artwork. Bridge uses a standard directional icon, not an invented bridge brand.
- Morpho addresses: https://docs.morpho.org/get-started/resources/addresses/
- Aave address book: https://github.com/bgd-labs/aave-address-book/blob/main/src/AaveV3Ethereum.sol
- Compound Comet addresses: https://github.com/compound-finance/comet/blob/main/deployments/mainnet/usdc/roots.json
- Uniswap deployments: https://docs.uniswap.org/contracts/v3/reference/deployments/ethereum-deployments

## Checks

Typecheck, lint, account/Market tests, yield-source normalization tests, and production build. Browser checks cover actual CORS-enabled public feeds, desktop/mobile sizing, no review dialog, inline deposit and withdrawal, About disclosure, route navigation, 7D/30D chart switching, chart resizing, animation play/pause/restart, and error handling.
