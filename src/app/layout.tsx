import type { Metadata } from "next";
import "./globals.css";
import { Background } from "@/components/shared/Background";
import { Navbar } from "@/components/shared/Navbar";
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
        <Background />
        <Navbar />
        {children}
      </body>
    </html>
  );
}
