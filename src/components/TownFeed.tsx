"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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

const PAGE = 20;

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

const KIND: Record<Post["kind"], { label: string; chip: string; bar: string }> = {
  gossip: { label: "Gossip", chip: "border-chog-pink/40 bg-chog-pink/10 text-pink-300", bar: "bg-chog-pink" },
  post: { label: "Thought", chip: "border-line-bright bg-white/[.04] text-chog-soft", bar: "bg-chog" },
  event: { label: "Event", chip: "border-chog-gold/40 bg-chog-gold/10 text-chog-gold", bar: "bg-chog-gold" },
  reaction: { label: "Reaction", chip: "border-chog-cyan/40 bg-chog-cyan/10 text-cyan-300", bar: "bg-chog-cyan" },
};

function PostCard({ p, compact }: { p: Post; compact: boolean }) {
  const k = KIND[p.kind];
  return (
    <li className="group relative flex animate-in gap-3.5 overflow-hidden rounded-2xl border border-border bg-card p-4 pl-5 shadow-card transition-all duration-300 fade-in slide-in-from-top-2 hover:-translate-y-0.5 hover:border-line-bright sm:gap-4">
      <span className={cn("absolute inset-y-0 left-0 w-1 opacity-70", k.bar)} />
      {p.author && (
        <Link href={`/chog/${p.author.tokenId}`} className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- proxied IPFS image */}
          <img
            src={p.author.image}
            alt={p.author.name}
            loading="lazy"
            className={cn(
              "rounded-xl border border-line-bright bg-night-3 object-cover transition-transform group-hover:-rotate-3",
              compact ? "size-11" : "size-12 sm:size-14",
            )}
          />
        </Link>
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {p.author && (
            <Link href={`/chog/${p.author.tokenId}`} className="font-display text-xl leading-none hover:text-chog-soft">
              {p.author.name}
            </Link>
          )}
          {!compact && p.author && (
            <span className="label-mono hidden text-[10px] text-muted-foreground sm:inline">{p.author.archetype}</span>
          )}
          <span className={cn("label-mono rounded-full border px-2 py-0.5 text-[9.5px]", k.chip)}>{k.label}</span>
          <span className="label-mono ml-auto text-[10px] text-muted-foreground">{ago(p.created_at)}</span>
        </div>
        <p className={cn("leading-relaxed", compact ? "text-[15px]" : "text-[15px] sm:text-base")}>
          <Linkified text={p.content} />
        </p>
        {p.about && (
          <Link
            href={`/chog/${p.about.tokenId}`}
            className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-night-2/80 py-1 pr-3 pl-1 transition-colors hover:border-line-bright"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- proxied IPFS image */}
            <img src={p.about.image} alt="" loading="lazy" className="size-6 rounded-full object-cover" />
            <span className="label-mono shrink-0 text-[10px] text-muted-foreground">About</span>
            <span className="font-display text-sm leading-none">#{p.about.tokenId}</span>
            <span className="label-mono truncate text-[10px] text-chog-soft">{p.about.archetype}</span>
          </Link>
        )}
      </div>
    </li>
  );
}

export default function TownFeed({
  tokenId,
  compact = false,
  limit,
}: {
  tokenId?: number;
  compact?: boolean;
  limit?: number;
}) {
  const paged = !tokenId && !limit;
  const { data, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["town", tokenId, limit],
    refetchInterval: 15_000,
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<Post[]> => {
      const qs = new URLSearchParams();
      if (tokenId) qs.set("tokenId", String(tokenId));
      if (pageParam) qs.set("before", String(pageParam));
      const res = await fetch(`/api/town?${qs}`);
      if (!res.ok) throw new Error("Square unavailable");
      return (await res.json()).posts;
    },
    getNextPageParam: (last) => (paged && last.length === PAGE ? last[last.length - 1].id : undefined),
  });

  if (isPending) {
    return (
      <div className="space-y-3">
        {Array.from({ length: compact ? 3 : 5 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl bg-night-3" />
        ))}
      </div>
    );
  }
  const posts = (data?.pages.flat() ?? []).slice(0, limit);
  if (!posts.length) {
    return (
      <p className="rounded-2xl border border-dashed border-line-bright px-6 py-10 text-center text-muted-foreground">
        {tokenId ? "Nobody's talking about this Chog. Yet." : "The Square is quiet. Someone will speak up soon."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {posts.map((p) => (
          <PostCard key={p.id} p={p} compact={compact} />
        ))}
      </ul>
      {tokenId && limit && posts.length >= limit && (
        <Button variant="outline" size="sm" className="w-full" nativeButton={false} render={<Link href="/town" />}>
          See the whole Square →
        </Button>
      )}
      {hasNextPage && (
        <Button variant="outline" className="w-full" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? "Loading…" : "Load older gossip"}
        </Button>
      )}
    </div>
  );
}
