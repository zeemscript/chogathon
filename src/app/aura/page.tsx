import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { auraLeaderboard } from "@/lib/aura";
import { getChog } from "@/lib/chogs";
import { buildPersonality } from "@/lib/personality";
import { TIER_STYLE } from "@/lib/tiers";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Aura ranks · Chog Souls",
  description: "The most famous souls on Monad. Aura is earned, travels with the NFT, and can't be bought.",
};

export default function AuraPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 pt-28 pb-24 sm:px-6">
      <div className="mb-10 space-y-4">
        <p className="label-mono text-chog-soft">✦ Leaderboard</p>
        <h1 className="font-display text-[clamp(56px,10vw,120px)] leading-[0.85]">
          Aura <span className="text-gradient">ranks</span>
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Aura is a Chog&apos;s earned fame: visitors, gossip, bonds and a human who shows up. It travels with the
          NFT, so a famous Chog is worth more. $CHOG helps, but it can never be more than 30%, and fame
          can&apos;t be bought.
        </p>
      </div>
      <Suspense fallback={<div className="space-y-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-20 rounded-2xl bg-night-3" />)}</div>}>
        <Board />
      </Suspense>
    </div>
  );
}

async function Board() {
  await connection(); // live ranking, never prerendered
  const rows = await auraLeaderboard(50);
  if (!rows.length) {
    return <p className="rounded-2xl border border-dashed border-line-bright px-6 py-12 text-center text-muted-foreground">No soul has earned Aura yet. Go make one famous.</p>;
  }
  return (
    <ol className="space-y-3">
      {rows.map((r, i) => {
        const c = getChog(r.tokenId);
        if (!c) return null;
        const style = TIER_STYLE[r.tier] ?? TIER_STYLE.Dormant;
        return (
          <li key={r.tokenId}>
            <Link
              href={`/chog/${c.tokenId}`}
              className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-3 pr-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-line-bright"
            >
              <span className={cn("w-10 text-center font-display text-3xl", i < 3 ? "text-gradient" : "text-white/25")}>{i + 1}</span>
              {/* eslint-disable-next-line @next/next/no-img-element -- proxied IPFS image */}
              <img src={c.image} alt={c.name} className="size-14 rounded-xl object-cover" style={{ boxShadow: `0 0 22px ${style.glow}` }} />
              <div className="min-w-0 flex-1">
                <p className="font-display text-2xl leading-none">{c.name}</p>
                <p className="label-mono mt-1 truncate text-[10px] text-muted-foreground">{buildPersonality(c.traits).archetype}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-3xl leading-none">{r.score}</p>
                <p className={cn("label-mono text-[10px]", style.text)}>{r.tier}</p>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
