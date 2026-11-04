import { ExternalLink } from "lucide-react";
import { explorerTransaction } from "@/lib/onchain/contracts";
export function TransactionLink({ hash }: { hash: string }) {
  return (
    <a
      className="transaction-link"
      href={explorerTransaction(hash)}
      target="_blank"
      rel="noreferrer"
      title={hash}
      aria-label={`View transaction ${hash} on Portaldot`}
    >
      <img src="/assets/portaldot.png" alt="Portaldot" width={18} height={18} />
      <span>
        {hash.slice(0, 8)}…{hash.slice(-6)}
      </span>
      <ExternalLink size={12} />
    </a>
  );
}
