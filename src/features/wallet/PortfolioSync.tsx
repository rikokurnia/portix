"use client";
import { legacyAbi, legacyAddress, isLegacyRuntime } from "@/lib/onchain/legacy";
import { useEffect, useRef } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import {
  createWalletClient,
  custom,
  parseUnits,
  decodeEventLog,
  formatUnits,
  type Abi,
  type Address,
} from "viem";
import { useNativeWallet } from "./NativeWalletProvider";
import { nativeEvmAddress } from "./native-address";
import { useWalletSelection } from "./selection";
import { portaldot } from "./chain";
import { readAccount, readMarket } from "@/lib/onchain/account";
import {
  isolatedAccounting,
  vaultIntegrationIssue,
  contracts,
  publicClient,
  tokenAbi,
  marketAbi,
  stockBoughtAbi,
  vaultAbi,
  stockAddress,
  vaultAddress,
  requireAddress,
  transactionError,
} from "@/lib/onchain/contracts";
import {
  getPortfolioSnapshot,
  updatePortfolio,
  setPortfolioAccount,
  registerPortfolioExecutor,
  recordActivity,
  type Activity,
  type PortfolioCommand,
} from "@/lib/portfolio-store";

function EvmSync() {
  const { authenticated, user } = usePrivy();
  const { wallets, ready } = useWallets();
  const { selected: preferred } = useWalletSelection();
  const selected =
    authenticated && ready
      ? (wallets.find(
          (w) => w.address.toLowerCase() === preferred.toLowerCase(),
        ) ??
        wallets.find(
          (w) =>
            w.address.toLowerCase() === user?.wallet?.address?.toLowerCase(),
        ) ??
        wallets[0])
      : undefined;
  return <Sync selected={selected}/>;
}
export function PortfolioSync({nativeOnly=false}:{nativeOnly?:boolean}){return nativeOnly?<Sync/>:<EvmSync/>;}
function Sync({selected}:{selected?:ReturnType<typeof useWallets>["wallets"][number]}){
  const native=useNativeWallet();
  const walletRef = useRef(selected);
  const nativeRef=useRef(native);
  useEffect(()=>{nativeRef.current=native;},[native]);
  const nativeAddress=native.selected?.address;
  const ownerAddress = nativeAddress ? nativeEvmAddress(nativeAddress) : selected?.address;
  useEffect(() => {
    walletRef.current = selected;
  }, [selected]);
  useEffect(() => {
    let active = true;
    let currentRead: Promise<void> | undefined;
    const owner = ownerAddress as Address | undefined;
    setPortfolioAccount(owner);
    const current = () =>
      active &&
      getPortfolioSnapshot().address?.toLowerCase() === owner?.toLowerCase();
    async function load() {
      if (!active) return;
      if (current()) updatePortfolio({ refreshing: true });
      const [market, account] = await Promise.allSettled([
        readMarket(),
        owner ? readAccount(owner) : Promise.resolve(undefined),
      ]);
      if (current()) {
        if (market.status === "fulfilled")
          updatePortfolio({
            prices: market.value.prices,
            feeBps: market.value.feeBps,
          });
        if (account.status === "fulfilled" && account.value)
          updatePortfolio({ ...account.value, ready: true, error: "" });
        else if (account.status === "rejected")
          updatePortfolio({
            ready: false,
            error: "Wallet balances could not be refreshed. Please retry.",
          });
        if (
          market.status === "rejected" ||
          (market.status === "fulfilled" && market.value.priceError)
        )
          updatePortfolio({
            error: "Some oracle prices are unavailable. Please retry.",
          });
        updatePortfolio({ refreshing: false, observedAt: Date.now() });
        // Recover outstanding receipts after reload; never replay a transaction.
        if (owner)
          await Promise.all(
            getPortfolioSnapshot()
              .activity.filter((a) => a.status === "Pending")
              .map(async (event) => {
                try {
                  if(event.transport === "substrate") {
                    const {recoverNative}=await import("./native-client");
                    const status=await recoverNative(event.hash,event.fromBlock??0,event.blockHash);
                    if(status)recordActivity(owner,{...event,status});
                    return;
                  }
                  const receipt = await publicClient.getTransactionReceipt({
                    hash: event.hash,
                  });
                  recordActivity(owner, {
                    ...event,
                    status:
                      receipt.status === "success" ? "Completed" : "Failed",
                  });
                } catch {
                  /* Not mined yet or RPC unavailable. Keep Pending. */
                }
              }),
          );
      }
    }
    function refresh(force = false): Promise<void> {
      if (!active) return Promise.resolve();
      if (currentRead)
        return force ? currentRead.then(() => refresh()) : currentRead;
      currentRead = load().finally(() => {
        currentRead = undefined;
      });
      return currentRead;
    }
    if (owner)
      registerPortfolioExecutor(async (command: PortfolioCommand) => {
        if (!current())
          return { ok: false, error: "Reconnect your wallet to continue." };
        if (
          getPortfolioSnapshot().activity.some(
            (a) =>
              a.status === "Pending" &&
              a.type === command.type &&
              a.stockId === command.stockId,
          )
        )
          return {
            ok: false,
            error:
              "This action is still pending. Check its transaction in Activity.",
          };
        updatePortfolio({ pending: "Confirm the network in your wallet…" });
        try {
          if (
            command.type !== "Faucet" && !command.legacy &&
            !isolatedAccounting
          )
            return { ok: false, error: vaultIntegrationIssue };
          if (command.legacy && (isolatedAccounting || command.stockId !== "AAPL" ||
              ((command.type === "Deposit" || command.type === "Withdraw") && command.vaultId !== "pxPrime")))
            throw new Error("Invalid legacy demo route.");
          const nativeSigner = nativeAddress ? nativeRef.current : undefined;
          const signer = walletRef.current;
          if (!nativeSigner && (!signer || signer.address.toLowerCase() !== owner.toLowerCase()))
            throw new Error("Wallet changed.");
          if(signer && !nativeSigner) await signer.switchChain(portaldot.id);
          const provider = signer && !nativeSigner ? await signer.getEthereumProvider() : undefined;
          const wallet = provider ? createWalletClient({
            account: owner,
            chain: portaldot,
            transport: custom(provider),
          }) : undefined;
          const assertOwner = async () => {
            if (!current()) throw new Error("Wallet changed.");
            if(nativeSigner){
              if(nativeRef.current.selected?.address!==nativeAddress||!nativeRef.current.signer)throw new Error("Wallet changed.");
              return;
            }
            const accounts = await wallet!.getAddresses();
            if (!accounts.some((a) => a.toLowerCase() === owner.toLowerCase()))
              throw new Error("Wallet changed.");
            if ((await wallet!.getChainId()) !== portaldot.id)
              throw new Error("Wrong network.");
          };
          async function send(
            target: Address,
            abi: Abi,
            functionName: string,
            args: readonly unknown[],
            event: Pick<Activity, "type" | "stockId" | "amount" | "vaultId">,
          ) {
            await assertOwner();
            if (!(await publicClient.getCode({ address: target })))
              throw new Error("Contract is not available on this network.");
            updatePortfolio({
              pending:
                event.type === "Approve"
                  ? "Approve token access in your wallet…"
                  : "Confirm the transaction in your wallet…",
            });
            if(nativeSigner?.selected && nativeSigner.signer){
              const {sendNative}=await import("./native-client");
              let entry:Activity|undefined;
              const hash=await sendNative(nativeSigner.selected.address,nativeSigner.signer,target,abi,functionName,args,stage=>{
                entry={...event,id:stage.hash,hash:stage.hash,timestamp:entry?.timestamp??new Date().toISOString(),status:stage.status,transport:"substrate",fromBlock:stage.fromBlock,blockHash:stage.blockHash,legacy:command.legacy};
                recordActivity(owner!,entry);
                if(current())updatePortfolio({pending:stage.status==="Pending"?"Waiting for Portaldot confirmation…":"Refreshing balances…"});
              },()=>{if(!current()||nativeRef.current.selected?.address!==nativeAddress)throw new Error("Wallet changed.");});
              return hash;
            }
            const { request } = await publicClient.simulateContract({
              address: target,
              abi,
              functionName,
              args,
              account: owner,
            });
            await assertOwner();
            let hash = await wallet!.writeContract(request);
            let cancelled = false;
            let entry: Activity = {
              ...event,
              id: hash,
              hash,
              timestamp: new Date().toISOString(),
              status: "Pending",
            };
            recordActivity(owner!, entry);
            if (current())
              updatePortfolio({ pending: "Waiting for network confirmation…" });
            const receipt = await publicClient.waitForTransactionReceipt({
              hash,
              timeout: 120_000,
              onReplaced: (replacement) => {
                recordActivity(owner!, { ...entry, status: "Failed" });
                hash = replacement.transaction.hash;
                cancelled = replacement.reason === "cancelled";
                entry = {
                  ...entry,
                  id: hash,
                  hash,
                  status: cancelled ? "Failed" : "Pending",
                };
                recordActivity(owner!, entry);
              },
            });
            if (receipt.status === "success" && event.type === "Buy") {
              for (const log of receipt.logs)
                try {
                  const decoded = decodeEventLog({
                    abi: stockBoughtAbi,
                    data: log.data,
                    topics: log.topics,
                  });
                  if (
                    decoded.eventName === "StockBought" &&
                    log.address.toLowerCase() === target.toLowerCase()
                  ) {
                    const args = decoded.args;
                    entry = {
                      ...entry,
                      amount: Number(formatUnits(args.stockAmount, 18)),
                    };
                  }
                } catch {
                  /* Other token and approval events share the receipt. */
                }
            }
            recordActivity(owner!, {
              ...entry,
              status:
                !cancelled && receipt.status === "success"
                  ? "Completed"
                  : "Failed",
            });
            if (cancelled || receipt.status !== "success")
              throw new Error("Transaction reverted or cancelled.");
            return hash;
          }
          const settlement = requireAddress(contracts.pUSDC, "pUSDC");
          const raw = parseUnits(
            "rawAmount" in command && command.rawAmount
              ? command.rawAmount
              : command.type === "Faucet"
                ? String(command.amount)
                : command.amount.toFixed(18),
            command.type === "Faucet" ? 6 : 18,
          );
          if (raw <= 0n) throw new Error("Amount too small.");
          async function approve(
            token: Address,
            spender: Address,
            amount: bigint,
            asset: Activity["stockId"],
            decimals: number,
          ) {
            const allowance = await publicClient.readContract({
              address: token,
              abi: tokenAbi,
              functionName: "allowance",
              args: [owner!, spender],
            });
            if (allowance < amount)
              await send(token, tokenAbi, "approve", [spender, amount], {
                type: "Approve",
                stockId: asset,
                amount: Number(amount) / 10 ** decimals,
              });
          }
          let hash;
          if (command.type === "Faucet") {
            hash = await send(
              settlement,
              tokenAbi,
              "faucet",
              [owner, 5_000_000_000n],
              command,
            );
          } else if (command.legacy) {
            if (!isLegacyRuntime(await publicClient.getCode({address:legacyAddress}))) throw new Error("Legacy runtime changed");
            if (command.type === "Buy") {
              const spend = parseUnits((command.spend ?? 0).toFixed(6),6);
              await approve(settlement,legacyAddress,spend,"pUSDC",6);
              const fee = (spend * 10n) / 10000n;
              const netSpend = spend - fee;
              const stockAmount = (netSpend * 10n**18n) / 300_000_000n;
              const buyAmount = Number(formatUnits(stockAmount, 18));
              const buyEvent = { ...command, amount: buyAmount > 0 ? buyAmount : command.amount };
              hash = await send(legacyAddress,marketAbi,"buyStockWithExactUSDC",[legacyAddress,spend],buyEvent);
            } else if (command.type === "Sell") {
              const quote = await publicClient.readContract({address:legacyAddress,abi:marketAbi,functionName:"quoteSell",args:[legacyAddress,raw]}) as readonly bigint[];
              const liquidity = await publicClient.readContract({address:settlement,abi:tokenAbi,functionName:"balanceOf",args:[legacyAddress]});
              if (liquidity < quote[2]) throw new Error("Insufficient settlement liquidity");
              hash = await send(legacyAddress,marketAbi,"sellStock",[legacyAddress,raw],command);
            } else if (command.type === "Deposit") {
              hash = await send(legacyAddress,legacyAbi,"depositAndInvest",[raw,owner],command);
            } else {
              const quote = await publicClient.readContract({address:legacyAddress,abi:legacyAbi,functionName:"previewWithdrawCarry",args:[raw]});
              const liquidity = await publicClient.readContract({address:settlement,abi:tokenAbi,functionName:"balanceOf",args:[legacyAddress]});
              if (liquidity < quote[3]) throw new Error("Insufficient settlement liquidity");
              hash = await send(legacyAddress,legacyAbi,"withdrawWithYield",[raw,owner,owner],command);
            }
          } else {
            const token = requireAddress(
              stockAddress(command.stockId),
              command.stockId,
            );
            if (command.type === "Buy" || command.type === "Sell") {
              const target = requireAddress(contracts.market, "Market");
              // Check the market's settlement identity before granting token access.
              const marketSettlement = (await publicClient.readContract({
                address: target,
                abi: marketAbi,
                functionName: "pUSDC",
              })) as Address;
              if (marketSettlement.toLowerCase() !== settlement.toLowerCase())
                throw new Error("Settlement configuration mismatch.");
              if (command.type === "Buy" && command.spend !== undefined) {
                if (!Number.isFinite(command.spend) || command.spend <= 0)
                  throw new Error("Invalid payment.");
                const spend = parseUnits(command.spend.toFixed(6), 6);
                await approve(settlement, target, spend, "pUSDC", 6);
                hash = await send(
                  target,
                  marketAbi,
                  "buyStockWithExactUSDC",
                  [token, spend],
                  command,
                );
              } else {
                const quote = (await publicClient.readContract({
                  address: target,
                  abi: marketAbi,
                  functionName:
                    command.type === "Buy" ? "quoteBuy" : "quoteSell",
                  args: [token, raw],
                })) as readonly bigint[];
                await approve(
                  command.type === "Buy" ? settlement : token,
                  target,
                  command.type === "Buy" ? quote[2] : raw,
                  command.type === "Buy" ? "pUSDC" : command.stockId,
                  command.type === "Buy" ? 6 : 18,
                );
                hash = await send(
                  target,
                  marketAbi,
                  command.type === "Buy" ? "buyStock" : "sellStock",
                  [token, raw],
                  command,
                );
              }
            } else {
              const target = requireAddress(
                vaultAddress(command.vaultId, command.stockId),
                command.vaultId,
              );
              const [asset, vaultSettlement] = (await Promise.all([
                publicClient.readContract({
                  address: target,
                  abi: vaultAbi,
                  functionName: "asset",
                }),
                publicClient.readContract({
                  address: target,
                  abi: vaultAbi,
                  functionName: "settlementAsset",
                }),
              ])) as Address[];
              if (
                asset.toLowerCase() !== token.toLowerCase() ||
                vaultSettlement.toLowerCase() !== settlement.toLowerCase()
              )
                throw new Error("Vault configuration mismatch.");
              if (command.type === "Deposit")
                await approve(token, target, raw, command.stockId, 18);
              hash = await send(
                target,
                vaultAbi,
                command.type === "Deposit"
                  ? "depositAndInvest"
                  : "withdrawWithYield",
                command.type === "Deposit" ? [raw, owner] : [raw, owner, owner],
                command,
              );
            }
          }
          await refresh(true);
          return { ok: true, hash };
        } catch (error) {
          return { ok: false, error: transactionError(error) };
        } finally {
          if (current()) updatePortfolio({ pending: "" });
        }
      });
    else registerPortfolioExecutor(undefined);
    void refresh();
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 20_000);
    const retry = () => {
      void refresh();
    };
    window.addEventListener("portix:refresh", retry);
    return () => {
      active = false;
      clearInterval(timer);
      registerPortfolioExecutor(undefined);
      window.removeEventListener("portix:refresh", retry);
    };
  }, [ownerAddress,nativeAddress]);
  return null;
}
