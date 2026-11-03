"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink, ShieldCheck, Layers } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import {
  PORTALDOT_NETWORK,
  CORE_CONTRACTS,
  STOCK_TOKEN_CONTRACTS,
  getExplorerAddressUrl,
} from "./contracts";
import { MARKET_STOCK_IDS, MARKET_STOCKS } from "./fixtures";

interface ContractsModalProps {
  onClose: () => void;
}

export function ContractsModal({ onClose }: ContractsModalProps) {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const copyToClipboard = (address: string) => {
    if (!address) return;
    void navigator.clipboard
      .writeText(address)
      .catch(() => setCopiedAddress(null));
    setCopiedAddress(address);
    setTimeout(() => {
      setCopiedAddress(null);
    }, 1800);
  };

  const modalTitle = (
    <div className="trade-modal-title">
      <ShieldCheck size={26} color="#2dd4bf" />
      <div>
        <span>Portaldot V3 Contract Plan</span>
        <span className="trade-modal-token-sub">
          Chain ID {PORTALDOT_NETWORK.chainId} · EVM Testnet
        </span>
      </div>
    </div>
  );

  return (
    <Modal title={modalTitle} onClose={onClose}>
      <div className="contracts-modal-content">
        <p className="muted" style={{ fontSize: 12, marginBottom: 16 }}>
          PORTIX has not been deployed. Contract addresses and explorer
          verification will be available after deployment.
        </p>
        {/* Network Specs Banner */}
        <div className="contracts-network-banner">
          <div className="contracts-net-item">
            <span className="contracts-net-label">Network</span>
            <strong>{PORTALDOT_NETWORK.name}</strong>
          </div>
          <div className="contracts-net-item">
            <span className="contracts-net-label">Chain ID</span>
            <strong>{PORTALDOT_NETWORK.chainId}</strong>
          </div>
          <div className="contracts-net-item">
            <span className="contracts-net-label">Explorer</span>
            <a
              href={PORTALDOT_NETWORK.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="contracts-net-link"
            >
              scanner-testnet-v3.portaldot.dev <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {/* Core Protocols Section */}
        <div className="contracts-section">
          <h3>
            <Layers size={16} /> Core Protocol Contracts
          </h3>
          <div className="contracts-list">
            {Object.entries(CORE_CONTRACTS).map(([key, item]) => {
              const isCopied = !!item.address && copiedAddress === item.address;
              return (
                <div key={key} className="contract-card">
                  <div className="contract-card-header">
                    <div className="contract-card-name">
                      <strong>{item.name}</strong>
                      <span className="contract-role-badge">{item.role}</span>
                    </div>
                    <div className="contract-card-actions">
                      <button
                        type="button"
                        className="contract-icon-btn"
                        title="Copy address"
                        disabled={!item.address}
                        onClick={() => copyToClipboard(item.address)}
                      >
                        {isCopied ? (
                          <Check size={14} color="#2dd4bf" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                      <a
                        href={getExplorerAddressUrl(item.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="contract-icon-btn"
                        title="View on Explorer"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                  <code className="contract-code">
                    {item.address || "Not deployed"}
                  </code>
                  <p className="contract-desc">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tokenized Stock & ETF Contracts */}
        <div className="contracts-section">
          <h3>Synthetic Equity & Index ETF Tokens (ERC-20)</h3>
          <div className="contracts-table-wrap">
            <table className="contracts-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Type</th>
                  <th>Token Contract</th>
                  <th>Decimals</th>
                  <th>Explorer</th>
                </tr>
              </thead>
              <tbody>
                {MARKET_STOCK_IDS.map((id) => {
                  const stock = MARKET_STOCKS[id];
                  const token = STOCK_TOKEN_CONTRACTS[id];
                  const isCopied =
                    !!token.contractAddress &&
                    copiedAddress === token.contractAddress;

                  return (
                    <tr key={id}>
                      <td>
                        <div className="contracts-token-cell">
                          <img src={stock.logo} alt="" width={20} height={20} />
                          <div>
                            <strong>{token.tokenSymbol}</strong>
                            <small>{stock.name}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`contract-cat-badge ${token.category.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          {token.category}
                        </span>
                      </td>
                      <td>
                        <div className="contracts-addr-cell">
                          <code>
                            {token.contractAddress
                              ? `${token.contractAddress.slice(0, 8)}...${token.contractAddress.slice(-6)}`
                              : "Not deployed"}
                          </code>
                          <button
                            type="button"
                            className="contract-mini-copy"
                            title="Copy address"
                            disabled={!token.contractAddress}
                            onClick={() =>
                              copyToClipboard(token.contractAddress)
                            }
                          >
                            {isCopied ? (
                              <Check size={12} color="#2dd4bf" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      </td>
                      <td>{token.decimals}</td>
                      <td>
                        <a
                          href={getExplorerAddressUrl(token.contractAddress)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="contracts-scan-btn"
                          title="Inspect on Portaldot Explorer"
                        >
                          {token.contractAddress ? (
                            <>
                              Scan <ExternalLink size={11} />
                            </>
                          ) : (
                            "Not deployed"
                          )}
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Close button */}
        <div className="trade-actions" style={{ marginTop: "1.25rem" }}>
          <button
            type="button"
            className="button market-btn-buy"
            style={{ width: "100%" }}
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
