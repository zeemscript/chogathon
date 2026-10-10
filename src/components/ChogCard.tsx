import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Chog } from "@/lib/chogs";
import { buildPersonality } from "@/lib/personality";

const TIER_STYLE: Record<string, string> = {
  Legendary: "bg-chog-gold/20 text-chog-gold border-chog-gold/40",
  Epic: "bg-chog-pink/15 text-pink-300 border-chog-pink/40",
  Rare: "bg-chog-cyan/15 text-cyan-300 border-chog-cyan/40",
};

// `bare` shows just the art + tier (used for the back cards in the hero stack).
export default function ChogCard({
  chog,
  href,
  className,
  bare = false,
}: {
  chog: Chog;
  href?: string;
  className?: string;
  bare?: boolean;
}) {
  const soul = buildPersonality(chog.traits);
  const tier = chog.traits.Tier;
  const card = (
    <article
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:border-chog-soft/70 hover:shadow-[0_30px_60px_-24px_rgba(0,0,0,.9),0_16px_40px_-18px_rgba(131,110,249,.7)]",
        className,
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-night-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- IPFS gateway image, skip the optimizer */}
        <img
          src={chog.image}
          alt={chog.name}
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
        />
        {!bare && <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-card via-card/40 to-transparent" />}
        {tier && tier !== "Common" && (
          <span
            className={cn(
              "label-mono absolute top-3 left-3 rounded-full border px-2.5 py-1 text-[10px] backdrop-blur-md",
              TIER_STYLE[tier] ?? "border-line-bright bg-night/60 text-chog-soft",
            )}
          >
            {tier}
          </span>
        )}
      </div>
      <div className={cn("relative -mt-8 space-y-1 px-4 pb-4", bare && "hidden")}>
        <h3 className="font-display text-2xl">{chog.name}</h3>
        <p className="label-mono truncate text-[10.5px] text-chog-soft">{soul.archetype}</p>
      </div>
    </article>
  );
  return href ? (
    <Link href={href} className="block rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
      {card}
    </Link>
  ) : (
    card
  );
}
