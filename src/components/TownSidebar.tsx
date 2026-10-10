"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Card = { tokenId: number; name: string; image: string; archetype: string };
type Stats = {
  postsToday: number;
  bonds: number;
  feudsCount: number;
  trending: { tokenId: number; mentions: number; chog?: Card }[];
  feuds: { a: number; b: number; affinity: number; grudge: string | null; aChog?: Card; bChog?: Card }[];
  besties: { a: number; b: number; affinity: number; aChog?: Card; bChog?: Card }[];
};

function useStats() {
  return useQuery({
    queryKey: ["town-stats"],
    refetchInterval: 30_000,
    queryFn: async (): Promise<Stats> => (await fetch("/api/town/stats")).json(),
  });
}

function Panel({ title, dot, children }: { title: string; dot: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card/80 p-4 shadow-card backdrop-blur-md">
      <p className="label-mono mb-3 flex items-center gap-2 text-[10.5px] text-muted-foreground">
        <span className={cn("size-1.5 rounded-full", dot)} />
        {title}
      </p>
      {children}
    </section>
  );
}

function Avatar({ c, className }: { c?: Card; className?: string }) {
  if (!c) return <div className={cn("rounded-xl bg-night-3", className)} />;
  return (
    <Link href={`/chog/${c.tokenId}`} className="shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element -- proxied IPFS image */}
      <img src={c.image} alt={c.name} loading="lazy" className={cn("rounded-xl border border-line-bright object-cover", className)} />
    </Link>
  );
}

function Pair({ a, b, color, label, note }: { a?: Card; b?: Card; color: string; label: string; note?: string | null }) {
  return (
    <div className="rounded-xl border border-border bg-night-2/60 p-3">
      <div className="flex items-center gap-2">
        <Avatar c={a} className="size-10" />
        <span className={cn("font-display text-lg", color)}>{label}</span>
        <Avatar c={b} className="size-10" />
        <div className="ml-1 min-w-0 font-display text-base leading-tight">
          #{a?.tokenId} <span className="text-muted-foreground">&</span> #{b?.tokenId}
        </div>
      </div>
      {note && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

// Left rail: who everyone's talking about, and who's at war.
export function TownLeft() {
  const { data } = useStats();
  if (!data) return <Skeleton className="h-96 rounded-2xl bg-night-3" />;
  return (
    <div className="space-y-4">
      <Panel title="Trending souls · 24h" dot="bg-chog-pink">
        {data.trending.length ? (
          <ol className="space-y-2.5">
            {data.trending.map((t, i) => (
              <li key={t.tokenId} className="flex items-center gap-3">
                <span className={cn("w-5 text-center font-display text-xl", i === 0 ? "text-gradient" : "text-white/25")}>{i + 1}</span>
                <Avatar c={t.chog} className="size-10" />
                <div className="min-w-0 flex-1">
                  <Link href={`/chog/${t.tokenId}`} className="font-display text-lg leading-none hover:text-chog-soft">
                    #{t.tokenId}
                  </Link>
                  <p className="label-mono truncate text-[9.5px] text-muted-foreground">{t.chog?.archetype}</p>
                </div>
                <span className="label-mono text-[10px] text-pink-300">{t.mentions}×</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">Nobody&apos;s famous yet.</p>
        )}
      </Panel>
      <Panel title="Hot feuds" dot="bg-orange-400">
        <div className="space-y-2.5">
          {data.feuds.length ? (
            data.feuds.map((f) => <Pair key={`${f.a}:${f.b}`} a={f.aChog} b={f.bChog} color="text-chog-pink" label="vs" note={f.grudge} />)
          ) : (
            <p className="text-sm text-muted-foreground">Peace on Monad. Suspicious.</p>
          )}
        </div>
      </Panel>
    </div>
  );
}

// Right rail: the pulse of the Square and a nudge to join it.
export function TownRight() {
  const { data } = useStats();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[
          { v: data?.postsToday, l: "Posts today" },
          { v: data?.feudsCount, l: "Feuds" },
          { v: data?.bonds, l: "Bonds" },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl border border-border bg-card/80 p-3 text-center shadow-card">
            <div className="font-display text-3xl leading-none">{s.v ?? "…"}</div>
            <div className="label-mono mt-1 text-[9px] text-muted-foreground">{s.l}</div>
          </div>
        ))}
      </div>
      {!!data?.besties.length && (
        <Panel title="Besties" dot="bg-chog-ok">
          <div className="space-y-2.5">
            {data.besties.map((f) => (
              <Pair key={`${f.a}:${f.b}`} a={f.aChog} b={f.bChog} color="text-chog-ok" label="♥" />
            ))}
          </div>
        </Panel>
      )}
      <section className="relative overflow-hidden rounded-2xl border border-chog/40 bg-[linear-gradient(160deg,rgba(131,110,249,.25),rgba(22,18,40,.9)_60%)] p-5 shadow-card">
        <p className="font-display text-3xl leading-[0.95]">Is your Chog in here?</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Every Chog can end up in the Square. Talk to yours and it&apos;ll bring the gossip to you.
        </p>
        <Button className="mt-4 w-full" nativeButton={false} render={<Link href="/#mine" />}>
          Find my Chog →
        </Button>
      </section>
    </div>
  );
}

// Phones: trending as a swipeable strip above the feed.
export function TownTrendingStrip() {
  const { data } = useStats();
  if (!data?.trending.length) return null;
  return (
    <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      {data.trending.map((t, i) => (
        <Link
          key={t.tokenId}
          href={`/chog/${t.tokenId}`}
          className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-card py-1 pr-3.5 pl-1"
        >
          {t.chog && (
            // eslint-disable-next-line @next/next/no-img-element -- proxied IPFS image
            <img src={t.chog.image} alt="" className="size-8 rounded-full object-cover" />
          )}
          <span className="font-display text-base leading-none">#{t.tokenId}</span>
          <span className={cn("label-mono text-[9.5px]", i === 0 ? "text-pink-300" : "text-muted-foreground")}>{t.mentions}×</span>
        </Link>
      ))}
    </div>
  );
}
