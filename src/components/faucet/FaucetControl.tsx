"use client";
import { useEffect, useRef, useState } from "react";
import {useNativeWallet} from "@/features/wallet/NativeWalletProvider";
import { Droplets, CheckCircle2 } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { TransactionLink } from "@/components/shared/TransactionLink";
import { usePortfolio } from "@/lib/portfolio-store";
import { shortAddress } from "@/features/wallet/chain";
import "./faucet.css";
export function FaucetControl() {
  const account = usePortfolio();
  const [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [hash, setHash] = useState(""),
    [working, setWorking] = useState(false);
  const wallet=useNativeWallet();
  const requested=useRef(false);
  useEffect(()=>{if(requested.current&&account.address){requested.current=false;setOpen(true);}},[account.address]);
  async function claim() {
    if (working || !account.address) return;
    setWorking(true);
    setError("");
    try {
      const result = await account.claimFaucet();
      if (result.ok) setHash(result.hash);
      else setError(result.error);
    } finally {
      setWorking(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="faucet-trigger-btn"
        aria-label="Faucet"
        disabled={wallet.connecting}
        onClick={() => {
          if (!account.address) {
            requested.current = true;
            wallet.setOpen(true);
            return;
          }
          setOpen(true);
          setHash("");
          setError("");
        }}
        title={
          account.address
            ? "Get 5,000 pUSDC"
            : "Connect your wallet to use the faucet"
        }
      >
        <Droplets size={16} />
        <span>Faucet</span>
      </button>
      {open && (
        <Modal title="pUSDC Faucet" onClose={() => setOpen(false)}>
          <div className="faucet-container">
            {hash ? (
              <>
                <CheckCircle2 size={32} className="positive" />
                <h3>5,000 pUSDC received</h3>
                <TransactionLink hash={hash} />
                <p className="muted">Saved to your portfolio Activity.</p>
                <button
                  className="button full-width"
                  onClick={() => setOpen(false)}
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <p className="faucet-intro">
                  Receive pUSDC in your connected wallet to trade stocks and
                  enter a vault.
                </p>
                <div className="faucet-card">
                  <div className="faucet-network-row">
                    <span>Portaldot V3</span>
                    <strong>
                      {account.address
                        ? shortAddress(account.address)
                        : "Connect wallet"}
                    </strong>
                  </div>
                  <div className="faucet-amount-display">
                    <strong className="faucet-amount-num">5,000</strong>
                    <span>pUSDC</span>
                  </div>
                </div>
                <p className="muted">
                  A small amount of tPOT covers the network fee.
                </p>
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
                <button
                  type="button"
                  className="faucet-btn-primary"
                  disabled={!account.address || working || !!account.pending}
                  onClick={() => void claim()}
                >
                  {working
                    ? account.pending || "Processing…"
                    : "Claim 5,000 pUSDC"}
                </button>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
