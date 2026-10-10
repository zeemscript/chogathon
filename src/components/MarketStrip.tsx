"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

type Market = {
  floor?: number;
  lastSale?: { price: number; symbol: string; at: string };
  listing?: { price: number; symbol: string };
  url: string;
  auraWeek: number;
};

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: n < 10 ? 2 : 0 });

// One line of market context: what it's worth next to how famous it's getting.
export default function MarketStrip({ tokenId }: { tokenId: number }) {
  const { data } = useQuery({
    queryKey: ["market", tokenId],
    queryFn: async (): Promise<Market> => (await fetch(`/api/market/${tokenId}`)).json(),
  });
  const item = "flex items-baseline gap-1.5 whitespace-nowrap";
  const label = "label-mono text-[9.5px] text-muted-foreground/70";
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm sm:gap-x-5">
      <span className={item}>
        <span className={label}>Floor</span>
        {data?.floor ? `${fmt(data.floor)} MON` : "…"}
      </span>
      <span className={item}>
        <span className={label}>Last sale</span>
        {data ? (data.lastSale ? `${fmt(data.lastSale.price)} ${data.lastSale.symbol}` : "never") : "…"}
      </span>
      <span className={cn(item, "hidden sm:flex")}>
        <span className={label}>Listed</span>
        {data ? (data.listing ? `${fmt(data.listing.price)} ${data.listing.symbol}` : "no") : "…"}
      </span>
      {data && (
        <span className={cn(item, "hidden sm:flex", data.auraWeek > 0 ? "text-chog-ok" : "text-muted-foreground")}>
          <span className={label}>Aura 7d</span>
          {data.auraWeek > 0 ? `+${data.auraWeek}` : data.auraWeek}
        </span>
      )}
      {data?.url && (
        <a href={data.url} target="_blank" rel="noreferrer" className="label-mono hidden text-[10px] text-chog-soft underline-offset-4 hover:underline sm:inline">
          OpenSea
        </a>
      )}
    </div>
  );
}
