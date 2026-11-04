"use client";
import { useState } from "react";
import {
  useCreateWallet,
  useLogin,
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";
import { Check, Copy, LogOut, Plus, Wallet } from "lucide-react";
import { Button } from "@/components/shared/Button";
import { Modal } from "@/components/shared/Modal";
import { useWalletConfigured } from "./WalletProvider";
import { useWalletSelection } from "./selection";
import { isPortaldotChain, portaldot, shortAddress } from "./chain";
import "./wallet.css";
export function WalletControl() {
  const configured = useWalletConfigured();
  if (!configured)
    return (
      <Button
        variant="secondary"
        disabled
        title="Wallet connection is unavailable"
      >
        <Wallet size={16} />
        <span>Connect wallet</span>
      </Button>
    );
  return <ConnectedWalletControl />;
}
function ConnectedWalletControl() {
  const { ready, authenticated, user, logout, linkWallet } = usePrivy(),
    { wallets, ready: walletsReady } = useWallets(),
    { createWallet } = useCreateWallet();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [copied, setCopied] = useState("");
  const { selected, setSelected } = useWalletSelection();
  const active =
    wallets.find((wallet) => wallet.address === selected) ??
    wallets.find((wallet) => wallet.address === user?.wallet?.address) ??
    wallets[0];
  const { login } = useLogin({
    onComplete: () => setError(""),
    onError: (code) => {
      if (/exited|cancel/i.test(String(code))) return;
      setError("Unable to sign in. Please try again.");
    },
  });
  async function switchNetwork() {
    if (!active) return;
    setError("");
    setBusy(true);
    setOpen(false);
    try {
      await active.switchChain(portaldot.id);
    } catch {
      setError("Network switch was not completed. Try again in your wallet.");
    } finally {
      setBusy(false);
      setOpen(true);
    }
  }
  async function createEmbeddedWallet() {
    setError("");
    setBusy(true);
    setOpen(false);
    try {
      const wallet = await createWallet();
      setSelected(wallet.address);
    } catch {
      setError("Unable to create your wallet. Please try again.");
    } finally {
      setBusy(false);
      setOpen(true);
    }
  }
  async function signOut() {
    setError("");
    setBusy(true);
    try {
      await logout();
      setOpen(false);
      setSelected("");
      setCopied("");
    } catch {
      setError("Unable to sign out. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function copyAddress() {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(active.address);
      setCopied(active.address);
    } catch {
      setError("Select the address below to copy it.");
    }
  }
  function connect() {
    setError("");
    if (authenticated) setOpen(true);
    else login();
  }
  return (
    <>
      <Button
        variant="secondary"
        disabled={!ready || busy}
        aria-label={authenticated ? "Open wallet account" : "Connect wallet"}
        onClick={connect}
      >
        <Wallet size={16} />
        <span>
          {!ready
            ? "Loading wallet…"
            : authenticated
              ? active
                ? shortAddress(active.address)
                : "My account"
              : "Connect wallet"}
        </span>
      </Button>
      {error && !open && (
        <div className="wallet-notice" role="alert">
          {error}
          <button
            type="button"
            aria-label="Dismiss wallet error"
            onClick={() => setError("")}
          >
            ×
          </button>
        </div>
      )}
      {open && authenticated && (
        <Modal title="Your wallet" onClose={() => setOpen(false)}>
          {user?.email?.address && (
            <p className="wallet-email">{user.email.address}</p>
          )}
          {!walletsReady ? (
            <p className="muted">Loading your wallets…</p>
          ) : active ? (
            <>
              <div className="wallet-account-heading">
                <Wallet size={25} />
                <div>
                  <strong>
                    {active.walletClientType === "privy"
                      ? "PORTIX wallet"
                      : active.meta.name || "Connected wallet"}
                  </strong>
                  <span>
                    {active.walletClientType === "privy"
                      ? "Embedded wallet"
                      : "External wallet"}
                  </span>
                </div>
              </div>
              {wallets.length > 1 && (
                <label className="wallet-select-label">
                  Active wallet
                  <select
                    value={active.address}
                    onChange={(event) => {
                      setSelected(event.target.value);
                      setCopied("");
                      setError("");
                    }}
                  >
                    {wallets.map((wallet) => (
                      <option key={wallet.address} value={wallet.address}>
                        {shortAddress(wallet.address)} ·{" "}
                        {wallet.walletClientType === "privy"
                          ? "PORTIX"
                          : wallet.meta.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="wallet-address">
                <code>{active.address}</code>
                <button
                  type="button"
                  onClick={copyAddress}
                  aria-label={
                    copied === active.address
                      ? "Address copied"
                      : "Copy wallet address"
                  }
                >
                  {copied === active.address ? (
                    <Check size={17} />
                  ) : (
                    <Copy size={17} />
                  )}
                </button>
              </div>
              <div className="wallet-network">
                <span>Network</span>
                <strong>
                  {isPortaldotChain(active.chainId)
                    ? portaldot.name
                    : "Another network"}
                </strong>
              </div>
              {!isPortaldotChain(active.chainId) && (
                <Button
                  className="full-width"
                  disabled={busy}
                  onClick={() => void switchNetwork()}
                >
                  Switch to Portaldot
                </Button>
              )}
            </>
          ) : (
            <div className="wallet-empty">
              <Wallet size={34} />
              <h3>Create your wallet</h3>
              <p>Keep a wallet with your PORTIX account.</p>
              <Button
                className="full-width"
                disabled={busy || !walletsReady}
                onClick={() => void createEmbeddedWallet()}
              >
                Create wallet
              </Button>
            </div>
          )}
          {error && (
            <p className="wallet-error" role="alert">
              {error}
            </p>
          )}
          <div className="wallet-account-actions">
            <Button
              variant="secondary"
              className="full-width"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setError("");
                linkWallet();
              }}
            >
              <Plus size={16} />
              Link another wallet
            </Button>
            <Button
              variant="ghost"
              className="full-width"
              disabled={busy}
              onClick={() => void signOut()}
            >
              <LogOut size={16} />
              Sign out
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
