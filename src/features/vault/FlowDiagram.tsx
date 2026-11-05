"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  BaseEdge,
  getBezierPath,
  type Node,
  type NodeProps,
  type Edge,
  type EdgeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import {
  Maximize2,
  Network,
  ArrowUpRight,
  Check,
  Wallet,
  Radio,
  Layers,
} from "lucide-react";
import { assets, stocks, type StockId, type VaultId } from "@/lib/assets";
import { protocols, vaultProtocols } from "@/lib/vault-market-data";
import "@xyflow/react/dist/style.css";
import "./flow-diagram.css";

import type { VaultProcessPhase as Phase } from "./process-state";
type RouteData = {
  label: string;
  caption: string;
  logo: string;
  color: string;
  kind: "asset" | "hub" | "protocol" | "receipt";
  active: boolean;
  selected: boolean;
  compact: boolean;
  phase: Phase;
  onInspect: (id: string) => void;
};
type RouteNode = Node<RouteData, "route">;
type RouteEdge = Edge<
  {
    color: string;
    moving: boolean;
    reverse: boolean;
    reduced: boolean;
    delay: number;
  },
  "liquidity"
>;

const RouteCard = memo(function RouteCard({ id, data }: NodeProps<RouteNode>) {
  return (
    <button
      type="button"
      className={`route-card route-card-${data.kind} ${data.active ? "is-active" : ""} ${data.selected ? "is-inspected" : ""}`}
      style={{ "--route-color": data.color } as CSSProperties}
      aria-pressed={data.selected}
      aria-label={`Explore ${data.label}`}
      onClick={() => data.onInspect(id)}
    >
      <Handle
        type="target"
        position={data.compact ? Position.Top : Position.Left}
      />
      <div className="route-logo-well">
        {data.kind === "hub" && (
          <>
            <span className="hub-orbit orbit-outer" />
            <span className="hub-orbit orbit-inner" />
            <span className="hub-satellite satellite-one" />
            <span className="hub-satellite satellite-two" />
          </>
        )}
        <img
          src={data.logo}
          alt=""
          width={data.kind === "hub" ? 74 : 40}
          height={data.kind === "hub" ? 74 : 40}
        />
        {data.kind === "hub" && <span className="hub-evm">EVM</span>}
      </div>
      <strong>{data.label}</strong>
      <small>{data.caption}</small>
      {data.kind === "hub" && (
        <div className="hub-capabilities">
          <Network size={11} />
          <span>Multichain hub</span>
        </div>
      )}
      <Handle
        type="source"
        position={data.compact ? Position.Bottom : Position.Right}
      />
    </button>
  );
});

// Uses React Flow's edge coordinates, including responsive layouts and viewport transforms.
const LiquidityEdge = memo(function LiquidityEdge(props: EdgeProps<RouteEdge>) {
  const [path] = getBezierPath(props);
  const data = props.data!;
  return (
    <g className={`liquidity-edge ${data.moving ? "is-moving" : ""}`}>
      <BaseEdge
        id={props.id}
        path={path}
        style={{
          stroke: data.color,
          strokeWidth: 1.3,
          opacity: data.moving ? 0.4 : 0.16,
        }}
      />
      {data.moving && !data.reduced && (
        <>
          <path
            d={path}
            fill="none"
            stroke={data.color}
            strokeWidth={8}
            opacity={0.06}
            className="liquidity-aura"
          />
          {[0, 1, 2].map((index) => (
            <g key={index}>
              <circle r={7} fill={data.color} opacity={0.12} />
              <circle r={2.3} fill={data.color} />
              <circle r={0.8} fill="#fff" />
              <animateMotion
                path={path}
                dur={`${2.6 + data.delay}s`}
                begin={`${-(index * 1.05 + data.delay)}s`}
                repeatCount="indefinite"
                keyPoints={data.reverse ? "1;0" : "0;1"}
                keyTimes="0;1"
                calcMode="linear"
              />
            </g>
          ))}
        </>
      )}
    </g>
  );
});
const nodeTypes = { route: RouteCard };
const edgeTypes = { liquidity: LiquidityEdge };
const descriptions: Record<string, string> = {
  stock:
    "Your selected tokenized stock is the collateral asset for this position.",
  credit:
    "pUSDC is the settlement liquidity used by the carry strategy. The target borrowing allocation is 40% of collateral value.",
  portaldot:
    "Portaldot is the EVM execution hub. Its multichain architecture connects the collateral and settlement sides of the strategy.",
  receipt:
    "Your vault receipt represents the position. Its balance refreshes after the network confirms the transaction.",
  morpho: "Morpho is a lending destination in the pxPrime strategy route.",
  aave: "Aave is a lending destination in the pxPrime strategy route.",
  compound: "Compound is a lending destination in the pxPrime strategy route.",
  uniswap: "Uniswap is the AMM destination in the pxBoost strategy route.",
};

