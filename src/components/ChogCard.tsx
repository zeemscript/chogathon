import Link from "next/link";
import type { Chog } from "@/lib/chogs";

// Traits that say most about a Chog's look; the rest appear on the detail page.
const HEADLINE = ["Tier", "Form", "Head", "Eyes", "Mouth", "Accessory"];

export default function ChogCard({ chog, href }: { chog: Chog; href?: string }) {
  const tags = HEADLINE.filter((t) => chog.traits[t] && chog.traits[t] !== "None").map((t) => chog.traits[t]);
  const card = (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-violet-400/60 hover:bg-white/10">
      {/* eslint-disable-next-line @next/next/no-img-element -- IPFS gateway image, skip the optimizer */}
      <img src={chog.image} alt={chog.name} loading="lazy" className="aspect-square w-full bg-black/40 object-cover" />
      <div className="space-y-2 p-3">
        <h3 className="font-semibold">{chog.name}</h3>
        <ul className="flex flex-wrap gap-1">
          {tags.slice(0, 4).map((t) => (
            <li key={t} className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs text-violet-200">
              {t}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}
