"use client";

import { Download04Icon, Link01Icon, NewTwitterIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import Icon from "@/components/Icon";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Aura = { score: number; tier: string };

// Matches CARD_STYLES in lib/soul-card (server-only, so not imported here).
const STYLES = [
  { id: "night", label: "Night", swatch: "#101016" },
  { id: "poster", label: "Poster", swatch: "#f5da5b" },
  { id: "paper", label: "Paper", swatch: "#f4ecdd" },
] as const;
type Style = (typeof STYLES)[number]["id"];

// Preview of the Soul Card plus one-tap sharing. The holder picks a style, and
// the shared link (/chog/:id?card=style) unfurls on X into that same card.
export default function SoulCardShare({ tokenId }: { tokenId: number }) {
  const [copied, setCopied] = useState(false);
  const [style, setStyle] = useState<Style>("night");
  const [loaded, setLoaded] = useState<string>();
  const { data: aura } = useQuery({
    queryKey: ["aura", tokenId],
    queryFn: async (): Promise<Aura> => (await fetch(`/api/aura/${tokenId}`)).json(),
  });

  const pageUrl = () => `${window.location.origin}/chog/${tokenId}${style === "night" ? "" : `?card=${style}`}`;
  const src = `/api/card/${tokenId}?style=${style}`;

  function shareOnX() {
    const line = aura?.score
      ? `Chog #${tokenId} is ${aura.tier === "Dormant" ? "waking up" : `a ${aura.tier}`} with ${aura.score} Aura.`
      : `Meet Chog #${tokenId}.`;
    const text = `${line} It remembers every owner, every rival, every secret. 👀\n\n#ChogSouls @ChogNFT`;
    const url = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(pageUrl())}`;
    window.open(url, "_blank", "noopener,noreferrer,width=600,height=640");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(pageUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-line-bright bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-night-2/70 px-5 py-4">
        <h2 className="font-display text-2xl">Show off this soul</h2>
        <div className="flex gap-1 rounded-[10px] border border-line-bright p-1">
          {STYLES.map((st) => (
            <button
              key={st.id}
              onClick={() => setStyle(st.id)}
              className={cn(
                "label-mono flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] transition-colors",
                style === st.id ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="size-2.5 rounded-full border border-white/30" style={{ background: st.swatch }} />
              {st.label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 [perspective:1200px]">
        <div className="group/card shine relative aspect-[3/2] overflow-hidden rounded-xl border border-line-bright bg-night-3 shadow-[0_24px_60px_-24px_rgba(131,110,249,.7)] transition-transform duration-500 ease-out hover:[transform:rotateX(5deg)_rotateY(-7deg)_scale(1.02)]">
          {loaded !== src && <div className="absolute inset-0 animate-pulse bg-night-3" />}
          {/* eslint-disable-next-line @next/next/no-img-element -- generated PNG */}
          <img
            key={src}
            src={src}
            alt={`Soul Card for Chog #${tokenId}`}
            onLoad={() => setLoaded(src)}
            className="size-full object-cover transition-opacity duration-500"
            style={{ opacity: loaded === src ? 1 : 0 }}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border p-4">
        <Button onClick={shareOnX}>
          <Icon icon={NewTwitterIcon} size={15} />
          Share on X
        </Button>
        <Button variant="outline" nativeButton={false} render={<a href={`${src}&download=1`} download />}>
          <Icon icon={Download04Icon} size={15} />
          Download
        </Button>
        <Button variant="ghost" onClick={copyLink}>
          <Icon icon={copied ? Tick02Icon : Link01Icon} size={15} />
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
    </section>
  );
}
