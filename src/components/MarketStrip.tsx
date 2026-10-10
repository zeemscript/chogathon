"use client";

import { useQuery } from "@tanstack/react-query";

type Market = {
  floor?: number;
  lastSale?: { price: number; symbol: string; at: string };
  url: string;
};

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: n < 10 ? 2 : 0 });

// One number and a link: details live on OpenSea.
export default function MarketStrip({ tokenId }: { tokenId: number }) {
  const { data } = useQuery({
    queryKey: ["market", tokenId],
    queryFn: async (): Promise<Market> => (await fetch(`/api/market/${tokenId}`)).json(),
  });
  if (!data) return <div className="h-5" />;
  const label = data.lastSale ? "Last sale" : "Floor";
  const value = data.lastSale ? `${fmt(data.lastSale.price)} ${data.lastSale.symbol}` : data.floor ? `${fmt(data.floor)} MON` : null;
  return (
    <div className="flex items-baseline gap-3 text-sm">
      {value && (
        <span className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="label-mono text-[9.5px] text-muted-foreground/70">{label}</span>
          {value}
        </span>
      )}
      <a href={data.url} target="_blank" rel="noreferrer" className="label-mono text-[10px] text-chog-soft underline-offset-4 hover:underline">
        View on OpenSea
      </a>
    </div>
  );
}
