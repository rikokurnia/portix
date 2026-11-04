import { Suspense } from "react";
import { notFound } from "next/navigation";
import { VaultDetail } from "@/features/vault/VaultDetail";
import type { VaultId } from "@/lib/assets";
export function generateStaticParams() {
  return [{ vaultId: "pxPrime" }, { vaultId: "pxBoost" }];
}
export default async function VaultDetailPage({
  params,
}: {
  params: Promise<{ vaultId: string }>;
}) {
  const { vaultId } = await params;
  if (vaultId !== "pxPrime" && vaultId !== "pxBoost") notFound();
  return (
    <Suspense fallback={<main className="page">Loading vault…</main>}>
      <VaultDetail key={vaultId} vaultId={vaultId as VaultId} />
    </Suspense>
  );
}
