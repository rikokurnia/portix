"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { WalletSelection } from "./selection";
import { PortfolioSync } from "./PortfolioSync";
import { NativeWalletProvider } from "./NativeWalletProvider";
import { portaldot } from "./chain";
const WalletConfigured = createContext(false);
export const useWalletConfigured = () => useContext(WalletConfigured);
function EvmProvider({
  appId,
  children,
}: {
  appId: string;
  children: ReactNode;
}) {
  const [selected, setSelected] = useState("");
  if (!appId)
    return (
      <WalletConfigured.Provider value={false}>
        <PortfolioSync nativeOnly />{children}
      </WalletConfigured.Provider>
    );
  return (
    <WalletConfigured.Provider value={true}>
      <PrivyProvider
        appId={appId}
        config={{
          loginMethods: ["wallet", "email"],
          appearance: {
            theme: "#211D31",
            accentColor: "#BE8AF5",
            logo: "/assets/logo.png",
            walletChainType: "ethereum-only",
          },
          embeddedWallets: {
            ethereum: { createOnLogin: "users-without-wallets" },
          },
          defaultChain: portaldot,
          supportedChains: [portaldot],
        }}
      >
        <WalletSelection.Provider value={{ selected, setSelected }}>
          <PortfolioSync />
          {children}
        </WalletSelection.Provider>
      </PrivyProvider>
    </WalletConfigured.Provider>
  );
}

export function WalletProvider(props:{appId:string;children:ReactNode}) { return <NativeWalletProvider><EvmProvider {...props}/></NativeWalletProvider>; }
