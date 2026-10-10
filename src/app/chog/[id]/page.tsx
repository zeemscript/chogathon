import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import Icon from "@/components/Icon";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import AuraPanel from "@/components/AuraPanel";
import ChatPanel from "@/components/ChatPanel";
import ChogTabs from "@/components/ChogTabs";
import OwnerBadge from "@/components/OwnerBadge";
import Relations from "@/components/Relations";
import SoulCardShare from "@/components/SoulCardShare";
import TownFeed from "@/components/TownFeed";
import { Skeleton } from "@/components/ui/skeleton";
import { getChog, parseTokenId } from "@/lib/chogs";
import { getOwner } from "@/lib/owners";
import { buildPersonality } from "@/lib/personality";
import { getRelations } from "@/lib/town";
import { cn } from "@/lib/utils";

const RARITY_RING: Record<string, string> = {
  Legendary: "from-amber-200 to-chog-gold shadow-[0_0_60px_rgba(245,158,11,.45)]",
  Epic: "from-pink-300 to-chog-pink shadow-[0_0_60px_rgba(236,72,153,.4)]",
  Rare: "from-cyan-300 to-chog-cyan shadow-[0_0_60px_rgba(34,211,238,.35)]",
};

export async function generateMetadata({ params }: PageProps<"/chog/[id]">): Promise<Metadata> {
  const tokenId = parseTokenId((await params).id);
  const chog = tokenId ? getChog(tokenId) : undefined;
  if (!chog) return { title: "Chog Souls" };
  const soul = buildPersonality(chog.traits);
  const title = `${chog.name}, ${soul.archetype} · Chog Souls`;
  const description = `A ${soul.temperament.join(", ")} Chog with a soul. It remembers every owner, every rival, every secret.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "profile" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function ChogPage({ params }: PageProps<"/chog/[id]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-20 pb-24 sm:px-6">
      <Suspense fallback={<ChogSkeleton />}>
        <ChogView params={params} />
      </Suspense>
    </div>
  );
}

function ChogSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[420px] rounded-3xl bg-night-3" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[520px] rounded-2xl bg-night-3" />
        <Skeleton className="h-[520px] rounded-2xl bg-night-3" />
      </div>
    </div>
  );
}

// A Chog's character in plain words: no icons, just labels.
function SoulNotes({ quirks, likes, dislikes }: { quirks: string[]; likes: string; dislikes: string }) {
  const label = "label-mono text-[9.5px] text-muted-foreground/70";
  return (
    <div className="space-y-3 text-sm">
      {quirks.length > 0 && (
        <div>
          <p className={label}>Quirks</p>
          <ul className="mt-1.5 space-y-1 border-l border-line-bright pl-3 text-foreground/85">
            {quirks.map((q, i) => (
              <li key={q} className={cn("leading-snug", i >= 1 && "hidden sm:block")}>
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1">
        <dt className={label}>Loves</dt>
        <dd className="text-foreground/85">{likes}</dd>
        <dt className={label}>Can&apos;t stand</dt>
        <dd className="text-foreground/85">{dislikes}</dd>
      </dl>
    </div>
  );
}

async function ChogView({ params }: { params: PageProps<"/chog/[id]">["params"] }) {
  const tokenId = parseTokenId((await params).id);
  if (!tokenId) notFound();
  const chog = getChog(tokenId)!;
  const [owner, relations] = await Promise.all([getOwner(tokenId), getRelations(tokenId).catch(() => [])]);
  const soul = buildPersonality(chog.traits);
  const traits = Object.entries(chog.traits).filter(([, v]) => v && v !== "None");
  const tier = chog.traits.Tier ?? "Chog";
  const notes = (
    <SoulNotes quirks={soul.quirks} likes={soul.likes.join(" & ")} dislikes={soul.dislikes.join(", ")} />
  );

  return (
    <div className="space-y-4">
      <Link href="/#meet" className="label-mono relative z-10 inline-block text-muted-foreground transition-colors hover:text-foreground">
        <span className="inline-flex items-center gap-1.5"><Icon icon={ArrowLeft01Icon} size={14} />All Chogs</span>
      </Link>

      {/* PROFILE HEADER */}
      <section className="relative overflow-hidden rounded-3xl border border-line-bright bg-card shadow-card">
        {/* blurred art backdrop */}
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative backdrop */}
        <img src={chog.image} alt="" aria-hidden className="absolute inset-0 size-full scale-125 object-cover opacity-30 blur-3xl saturate-150" />
        <div className="absolute inset-0 bg-gradient-to-b from-night/40 via-card/85 to-card" />

        <div className="relative grid gap-5 p-4 sm:p-6 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-8">
          {/* portrait + soul notes (desktop) */}
          <div className="hidden space-y-5 lg:block">
            <div className={cn(
              "rounded-[22px] bg-gradient-to-br p-[3px]",
              RARITY_RING[tier] ?? "from-chog-soft to-chog-deep shadow-[0_0_50px_rgba(131,110,249,.35)]",
            )}>
              {/* eslint-disable-next-line @next/next/no-img-element -- IPFS gateway image */}
              <img src={chog.image} alt={chog.name} className="aspect-square w-full rounded-[19px] object-cover" />
            </div>
            {notes}
          </div>

          {/* identity + soul + aura */}
          <div className="min-w-0 space-y-4">
            <div className="flex items-center gap-4">
              {/* portrait (phones/tablets): small, beside the name */}
              <div className={cn("w-24 shrink-0 sm:w-28 lg:hidden", "rounded-[18px] bg-gradient-to-br p-[2px]", RARITY_RING[tier] ?? "from-chog-soft to-chog-deep")}>
                {/* eslint-disable-next-line @next/next/no-img-element -- IPFS gateway image */}
                <img src={chog.image} alt={chog.name} className="aspect-square w-full rounded-[16px] object-cover" />
              </div>
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="label-mono rounded-full border border-line-bright bg-chog/15 px-2.5 py-0.5 text-[10.5px] text-chog-soft">{tier}</span>
                  <OwnerBadge owner={owner} />
                </div>
                <h1 className="font-display text-[clamp(44px,8vw,92px)] leading-[0.82]">
                  Chog <span className="text-gradient">#{chog.tokenId}</span>
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 font-display text-2xl">{soul.archetype}</span>
              {soul.temperament.map((t, i) => (
                <span
                  key={t}
                  className={
                    i === 0
                      ? "label-mono animate-chip-pulse rounded-full border border-white/40 bg-[linear-gradient(135deg,#836ef9,#a855f7)] px-2.5 py-1 text-[10px] text-white"
                      : "label-mono rounded-full border border-line-bright bg-white/[.04] px-2.5 py-1 text-[10px] text-chog-soft"
                  }
                >
                  {t}
                </span>
              ))}
            </div>
            {/* phones/tablets: notes stay beside the identity */}
            <div className="lg:hidden">{notes}</div>
            <AuraPanel tokenId={tokenId} owner={owner} />
          </div>
        </div>
      </section>

      {/* BODY: talk on the left, its world on the right */}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-24">
          <ChatPanel tokenId={tokenId} name={chog.name} owner={owner} />
        </div>
        <ChogTabs
          counts={{ rivals: relations.length }}
          rivals={<Relations relations={relations} />}
          gossip={<TownFeed tokenId={tokenId} compact limit={8} />}
          card={<SoulCardShare tokenId={tokenId} />}
          traits={
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {traits.map(([k, v]) => (
                <div key={k} className="rounded-xl border border-border bg-white/[.03] px-4 py-3 transition-colors hover:border-line-bright">
                  <dt className="label-mono text-[10px] text-muted-foreground">{k}</dt>
                  <dd className="mt-1 text-sm font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          }
        />
      </div>
    </div>
  );
}
