"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type Aura = { score: number; tier: string };

// Preview of the Soul Card plus one-tap sharing. Links to /chog/:id unfurl on X
// into the same card (opengraph-image), so the tweet sells the Chog itself.
export default function SoulCardShare({ tokenId }: { tokenId: number }) {
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { data: aura } = useQuery({
    queryKey: ["aura", tokenId],
    queryFn: async (): Promise<Aura> => (await fetch(`/api/aura/${tokenId}`)).json(),
  });

  const pageUrl = () => `${window.location.origin}/chog/${tokenId}`;

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
        <span className="label-mono text-[10px] text-muted-foreground">Updates as its Aura grows</span>
      </div>
      <div className="p-4 [perspective:1200px]">
        <div className="group/card shine relative aspect-[1200/630] overflow-hidden rounded-xl border border-line-bright bg-night-3 shadow-[0_24px_60px_-24px_rgba(131,110,249,.7)] transition-transform duration-500 ease-out hover:[transform:rotateX(5deg)_rotateY(-7deg)_scale(1.02)]">
          {!loaded && <div className="absolute inset-0 animate-pulse bg-night-3" />}
          {/* eslint-disable-next-line @next/next/no-img-element -- generated PNG */}
          <img
            src={`/api/card/${tokenId}`}
            alt={`Soul Card for Chog #${tokenId}`}
            onLoad={() => setLoaded(true)}
            className="size-full object-cover transition-opacity duration-500"
            style={{ opacity: loaded ? 1 : 0 }}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border p-4">
        <Button onClick={shareOnX}>
          <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-current">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Share on X
        </Button>
        <Button variant="outline" nativeButton={false} render={<a href={`/api/card/${tokenId}?download=1`} download />}>
          Download
        </Button>
        <Button variant="ghost" onClick={copyLink}>
          {copied ? "Copied ✓" : "Copy link"}
        </Button>
      </div>
    </section>
  );
}
