# Privy wallet integration

`@privy-io/react-auth` provides email sign-in and external Ethereum-wallet authentication, persistent Privy sessions, embedded-wallet creation, wallet linking, and logout. The navbar now uses Privy's actual session/wallet state instead of the previous account-preview balance.

## Configuration

Set `APP_ID_PRIVY` in local `.env` and in Vercel's environment variables. It is the **public Privy application ID**. The Next.js server layout reads this variable and passes only this ID to the client provider. Missing configuration leaves the wallet button unavailable while the rest of the app renders.

`APP_SECRET_PRIVY` is not used, imported, or passed to browser code. Do not add it to a `NEXT_PUBLIC_*` variable. No Privy app secret is required on Vercel for this client-side sign-in integration.

In the Privy dashboard, enable email/wallet login and embedded Ethereum wallets, and allow the exact production/preview origins you use. Allow local development origins as required by your Privy app configuration. OAuth providers are not hardcoded; this integration enables wallet and email methods only.

## Account controls

- Logged-out users open the Privy sign-in modal with Connect wallet.
- Signed-in users see the connected address and an account modal.
- The modal supports address copying, selecting among connected wallets, linking another wallet, creating an embedded wallet if needed, switching to Portaldot, and sign-out.
- Privy sessions are restored by the SDK across reloads. Login cancellations are handled quietly and operational errors offer a retry.
- Linking and network-change flows close the native account dialog before Privy/wallet UI opens, avoiding competing modal layers.

Portaldot V3 uses chain ID 420420777, the RPC/explorer in the project handoff, and its documented 14-decimal tPOT native asset. No network switching, signature request, or transaction is initiated automatically outside the sign-in/wallet flow. Market and Vault now use the shared on-chain portfolio integration, wallet signatures, token approvals and receipt-confirmed Activity. See INTEGRATION_STATUS.md and docs/onchain-verification.json for the current deployment checks.

## References

- https://docs.privy.io/basics/react/setup
- https://docs.privy.io/basics/troubleshooting/react-frameworks
- https://docs.privy.io/basics/react/advanced/configuring-evm-networks
- https://docs.privy.io/authentication/user-authentication/ui-component
- https://docs.privy.io/authentication/user-authentication/logout

Privy APIs and configuration have been checked against the installed SDK typings. Completing an email OTP or external-wallet authentication requires the user's own browser interaction; no credentials or authentication signatures are fabricated for validation.

## Validation and dependency limits

The real configured Privy app was loaded in a production-browser preview: the email sign-in modal and external-wallet selector opened successfully. The SDK displayed MetaMask, Coinbase and other external wallet options. No OTP was requested and no user authentication signature was fabricated. Full authenticated account/wallet creation and sign-out need a user-owned email or wallet to complete the sign-in flow.

`npm audit --omit=dev` for the installed Privy 3.51.0 dependency tree reports 31 findings (21 high, 10 moderate), primarily inherited through Zod, WalletConnect/query-string and nested websocket dependencies. A compatible `npm audit fix` was applied; remaining suggestions require breaking SDK downgrades or incompatible transitive upgrades and were not forced. These upstream advisories remain a production-hardening limitation and should be rechecked when Privy releases updated dependencies. Do not treat a successful build as a clean dependency security audit.

Final checks: Node.js 22.23.4 typecheck, lint, existing automated tests and production build passed. Desktop and 390px mobile login UI were inspected with real Privy configuration. A byte-level scan of 348 source/built browser and prerendered files found no app-secret value; source code contains no APP_SECRET_PRIVY reference. Local .env remains ignored.
