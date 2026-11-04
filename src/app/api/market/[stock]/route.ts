import { stockIds, type StockId } from "@/lib/assets";
import {
  contracts,
  manifest,
  publicClient,
  stockAddress,
} from "@/lib/onchain/contracts";
import { parseAbiItem, formatUnits } from "viem";
import type { OracleObservation } from "@/lib/onchain/history";
export const dynamic = "force-dynamic";
const cache = new Map<string, { until: number; data: OracleObservation[] }>();
const inFlight = new Map<string, Promise<OracleObservation[]>>();
async function history(id: StockId) {
  const cached = cache.get(id);
  if (cached && cached.until > Date.now()) return cached.data;
  const running = inFlight.get(id);
  if (running) return running;
  const request = (async () => {
    const latest = await publicClient.getBlockNumber();
    // Bounded event scan, beginning at deployment. Extend with an indexer as history grows.
    const start =
      BigInt(manifest.deploymentBlock) > latest - 40_000n
        ? BigInt(manifest.deploymentBlock)
        : latest - 40_000n;
    const observations: OracleObservation[] = [];
    for (let block = start; block <= latest; block += 2000n) {
      const logs = await publicClient.getLogs({
        address: contracts.oracle!,
        event: parseAbiItem(
          "event PriceUpdated(address indexed token,uint256 price,uint256 timestamp)",
        ),
        args: { token: stockAddress(id)! },
        fromBlock: block < 0n ? 0n : block,
        toBlock: block + 1999n > latest ? latest : block + 1999n,
      });
      for (const log of logs)
        if (log.args.price !== undefined && log.args.timestamp !== undefined)
          observations.push({
            timestamp: Number(log.args.timestamp),
            price: Number(formatUnits(log.args.price, 6)),
          });
    }
    const data = observations
      .filter((p) => p.timestamp >= Date.now() / 1000 - 31 * 86400)
      .sort((a, b) => a.timestamp - b.timestamp);
    cache.set(id, { until: Date.now() + 60_000, data });
    return data;
  })();
  inFlight.set(id, request);
  try {
    return await request;
  } finally {
    inFlight.delete(id);
  }
}
export async function GET(
  _request: Request,
  context: { params: Promise<{ stock: string }> },
) {
  const { stock } = await context.params;
  if (!stockIds.includes(stock as StockId))
    return Response.json({ error: "Unknown stock." }, { status: 404 });
  if (!contracts.oracle || !stockAddress(stock as StockId))
    return Response.json({ observations: [], available: false });
  try {
    return Response.json({
      observations: await history(stock as StockId),
      available: true,
    });
  } catch {
    return Response.json(
      { error: "Oracle history is temporarily unavailable." },
      { status: 503 },
    );
  }
}
