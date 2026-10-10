import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import ChatPanel from "@/components/ChatPanel";
import OwnerBadge from "@/components/OwnerBadge";
import { getChog, parseTokenId } from "@/lib/chogs";
import { getOwner } from "@/lib/owners";
import { buildPersonality } from "@/lib/personality";

export default function ChogPage({ params }: PageProps<"/chog/[id]">) {
  return (
    <Suspense fallback={<p className="text-zinc-400">Summoning…</p>}>
      <ChogView params={params} />
    </Suspense>
  );
}

async function ChogView({ params }: { params: PageProps<"/chog/[id]">["params"] }) {
  const tokenId = parseTokenId((await params).id);
  if (!tokenId) notFound();
  const chog = getChog(tokenId)!;
  const owner = await getOwner(tokenId);
  const soul = buildPersonality(chog.traits);

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← All Chogs
      </Link>
      <div className="grid gap-8 md:grid-cols-[320px_1fr]">
        {/* eslint-disable-next-line @next/next/no-img-element -- IPFS gateway image */}
        <img src={chog.image} alt={chog.name} className="aspect-square w-full rounded-2xl bg-black/40 object-cover" />
        <div className="space-y-5">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">{chog.name}</h1>
            <OwnerBadge owner={owner} />
          </div>
          <section className="space-y-2 rounded-2xl border border-violet-400/20 bg-violet-500/5 p-4">
            <p className="text-lg">
              <span className="font-semibold text-violet-300">{soul.archetype}</span>
              <span className="text-zinc-400"> · {soul.temperament.join(", ")}</span>
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-300">
              {soul.quirks.map((q) => (
                <li key={q}>{q}</li>
              ))}
              <li>loves {soul.likes.join(" and ")}, can&apos;t stand {soul.dislikes.join(", ")}</li>
            </ul>
          </section>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(chog.traits).map(([k, v]) => (
              <div key={k} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <dt className="text-xs uppercase tracking-wide text-zinc-500">{k}</dt>
                <dd className="text-sm">{v}</dd>
              </div>
            ))}
          </dl>
          <ChatPanel tokenId={tokenId} name={chog.name} owner={owner} />
        </div>
      </div>
    </div>
  );
}
