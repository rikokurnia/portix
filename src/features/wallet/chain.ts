import { defineChain } from "viem";
// Network parameters from the PORTIX Portaldot V3 handoff. No signing material.
export const portaldot = defineChain({
  id: 420420777,
  name: "Portaldot V3",
  nativeCurrency: { name: "Portaldot", symbol: "tPOT", decimals: 14 },
  rpcUrls: { default: { http: ["https://test-evm-rpc-v3.portaldot.dev"] } },
  blockExplorers: {
    default: {
      name: "Portaldot Explorer",
      url: "https://scanner-testnet-v3.portaldot.dev/",
    },
  },
  testnet: true,
});
export const isPortaldotChain = (chainId: string) =>
  chainId === `eip155:${portaldot.id}` ||
  chainId === String(portaldot.id) ||
  chainId.toLowerCase() === `0x${portaldot.id.toString(16)}`;
export const shortAddress = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;
