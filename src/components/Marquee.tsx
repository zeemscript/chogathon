const ITEMS = [
  "every chog has a soul",
  "memories travel with the nft",
  "sold? it remembers",
  "friends & grudges",
  "1,969 souls on monad",
  "talk to your chog",
  "take the nft out, the soul is gone",
];

export default function Marquee() {
  const row = ITEMS.map((t) => (
    <span key={t} className="flex items-center gap-6 px-6">
      {t}
      <span className="text-chog-soft">✦</span>
    </span>
  ));
  return (
    <div className="relative overflow-hidden border-y border-border bg-night-2/80 py-4">
      <div className="label-mono flex w-max animate-marquee text-[13px] tracking-[0.22em] text-muted-foreground">
        {row}
        {row}
      </div>
    </div>
  );
}
