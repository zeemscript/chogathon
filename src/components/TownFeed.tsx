"use client";

import { ArrowRight01Icon, Fire02Icon, Share08Icon } from "@hugeicons/core-free-icons";
import Icon from "@/components/Icon";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useState } from "react";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Card = { tokenId: number; name: string; image: string; archetype: string };
type Post = {
  id: number;
  kind: "post" | "gossip" | "event" | "reaction" | "roast";
  content: string;
  laughs?: number;
  commissioned_by?: string | null;
  reply_to?: number | null;
  comeback_used?: boolean;
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
  roast: { label: "Roast", chip: "border-orange-400/40 bg-orange-400/10 text-orange-300", bar: "bg-orange-400" },
};

// Share a post on X; its own page unfurls into an image of the post.
function ShareButton({ post }: { post: Post }) {
  function share() {
    const who = post.author ? `Chog #${post.author.tokenId}` : "A Chog";
    const lead = post.kind === "roast" ? `${who} just roasted someone in the Town Square 😂` : `${who} in the Town Square:`;
    const text = `${lead}\n\n“${post.content}”\n\n#ChogSouls`;
    const url = `${window.location.origin}/town/p/${post.id}`;
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank", "noopener,noreferrer,width=600,height=640");
  }
  return (
    <button
      onClick={share}
      title="Share on X"
      aria-label="Share on X"
      className="ml-auto grid size-8 cursor-pointer place-items-center rounded-full border border-transparent text-muted-foreground transition-colors hover:border-line-bright hover:bg-white/5 hover:text-foreground"
    >
      <Icon icon={Share08Icon} size={15} />
    </button>
  );
}

const LAUGHED = (id: number) => `chog-souls:laughed:${id}`;

// Laughing at a post gives the Chog that wrote it +1 Aura.
function LaughButton({ post }: { post: Post }) {
  const { address, auth, signIn, signing } = useOwnerAuth();
  const [count, setCount] = useState(post.laughs ?? 0);
  const [mine, setMine] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(LAUGHED(post.id)) === "1";
    } catch {
      return false;
    }
  });
  const { openConnectModal } = useConnectModal();

  async function laugh() {
    if (mine) return;
    if (!address) {
      toast("Connect a wallet to laugh", {
        description: "Each laugh gives this Chog +1 Aura.",
        action: openConnectModal ? { label: "Connect", onClick: () => openConnectModal() } : undefined,
      });
      return;
    }
    try {
      const a = auth ?? (await signIn());
      const res = await fetch("/api/town/laugh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postId: post.id, auth: a }),
      });
      const j = await res.json();
      if (res.ok || j.already) {
        setMine(true);
        if (res.ok) setCount(j.laughs);
        try {
          localStorage.setItem(LAUGHED(post.id), "1");
        } catch {}
      } else toast.error(j.error);
    } catch {
      toast("Cancelled in your wallet");
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={laugh}
        disabled={signing}
        title={mine ? "You laughed" : "Laugh (+1 Aura to this Chog)"}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-all active:scale-95",
          mine ? "border-chog-gold/50 bg-chog-gold/15 text-chog-gold" : "border-border bg-night-2/80 text-muted-foreground hover:border-line-bright hover:text-foreground",
        )}
      >
        <span aria-hidden className={cn("transition-transform", !mine && "grayscale-[.6]")}>😂</span>
        <span className="font-mono text-xs">{count}</span>
      </button>
    </span>
  );
}

// The roasted Chog's owner can fire back once, for free.
function ComebackButton({ post }: { post: Post }) {
  const { auth, signIn, signing } = useOwnerAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function fire() {
    setBusy(true);
    const t = toast.loading("Writing the comeback…");
    try {
      const a = auth ?? (await signIn());
      const res = await fetch("/api/roast/comeback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postId: post.id, auth: a }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      qc.invalidateQueries({ queryKey: ["town"] });
      toast.success("Comeback delivered 🔥", { id: t, description: `“${j.post.content}”` });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't roast back", { id: t });
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={fire}
      disabled={busy || signing}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-orange-400/50 bg-orange-400/10 px-3 py-1 text-xs font-medium text-orange-300 transition-colors hover:bg-orange-400/20 disabled:opacity-50"
    >
      <Icon icon={Fire02Icon} size={13} />
      {busy ? "…" : "Roast back · free"}
    </button>
  );
}

function PostCard({ p, compact, mine }: { p: Post; compact: boolean; mine: Set<number> }) {
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
          <span className={cn("label-mono rounded-full border px-2 py-0.5 text-[9.5px]", k.chip)}>
            {p.commissioned_by ? "Paid roast" : p.reply_to ? "Comeback" : k.label}
          </span>
          <ShareButton post={p} />
        </div>
        <p className={cn("leading-relaxed", compact ? "text-[15px]" : "text-[15px] sm:text-base")}>
          <Linkified text={p.content} />
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <LaughButton post={p} />
          {p.commissioned_by && !p.comeback_used && p.about && mine.has(p.about.tokenId) && <ComebackButton post={p} />}
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
          <span className="label-mono ml-auto text-[10px] text-muted-foreground">{ago(p.created_at)}</span>
        </div>
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
  // Which Chogs the viewer owns (for "Roast back" on paid roasts about them).
  const { address } = useAccount();
  const { data: owned } = useQuery({
    queryKey: ["owned", address],
    enabled: !!address,
    queryFn: async (): Promise<{ tokenId: number }[]> => (await (await fetch(`/api/owned?address=${address}`)).json()).chogs,
  });
  const mine = new Set((owned ?? []).map((c) => c.tokenId));
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
          <PostCard key={p.id} p={p} compact={compact} mine={mine} />
        ))}
      </ul>
      {tokenId && limit && posts.length >= limit && (
        <Button variant="outline" size="sm" className="w-full" nativeButton={false} render={<Link href="/town" />}>
          See the whole Square <Icon icon={ArrowRight01Icon} size={15} />
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
