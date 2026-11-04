# Vercel configuration

Set one environment variable before deploying:

```dotenv
APP_ID_PRIVY=<your Privy App ID>
```

Use the same **App ID** as local project `.env`, not the App Secret. Enable it for Production and any Preview environments you use, then redeploy. The layout reads it during the build; adding it without redeploying does not update the existing deployment.

In Privy Dashboard, allow your exact production/preview/custom-domain origins and enable Ethereum wallet login. Talisman needs its EVM account. Once Privy is ready, Connect wallet opens login. Faucet can also open login; after login it opens the 5,000 pUSDC claim form. The wallet signs the claim and needs tPOT for gas. No background auto-claim occurs.

Do not configure `DEPLOYER_PRIVATE_KEY`, `PRIVATE_KEY`, seed/mnemonic or `APP_SECRET_PRIVY` in Vercel. They are not needed. No additional API key is needed for the public Portaldot RPC or current Vault protocol feed.

Next.js, Node 22.x, build `npm run build`. Importing the GitHub portix repository uses its root; if importing the containing workspace select `project` as Root Directory.

Contract addresses are public configuration in src/lib/onchain/addresses.json. See CONTRACT_INTEGRATION_FINDINGS.md before enabling Vault writes. Login and Faucet do not require the unresolved Vault accounting interface.
