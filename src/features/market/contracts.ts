// Deployment is pending. Never present fixture addresses as verified contracts.
import type { MarketStockId } from "./types";

export const PORTALDOT_NETWORK = {
  name: "Portaldot Network V3.0 (EVM Testnet)",
  chainId: 420420777,
  rpcUrl: "https://test-evm-rpc-v3.portaldot.dev",
  explorerUrl: "https://scanner-testnet-v3.portaldot.dev/",
} as const;

export interface ContractItem {
  name: string;
  symbol?: string;
  address: string;
  role: string;
  description: string;
}

export const CORE_CONTRACTS: Record<string, ContractItem> = {
  stockMarket: {
    name: "StockMarket",
    symbol: "pMARKET",
    address: "",
    role: "Planned Spot Conversion & Settlement",
    description:
      "Planned stock-market interface. Current frontend buys and sells update the shared local portfolio with a 0.10% fee.",
  },
  priceOracle: {
    name: "PortixPriceOracle",
    symbol: "pORACLE",
    address: "",
    role: "Planned Price Oracle",
    description:
      "Oracle contract interface for a future deployment. No live equity price adapter is connected.",
  },
  debtPool: {
    name: "PortixDebtPool",
    symbol: "pDEBT",
    address: "",
    role: "Planned Borrow Liquidity Pool",
    description:
      "Planned borrowing allocation pool for vault strategies. Not deployed.",
  },
  pUSDC: {
    name: "Portix USD Coin",
    symbol: "pUSDC",
    address: "",
    role: "Settlement Currency (ERC-20, 6 decimals)",
    description:
      "Local pUSDC settlement model for frontend balances. No issuer backing or deployed token is claimed.",
  },
};

export const STOCK_TOKEN_CONTRACTS: Record<
  MarketStockId,
  {
    tokenSymbol: string;
    tokenName: string;
    contractAddress: string;
    decimals: number;
    category: "Big Tech" | "Index ETF" | "Semiconductors";
    primeVaultAddress: string;
    boostVaultAddress: string;
  }
> = {
  AAPL: {
    tokenSymbol: "pAAPL",
    tokenName: "Apple Inc. Synthetic Token",
    contractAddress: "",
    decimals: 18,
    category: "Big Tech",
    primeVaultAddress: "",
    boostVaultAddress: "",
  },
  GOOGL: {
    tokenSymbol: "pGOOGL",
    tokenName: "Alphabet Inc. Synthetic Token",
    contractAddress: "",
    decimals: 18,
    category: "Big Tech",
    primeVaultAddress: "",
    boostVaultAddress: "",
  },
  NFLX: {
    tokenSymbol: "pNFLX",
    tokenName: "Netflix Inc. Synthetic Token",
    contractAddress: "",
    decimals: 18,
    category: "Big Tech",
    primeVaultAddress: "",
    boostVaultAddress: "",
  },
  MSFT: {
    tokenSymbol: "pMSFT",
    tokenName: "Microsoft Corp. Synthetic Token",
    contractAddress: "",
    decimals: 18,
    category: "Big Tech",
    primeVaultAddress: "",
    boostVaultAddress: "",
  },
  META: {
    tokenSymbol: "pMETA",
    tokenName: "Meta Platforms Inc. Synthetic Token",
    contractAddress: "",
    decimals: 18,
    category: "Big Tech",
    primeVaultAddress: "",
    boostVaultAddress: "",
  },
  SPY: {
    tokenSymbol: "pSPY",
    tokenName: "SPDR S&P 500 ETF Trust Synthetic Token",
    contractAddress: "",
    decimals: 18,
    category: "Index ETF",
    primeVaultAddress: "",
    boostVaultAddress: "",
  },
  QQQ: {
    tokenSymbol: "pQQQ",
    tokenName: "Invesco QQQ Trust Synthetic Token",
    contractAddress: "",
    decimals: 18,
    category: "Index ETF",
    primeVaultAddress: "",
    boostVaultAddress: "",
  },
  NVDA: {
    tokenSymbol: "pNVDA",
    tokenName: "NVIDIA Corp. Synthetic Token",
    contractAddress: "",
    decimals: 18,
    category: "Semiconductors",
    primeVaultAddress: "",
    boostVaultAddress: "",
  },
};

export function getExplorerAddressUrl(address: string): string | undefined {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return undefined;
  return `${PORTALDOT_NETWORK.explorerUrl}#/address/${address}`;
}

export function formatTruncatedAddress(address: string): string {
  if (!address) return "Not deployed";
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
