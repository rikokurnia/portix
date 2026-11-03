import type { Metadata } from "next";
import "./globals.css";
import { AppChrome } from "@/components/shared/AppChrome";
import { WalletProvider } from "@/features/wallet/WalletProvider";
export const metadata: Metadata = {
  icons: { icon: "/assets/logo.png" },
  title: "PORTIX — Put your stocks to work",
  description:
    "Choose a vault. Keep your stock exposure. Manage your portfolio.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WalletProvider appId={process.env.APP_ID_PRIVY?.trim() ?? ""}>
          <AppChrome />
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
