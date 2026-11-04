import { isReadRequest } from "@/lib/onchain/rpc-policy";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (text.length > 65_536)
      return Response.json({ error: "Request too large." }, { status: 413 });
    const body: unknown = JSON.parse(text);
    if (!isReadRequest(body))
      return Response.json(
        { error: "Only supported public chain reads are allowed." },
        { status: 400 },
      );
    const upstream = await fetch("https://test-evm-rpc-v3.portaldot.dev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!upstream.ok)
      return Response.json(
        { error: "Network reads are temporarily unavailable." },
        { status: 502 },
      );
    const result = await upstream.json();
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(
      { error: "Network reads are temporarily unavailable." },
      { status: 502 },
    );
  }
}
