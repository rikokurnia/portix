# PORTIX shared interface

Work inside `project/`. Foundation owner: Agent 1. Market owner: Agent 2 (`src/app/market/page.tsx`, `src/features/market/**`). Do not change root layout, global CSS, manifests, shared components, asset manifest, or account store without coordinating. Market is implemented and uses the shared store, components, and Vault deposit modal.

Next.js App Router, React 19, TypeScript, Tailwind 4, Lucide, Lightweight Charts 5. Run `npm run dev`.

```tsx
"use client";
import { usePortfolio } from "@/lib/portfolio-store";
import { stocks, stockIds, money, units, type StockId } from "@/lib/assets";
import { Button } from "@/components/shared/Button";
import { Panel } from "@/components/shared/Panel";
import { Modal } from "@/components/shared/Modal";
const { pUSDC, stockBalances, positions, activity, buyStock, sellStock } =
  usePortfolio();
const result = buyStock("AAPL", 0.5); // stock quantity, NOT pUSDC spend
if (!result.ok) console.log(result.error);
```

Actions return `{ok:true}|{ok:false,error:string}` synchronously. Also exported individually: `buyStock(stockId, quantity, totalPayment?)`, `sellStock(stockId, quantity)`, `depositToVault(vaultId,stockId,quantity)`, `withdrawFromVault(vaultId,stockId,shares)`. All amounts max 6 decimals; stock IDs AAPL/GOOGL/NFLX/MSFT/META, vault IDs pxPrime/pxBoost. Store is in memory and shared across route navigation. Reload resets fixtures. Never create a second account store.

`Button`: native button props + variant primary/secondary/ghost. `Panel`: section props. `Modal`: title/onClose/children, native dialog focus trap, Escape, focus restoration. `BrandIcon`: brand logo/pxPrime/pxBoost + size. `Chart`: series with name/color/logo/values, optional height, seven ISO date strings supplied by caller. Global `.page`, `.muted`, `.positive`, `.full-width`, `.segmented` available. Keep Market styles scoped in its own CSS/module.

Fixture stock prices in `assets.ts` are shared with Market. Share value = $100 pxPrime / $125 pxBoost; minted shares = collateral quantity × stock price ÷ share value. Withdrawal proportionally returns stock plus earned yield in pUSDC. Initial borrowing LTV 40%; no external execution or wallet integration.

Integration checks cover build/typecheck/lint, Market buy/sell, Vault wallet/activity continuity, and proportional vault withdrawal. See VALIDATION.md for current release results.

## Integrated release

Market is complete. Its quoted `totalPayment` is passed as the optional third `buyStock` argument so the full reviewed payment, including the 0.1% fee and share-precision remainder, is debited exactly. The store validates that the payment quotes the requested quantity. Two-argument quantity buys add the same fee rate to the stock cost. `sellStock` credits the fee-adjusted payout shown by Market. Shared calculators live in `src/lib/trade-calculations.ts` and are re-exported by the Market calculation module. Opening vault shares derive from the shared stock prices. `npm test` runs both account integration and Market suites.
