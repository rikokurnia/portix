"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandIcon } from "./BrandIcon";
import { WalletControl } from "@/features/wallet/WalletControl";
import { FaucetControl } from "@/components/faucet/FaucetControl";

export function Navbar() {
  const path = usePathname();
  return (
    <>
      <header className="navbar">
        <Link className="wordmark" href="/vault" aria-label="PORTIX home">
          <BrandIcon size={44} />
          <span>PORTIX</span>
        </Link>
        <nav className="segmented" aria-label="Primary navigation">
          {["Vault", "Market"].map((label) => (
            <Link
              key={label}
              aria-current={
                path === `/${label.toLowerCase()}` ||
                path.startsWith(`/${label.toLowerCase()}/`)
                  ? "page"
                  : undefined
              }
              href={`/${label.toLowerCase()}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="navbar-actions">
          <FaucetControl />
          <WalletControl />
        </div>
      </header>
    </>
  );
}
