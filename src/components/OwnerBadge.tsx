"use client";

import { useAccount } from "wagmi";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function OwnerBadge({ owner }: { owner?: string }) {
  const { address } = useAccount();
  if (!owner) return <p className="text-sm text-zinc-500">Owner unknown</p>;
  const mine = address?.toLowerCase() === owner;
  return (
    <p className="text-sm text-zinc-400">
      {mine ? (
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300">Your Chog</span>
      ) : (
        <>
          Held by{" "}
          <a href={`https://monadscan.com/address/${owner}`} target="_blank" rel="noreferrer" className="font-mono hover:text-zinc-200">
            {short(owner)}
          </a>
          <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs">Spectating</span>
        </>
      )}
    </p>
  );
}
