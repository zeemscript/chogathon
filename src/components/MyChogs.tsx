"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { Skeleton } from "@/components/ui/skeleton";
import type { Chog } from "@/lib/chogs";
import ChogCard from "./ChogCard";
import WalletButton from "./WalletButton";

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-dashed border-line-bright bg-white/[.02] px-6 py-14 text-center">
      {children}
    </div>
  );
}

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
      <Empty>
        <p className="font-display text-3xl">Your souls are waiting</p>
        <p className="max-w-sm text-muted-foreground">Connect the wallet holding your Chogs to wake them up.</p>
        <WalletButton size="default" />
      </Empty>
    );
  }
  if (isPending) {
    return (
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="aspect-[4/5] rounded-2xl bg-night-3" />
        ))}
      </div>
    );
  }
  if (error) return <p className="text-destructive">{error.message}</p>;
  if (!data.length) {
    return (
      <Empty>
        <p className="font-display text-3xl">No Chogs in this wallet</p>
        <p className="max-w-sm text-muted-foreground">
          You can still visit any Chog below. Just don&apos;t expect it to trust you.
        </p>
      </Empty>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
      {data.map((c) => (
        <ChogCard key={c.tokenId} chog={c} href={`/chog/${c.tokenId}`} />
      ))}
    </div>
  );
}
