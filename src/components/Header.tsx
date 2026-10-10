"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";

export default function Header() {
  return (
    <header className="border-b border-white/10">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Chog <span className="text-violet-400">Souls</span>
        </Link>
        <ConnectButton showBalance={false} chainStatus="icon" />
      </div>
    </header>
  );
}
