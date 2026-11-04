// Never accept signing, account-unlocking, arbitrary URLs or transaction broadcasting here.
const methods = new Set([
  "eth_chainId",
  "eth_blockNumber",
  "eth_call",
  "eth_getBalance",
  "eth_getCode",
  "eth_getLogs",
  "eth_getBlockByNumber",
  "eth_getBlockByHash",
  "eth_getTransactionReceipt",
  "eth_getTransactionByHash",
]);
export function isReadRequest(
  body: unknown,
): body is {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params: unknown[];
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const req = body as Record<string, unknown>;
  return (
    req.jsonrpc === "2.0" &&
    (typeof req.id === "string" || typeof req.id === "number") &&
    typeof req.method === "string" &&
    methods.has(req.method) &&
    Array.isArray(req.params) &&
    req.params.length <= 5
  );
}
