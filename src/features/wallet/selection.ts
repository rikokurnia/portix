"use client";
import { createContext, useContext } from "react";
export const WalletSelection = createContext<{
  selected: string;
  setSelected: (address: string) => void;
}>({ selected: "", setSelected: () => {} });
export const useWalletSelection = () => useContext(WalletSelection);