export function FlowDiagram({
  vaultId,
  stockId,
  phase,
  type,
  message,
}: {
  vaultId: VaultId;
  stockId: StockId;
  phase: Phase;
  type: "Deposit" | "Withdraw";
  message?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<ReactFlowInstance<RouteNode, RouteEdge> | null>(null);
  const [compact, setCompact] = useState(false),
    [reduced, setReduced] = useState(false),
    [inspected, setInspected] = useState("portaldot");
  const inspect = useCallback((id: string) => setInspected(id), []);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    let frame = 0;
    const observer = new ResizeObserver((entries) => {
      setCompact(entries[0].contentRect.width < 620);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        void instance.current?.fitView({
          padding: 0.12,
          maxZoom: 1,
          minZoom: 0.45,
        });
      });
    });
    if (host.current) observer.observe(host.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void instance.current?.fitView({
        padding: 0.12,
        maxZoom: 1,
        minZoom: 0.45,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [compact, vaultId]);
  const graph = useMemo(() => {
    const active = phase === "confirming" || phase === "confirmed";
    const signingSource = type === "Deposit" ? "stock" : "receipt";
    const targets = vaultProtocols[vaultId];
    const nodes: RouteNode[] = [];
    function add(
      id: string,
      label: string,
      caption: string,
      logo: string,
      color: string,
      kind: RouteData["kind"],
      x: number,
      y: number,
    ) {
      nodes.push({
        id,
        type: "route",
        position: { x, y },
        style: {
          width: kind === "hub" ? 168 : compact ? 98 : 124,
          height: kind === "hub" ? 198 : kind === "protocol" ? 124 : 142,
        },
        data: {
          label,
          caption,
          logo,
          color,
          kind,
          active:
            phase !== "failed" &&
            (active || id === signingSource || id === "portaldot"),
          selected: id === inspected,
          compact,
          phase,
          onInspect: inspect,
        },
      });
    }
    add(
      "stock",
      stockId,
      "Stock collateral",
      stocks[stockId].logo,
      "#74dbd0",
      "asset",
      compact ? 112 : 0,
      compact ? 0 : 122,
    );
    add(
      "credit",
      "pUSDC",
      type === "Deposit" ? "Borrow liquidity" : "Repay liquidity",
      "/assets/usdc.png",
      "#5cb2ff",
      "asset",
      compact ? 112 : 188,
      compact ? 165 : 122,
    );
    add(
      "portaldot",
      "Portaldot",
      "EVM execution",
      "/assets/portaldot.png",
      "#c297ff",
      "hub",
      compact ? 77 : 377,
      compact ? 330 : 95,
    );
    targets.forEach((id, index) => {
      const p = protocols[id];
      add(
        id,
        p.name,
        vaultId === "pxPrime" ? "Lending pool" : "AMM pool",
        p.logo,
        p.color,
        "protocol",
        compact ? (targets.length === 1 ? 112 : index * 114) : 624,
        compact ? 560 : targets.length === 1 ? 122 : index * 140 - 9,
      );
    });
    add(
      "receipt",
      vaultId,
      type === "Deposit" ? "Vault receipt" : "Redeem shares",
      assets[vaultId],
      vaultId === "pxPrime" ? "#75dfd1" : "#f4bf6b",
      "receipt",
      compact ? 112 : 842,
      compact ? 746 : 122,
    );
    const edges: RouteEdge[] = [];
    const link = (
      source: string,
      target: string,
      color: string,
      delay: number,
    ) =>
      edges.push({
        id: `${source}-${target}`,
        source,
        target,
        type: "liquidity",
        data: {
          color,
          moving:
            phase === "confirming" ||
            (phase === "signing" &&
              (type === "Deposit" ? source === "stock" : target === "receipt")),
          reverse: type === "Withdraw",
          reduced,
          delay,
        },
      });
    link("stock", "credit", "#75dfd1", 0);
    link("credit", "portaldot", "#b99afe", 0.4);
    targets.forEach((id, i) => {
      link("portaldot", id, protocols[id].color, 0.2 * i);
      link(id, "receipt", protocols[id].color, 0.4 + i * 0.2);
    });
    return { nodes, edges };
  }, [vaultId, stockId, phase, type, compact, reduced, inspected, inspect]);
  const selected =
    graph.nodes.find((n) => n.id === inspected) ??
    graph.nodes.find((n) => n.id === "portaldot")!;
  return (
    <div
      className={`flow-experience phase-${phase} ${reduced ? "reduce-motion" : ""}`}
    >
      <div className="flow-experience-heading">
        <div>
          <span className="flow-direction">
            <Layers size={13} />
            {type === "Deposit"
              ? "Collateral → carry → vault"
              : "Vault → unwind → collateral"}
          </span>
          <h4>Portaldot carry route</h4>
        </div>
        <button
          className="route-fit"
          type="button"
          aria-label="Fit complete route"
          onClick={() =>
            void instance.current?.fitView({
              padding: 0.12,
              maxZoom: 1,
              minZoom: 0.45,
              duration: reduced ? 0 : 350,
            })
          }
        >
          <Maximize2 size={15} />
        </button>
      </div>
      <div
        ref={host}
        role="group"
        aria-label="Interactive PORTIX carry route"
        className={`route-canvas ${compact ? "route-canvas-mobile" : ""}`}
      >
        <ReactFlow<RouteNode, RouteEdge>
          nodes={graph.nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={(_, node) => inspect(node.id)}
          onInit={(api) => {
            instance.current = api;
          }}
          fitView
          fitViewOptions={{ padding: 0.12, maxZoom: 1, minZoom: 0.45 }}
          minZoom={0.45}
          maxZoom={1.4}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          elementsSelectable={false}
          zoomOnScroll={false}
          zoomOnDoubleClick={false}
          panOnDrag={!compact}
          preventScrolling={false}
          attributionPosition="bottom-right"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={22}
            size={0.7}
            color="#bba3e023"
          />
        </ReactFlow>
      </div>
      <div className="route-inspector" aria-live="polite">
        <img src={selected.data.logo} alt="" width={25} height={25} />
        <div>
          <strong>
            {selected.data.label}
            <ArrowUpRight size={12} />
          </strong>
          <p>{descriptions[selected.id]}</p>
        </div>
      </div>
      <div className="route-live-state" role="status">
        <span
          className={`route-state-icon ${phase === "confirmed" ? "is-complete" : ""}`}
        >
          {phase === "confirmed" ? (
            <Check size={16} />
          ) : phase === "signing" ? (
            <Wallet size={16} />
          ) : (
            <Radio size={16} />
          )}
        </span>
        <div>
          <strong>
            {phase === "signing"
              ? "Waiting for your wallet"
              : phase === "confirming"
                ? "Transaction in flight"
                : phase === "confirmed"
                  ? "Position confirmed"
                  : "Transaction stopped"}
          </strong>
          <small>
            {message ||
              (phase === "signing"
                ? "Review and sign the request to continue."
                : phase === "confirming"
                  ? "Following the network receipt."
                  : phase === "confirmed"
                    ? "Your balances are being refreshed."
                    : "Check the transaction status below.")}
          </small>
        </div>
        {phase === "confirming" && (
          <div className="route-wave" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <i key={i} style={{ animationDelay: `${i * 0.14}s` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
