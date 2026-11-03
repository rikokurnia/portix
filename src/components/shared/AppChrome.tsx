"use client";
import { usePathname } from "next/navigation";
import { Background } from "./Background";
import { Navbar } from "./Navbar";

export function AppChrome() {
  const pathname = usePathname();
  return pathname === "/" ? null : <><Background /><Navbar /></>;
}
