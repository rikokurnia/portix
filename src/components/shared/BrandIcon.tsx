import { assets, type VaultId } from "@/lib/assets";
export function BrandIcon({
  brand = "logo",
  size = 40,
}: {
  brand?: VaultId | "logo";
  size?: number;
}) {
  return (
    <img
      src={assets[brand]}
      alt={brand === "logo" ? "PORTIX" : brand}
      width={size}
      height={size}
      className="brand-icon"
    />
  );
}
