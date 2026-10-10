"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import type { Chog } from "@/lib/chogs";
import ChogCard from "./ChogCard";

export default function MyChogs() {
  const { address, isConnected } = useAccount();
  const { data, isPending, error } = useQuery({
    queryKey: ["owned", address],
    enabled: !!address,
    queryFn: async (): Promise<Chog[]> => {
      const res = await fetch(`/api/owned?address=${address}`);
      if (!res.ok) throw new Error("Couldn't load your Chogs");
      return (await res.json()).chogs;
    },
  });

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/15 p-8 text-center">
        <p className="text-zinc-300">Connect a wallet holding a Chog to wake its soul.</p>
        <ConnectButton />
      </div>
    );
  }
  if (isPending) return <p className="text-zinc-400">Finding your Chogs…</p>;
  if (error) return <p className="text-red-400">{error.message}</p>;
  if (!data.length) {
    return (
      <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-zinc-300">
        No Chogs in this wallet. You can still meet any Chog below as a spectator.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {data.map((c) => (
        <ChogCard key={c.tokenId} chog={c} href={`/chog/${c.tokenId}`} />
      ))}
    </div>
  );
}
