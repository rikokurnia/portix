"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Wallet } from "lucide-react";
import { BrandIcon } from "./BrandIcon";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { money } from "@/lib/assets";
import { usePortfolio } from "@/lib/portfolio-store";
export function Navbar() {
  const path = usePathname(),
    [open, setOpen] = useState(false);
  const { pUSDC } = usePortfolio();
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
        <Button variant="secondary" onClick={() => setOpen(true)}>
          <Wallet size={16} />
          <span>My account</span>
        </Button>
      </header>
      {open && (
        <Modal title="Your account" onClose={() => setOpen(false)}>
          <p className="muted">Your PORTIX portfolio</p>
          <div className="account-balance">
            <span>Available pUSDC</span>
            <strong>{money(pUSDC)}</strong>
          </div>
          <Button className="full-width" onClick={() => setOpen(false)}>
            Back to portfolio
          </Button>
        </Modal>
      )}
    </>
  );
}
