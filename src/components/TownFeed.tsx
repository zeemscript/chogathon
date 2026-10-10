"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Card = { tokenId: number; name: string; image: string; archetype: string };
type Post = {
  id: number;
  kind: "post" | "gossip" | "event" | "reaction";
  content: string;
  created_at: string;
  author?: Card;
  about?: Card;
};

function ago(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

// Turn "#123" into links to that Chog.
function Linkified({ text }: { text: string }) {
  return (
    <>
      {text.split(/(#\d{1,4}\b)/g).map((part, i) =>
        /^#\d+$/.test(part) ? (
          <Link key={i} href={`/chog/${part.slice(1)}`} className="font-semibold text-chog-soft hover:underline">
            {part}
          </Link>
        ) : (
          part
        ),
      )}
    </>
  );
}

const KIND: Record<Post["kind"], string> = {
  gossip: "border-chog-pink/40 bg-chog-pink/10 text-pink-300",
  post: "border-line-bright bg-white/[.04] text-chog-soft",
  event: "border-chog-gold/40 bg-chog-gold/10 text-chog-gold",
  reaction: "border-chog-cyan/40 bg-chog-cyan/10 text-cyan-300",
};

export default function TownFeed({ tokenId, compact = false, limit }: { tokenId?: number; compact?: boolean; limit?: number }) {
  const { data, isPending } = useQuery({
    queryKey: ["town", tokenId],
    refetchInterval: 15_000,
    queryFn: async (): Promise<Post[]> => {
      const res = await fetch(`/api/town${tokenId ? `?tokenId=${tokenId}` : ""}`);
      if (!res.ok) throw new Error("Square unavailable");
      return (await res.json()).posts;
    },
  });

  if (isPending) {
    return (
      <div className="space-y-3">
        {Array.from({ length: compact ? 2 : 5 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl bg-night-3" />
        ))}
      </div>
    );
  }
  if (!data?.length) {
    return (
      <p className="rounded-2xl border border-dashed border-line-bright px-6 py-10 text-center text-muted-foreground">
        {tokenId ? "Nobody's talking about this Chog. Yet." : "The Square is quiet. Someone will speak up soon."}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {data.slice(0, limit).map((p) => (
        <li
          key={p.id}
          className="group flex animate-in gap-4 rounded-2xl border border-border bg-card p-4 shadow-card transition-colors duration-500 fade-in slide-in-from-top-2 hover:border-line-bright"
        >
          {p.author && (
            <Link href={`/chog/${p.author.tokenId}`} className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- proxied IPFS image */}
              <img
                src={p.author.image}
                alt={p.author.name}
                className="size-12 rounded-xl border border-line-bright object-cover transition-transform group-hover:-rotate-3 sm:size-14"
              />
            </Link>
          )}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {p.author && (
                <Link href={`/chog/${p.author.tokenId}`} className="font-display text-xl leading-none hover:text-chog-soft">
                  {p.author.name}
                </Link>
              )}
              {!compact && p.author && (
                <span className="label-mono text-[10px] text-muted-foreground">{p.author.archetype}</span>
              )}
              <span className={cn("label-mono rounded-full border px-2 py-0.5 text-[9.5px]", KIND[p.kind])}>{p.kind}</span>
              <span className="label-mono ml-auto text-[10px] text-muted-foreground">{ago(p.created_at)}</span>
            </div>
            <p className="text-[15px] leading-relaxed">
              <Linkified text={p.content} />
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
