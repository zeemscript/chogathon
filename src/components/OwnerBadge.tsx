"use client";

import { useAccount } from "wagmi";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function OwnerBadge({ owner }: { owner?: string }) {
  const { address } = useAccount();
  if (!owner) return <span className="label-mono text-muted-foreground">Owner unknown</span>;
  if (address?.toLowerCase() === owner) {
    return (
      <span className="label-mono inline-flex items-center gap-2 rounded-full border border-chog-ok/40 bg-chog-ok/10 px-3 py-1 text-chog-ok">
        <span className="size-1.5 animate-pulse-dot rounded-full bg-chog-ok" />
        Your Chog
      </span>
    );
  }
  return (
    <span className="label-mono inline-flex items-center gap-2 whitespace-nowrap text-muted-foreground">
      <span className="hidden sm:inline">Held by</span>
      <a
        href={`https://monadscan.com/address/${owner}`}
        target="_blank"
        rel="noreferrer"
        className="text-foreground underline-offset-4 hover:text-chog-soft hover:underline"
      >
        {short(owner)}
      </a>
      <span className="rounded-full border border-border px-2 py-0.5 text-[10px]">Spectating</span>
    </span>
  );
}
