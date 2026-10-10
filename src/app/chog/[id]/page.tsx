import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import ChatPanel from "@/components/ChatPanel";
import OwnerBadge from "@/components/OwnerBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { getChog, parseTokenId } from "@/lib/chogs";
import { getOwner } from "@/lib/owners";
import { buildPersonality } from "@/lib/personality";

export default function ChogPage({ params }: PageProps<"/chog/[id]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-28 pb-24 sm:px-6">
      <Suspense fallback={<ChogSkeleton />}>
        <ChogView params={params} />
      </Suspense>
    </div>
  );
}

function ChogSkeleton() {
  return (
    <div className="grid gap-10 lg:grid-cols-[400px_1fr]">
      <Skeleton className="aspect-square rounded-2xl bg-night-3" />
      <div className="space-y-4">
        <Skeleton className="h-20 w-2/3 bg-night-3" />
        <Skeleton className="h-96 rounded-2xl bg-night-3" />
      </div>
    </div>
  );
}

async function ChogView({ params }: { params: PageProps<"/chog/[id]">["params"] }) {
  const tokenId = parseTokenId((await params).id);
  if (!tokenId) notFound();
  const chog = getChog(tokenId)!;
  const owner = await getOwner(tokenId);
  const soul = buildPersonality(chog.traits);
  const traits = Object.entries(chog.traits).filter(([, v]) => v && v !== "None");

  return (
    <div className="space-y-8">
      <Link href="/#meet" className="label-mono text-muted-foreground transition-colors hover:text-foreground">
        ← All Chogs
      </Link>

      <div className="grid items-start gap-10 lg:grid-cols-[400px_1fr]">
        {/* Left: portrait + soul */}
        <aside className="space-y-6 lg:sticky lg:top-24">
          <div className="animate-float">
            <div className="animate-rise overflow-hidden rounded-2xl border border-line-bright bg-night-3 shadow-[0_52px_90px_-34px_rgba(0,0,0,.95),0_20px_46px_-16px_rgba(131,110,249,.6),inset_0_1px_0_rgba(255,255,255,.22)]">
              {/* eslint-disable-next-line @next/next/no-img-element -- IPFS gateway image */}
              <img src={chog.image} alt={chog.name} className="aspect-square w-full object-cover" />
            </div>
          </div>

          <div className="rounded-2xl border border-line-bright bg-card p-5 shadow-card">
            <p className="label-mono text-chog-soft">✦ Soul</p>
            <p className="mt-2 font-display text-3xl">{soul.archetype}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {soul.temperament.map((t, i) => (
                <span
                  key={t}
                  className={
                    i === 0
                      ? "label-mono animate-chip-pulse rounded-full border border-white/40 bg-[linear-gradient(135deg,#836ef9,#a855f7)] px-3 py-1.5 text-[10.5px] text-white"
                      : "label-mono rounded-full border border-line-bright bg-white/[.04] px-3 py-1.5 text-[10.5px] text-chog-soft"
                  }
                >
                  {t}
                </span>
              ))}
            </div>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {soul.quirks.map((q) => (
                <li key={q} className="flex gap-2">
                  <span className="text-chog-soft">✦</span>
                  {q}
                </li>
              ))}
              <li className="flex gap-2">
                <span className="text-chog-pink">♥</span>
                loves {soul.likes.join(" and ")}
              </li>
              <li className="flex gap-2">
                <span className="text-chog-gold">✕</span>
                can&apos;t stand {soul.dislikes.join(", ")}
              </li>
            </ul>
          </div>
        </aside>

        {/* Right: identity, chat, traits */}
        <div className="min-w-0 space-y-8">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="label-mono rounded-full border border-line-bright bg-chog/12 px-3 py-1 text-chog-soft">
                {chog.traits.Tier ?? "Chog"}
              </span>
              <OwnerBadge owner={owner} />
            </div>
            <h1 className="font-display text-[clamp(64px,9vw,120px)] leading-[0.82]">
              Chog <span className="text-gradient">#{chog.tokenId}</span>
            </h1>
          </div>

          <ChatPanel tokenId={tokenId} name={chog.name} owner={owner} />

          <section className="space-y-4">
            <p className="label-mono text-chog-soft">✦ Traits</p>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {traits.map(([k, v]) => (
                <div
                  key={k}
                  className="rounded-xl border border-border bg-white/[.03] px-4 py-3 transition-colors hover:border-line-bright"
                >
                  <dt className="label-mono text-[10px] text-muted-foreground">{k}</dt>
                  <dd className="mt-1 text-sm font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
