"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { useStory } from "./StoryTimeline";
import { useViewer } from "@/hooks/useOwnerAuth";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const KEY = (t: number, a: string) => `chog-souls:met:${t}:${a.toLowerCase()}`;
const FRESH_MS = 30 * 86_400_000; // only for Chogs that changed hands in the last 30 days

// Read a browser-only value safely (false during server render).
const noop = () => () => {};
function useBrowser(read: () => boolean) {
  return useSyncExternalStore(noop, read, () => false);
}

// What it says when it first sees you, shaped by its temperament.
function firstWords(temperament: string[], prev: string) {
  const t = temperament.join(" ");
  if (/suspicious|paranoid|short-tempered|petty/.test(t)) return [`You're not ${prev}.`, "Where did they go? What did you do with them?"];
  if (/sensitive|dreamy|affectionate|wholesome/.test(t)) return [`${prev} used to say gm to me every day.`, "…Will you?"];
  if (/posh|regal|boastful/.test(t)) return ["Ah. The new staff.", `${prev} knew how to treat a Chog. Let's see if you do.`];
  if (/sarcastic|degen|chaotic|goofy/.test(t)) return [`Oh great, a new one.`, `${prev} paper-handed me, didn't they. Classic.`];
  return [`So you're my human now.`, `I still remember ${prev}. I remember everything.`];
}

// Full-screen moment when a Chog meets its new owner for the first time.
export default function FirstMeeting({
  tokenId,
  name,
  temperament,
  owner,
}: {
  tokenId: number;
  name: string;
  temperament: string[];
  owner?: string;
}) {
  const { address, isOwner } = useViewer(owner);
  const { data } = useStory(tokenId);
  const [closed, setClosed] = useState(false);

  // Dev preview: add ?meet=1 to see the screen without a real sale.
  const forced = useBrowser(() => process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).has("meet"));
  const seen = useBrowser(() => {
    try {
      return !!address && localStorage.getItem(KEY(tokenId, address)) === "1";
    } catch {
      return false;
    }
  });
  const m = data?.meeting;
  const fresh = !!m && Date.parse(m.since) > Date.parse(new Date().toISOString().slice(0, 10)) - FRESH_MS;

  const show = !closed && (forced || (isOwner && fresh && !seen));
  if (!show) return null;

  const prev = short(m?.previousOwner ?? "0x3d38fee3e1a4c43d8fcf715aa6c9ff025074e7e0");
  const [line1, line2] = firstWords(temperament, prev);

  // Addresses read badly in the uppercase display font: render them in mono.
  const withAddress = (line: string) =>
    line.split(prev).flatMap((part, i) =>
      i === 0
        ? [part]
        : [
            <span key={i} className="font-mono text-[0.62em] tracking-normal text-chog-soft normal-case">
              {prev}
            </span>,
            part,
          ],
    );

  function close(talk: boolean) {
    try {
      if (address) localStorage.setItem(KEY(tokenId, address), "1");
    } catch {}
    setClosed(true);
    if (talk) window.dispatchEvent(new CustomEvent("chog:prefill", { detail: "gm… I'm your new human." }));
  }

  return (
    <div className="fixed inset-0 z-[70] grid animate-in place-items-center bg-night/80 p-4 backdrop-blur-xl duration-500 fade-in">
      <div className="w-full max-w-md animate-in space-y-6 text-center duration-700 zoom-in-95 slide-in-from-bottom-4">
        <div className="mx-auto w-44 rounded-[26px] bg-gradient-to-br from-chog-soft to-chog-deep p-[3px] shadow-[0_0_80px_rgba(131,110,249,.55)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- proxied IPFS image */}
          <img src={`/api/img/${tokenId}`} alt={name} className="aspect-square w-full rounded-[23px] object-cover" />
        </div>
        <div className="space-y-3">
          <p className="label-mono text-chog-soft">{name} notices you</p>
          <p className="font-display text-[clamp(34px,8vw,48px)] leading-[1]">{withAddress(line1)}</p>
          <p className="text-lg text-muted-foreground">{withAddress(line2)}</p>
        </div>
        <p className="text-sm text-muted-foreground/80">
          Its memories came with it: every chat, every friend, every grudge. Its trust in you starts at zero.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button size="lg" variant="hero" onClick={() => close(true)}>
            Say gm
          </Button>
          <Button size="lg" variant="ghost" onClick={() => close(false)}>
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}
