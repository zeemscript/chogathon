"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { parseUnits } from "viem";
import { useWriteContract } from "wagmi";
import { Button } from "@/components/ui/button";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";
import { CHOG_TOKEN } from "@/lib/chain";
import {
  BubbleChatIcon,
  Coins01Icon,
  CrownIcon,
  EyeIcon,
  FavouriteIcon,
  FireIcon,
  Moon02Icon,
  SunriseIcon,
  Sun03Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import Icon from "@/components/Icon";
import { TIER_STYLE, TIERS } from "@/lib/tiers";
import { cn } from "@/lib/utils";

type Aura = {
  score: number;
  social: number;
  care: number;
  chog: number;
  chogRaw: number;
  neglect: number;
  tier: string;
  next?: { name: string; min: number; social: number };
  progress: number;
  blockedBySocial: boolean;
  idleDays: number;
  fading: boolean;
};

const TREASURY = process.env.NEXT_PUBLIC_CHOG_TREASURY as `0x${string}` | undefined;
const erc20 = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

const TIER_ICON = {
  Dormant: Moon02Icon,
  Awakened: SunriseIcon,
  Known: EyeIcon,
  Famous: FireIcon,
  "Legendary Soul": CrownIcon,
} as const;

// Wallet errors are long and scary; say what happened in one line.
function friendly(err: unknown, fallback: string) {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (/reject|denied|cancel/i.test(msg)) return "Cancelled in your wallet. No $CHOG was sent.";
  if (/insufficient|exceeds balance/i.test(msg)) return "Not enough $CHOG (or MON for gas) in this wallet.";
  return msg.split("\n")[0] || fallback;
}

export default function AuraPanel({ tokenId, owner }: { tokenId: number; owner?: string }) {
  const qc = useQueryClient();
  const { isOwner, auth, signIn, signing } = useOwnerAuth(owner);
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState<string>();
  const [flash, setFlash] = useState<string>();

  const { data: aura } = useQuery({
    queryKey: ["aura", tokenId],
    refetchInterval: 30_000,
    queryFn: async (): Promise<Aura> => (await fetch(`/api/aura/${tokenId}`)).json(),
  });

  async function care() {
    setBusy("care");
    setFlash(undefined);
    try {
      const a = auth ?? (await signIn());
      const res = await fetch("/api/care", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tokenId, auth: a }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setFlash(j.alreadyToday ? "Already checked in today. It noticed." : `+${j.granted} Aura · it missed you`);
      qc.setQueryData(["aura", tokenId], j.aura);
    } catch (err) {
      setFlash(friendly(err, "Couldn't check in"));
    } finally {
      setBusy(undefined);
    }
  }

  async function feed(amount: number) {
    if (!TREASURY) return;
    setBusy(`feed${amount}`);
    setFlash(undefined);
    try {
      const txHash = await writeContractAsync({
        address: CHOG_TOKEN,
        abi: erc20,
        functionName: "transfer",
        args: [TREASURY, parseUnits(String(amount), 18)],
      });
      setFlash("Feeding… waiting for Monad");
      const res = await fetch("/api/feed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tokenId, txHash }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setFlash(`Nom. +${j.points} Aura from ${j.amount} $CHOG`);
      qc.setQueryData(["aura", tokenId], j.aura);
    } catch (err) {
      setFlash(friendly(err, "Feeding failed"));
    } finally {
      setBusy(undefined);
    }
  }

  const tierName = (aura?.tier ?? "Dormant") as keyof typeof TIER_ICON;
  const style = TIER_STYLE[tierName] ?? TIER_STYLE.Dormant;
  const tierIdx = Math.max(0, TIERS.findIndex((t) => t.name === tierName));
  const total = aura ? aura.social + aura.care + aura.chog : 0;
  const parts = aura
    ? [
        { key: "Social", hint: "from visitors & the Square", value: aura.social, icon: UserGroupIcon, bar: "bg-chog-pink", text: "text-pink-300" },
        { key: "Care", hint: "from its human", value: aura.care, icon: FavouriteIcon, bar: "bg-chog-ok", text: "text-chog-ok" },
        { key: "$CHOG", hint: aura.chogRaw > aura.chog ? `capped at 30% (${aura.chogRaw} fed)` : "max 30%", value: aura.chog, icon: Coins01Icon, bar: "bg-chog-gold", text: "text-chog-gold" },
      ]
    : [];

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-line-bright bg-night/60 backdrop-blur-md"
      style={{ backgroundImage: `radial-gradient(120% 90% at 0% 0%, ${style.glow.replace(/[\d.]+\)$/, "0.22)")}, transparent 60%)` }}
    >
      <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:p-6">
        {/* The Aura reactor */}
        <div className="relative mx-auto grid size-36 shrink-0 place-items-center sm:mx-0">
          <div className="absolute inset-3 animate-core rounded-full blur-2xl" style={{ background: style.hex }} />
          <div
            className="absolute inset-0 animate-[spin_6s_linear_infinite] rounded-full p-[3px]"
            style={{ background: `conic-gradient(from 0deg, transparent 0deg, ${style.hex} 120deg, transparent 200deg, ${style.hex}99 300deg, transparent 360deg)` }}
          >
            <div className="size-full rounded-full bg-night" />
          </div>
          <div className="absolute inset-[10px] rounded-full border border-white/10 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,.08),transparent_60%)]" />
          {[14, 38, 62, 84].map((left, i) => (
            <span
              key={left}
              className="absolute bottom-8 size-1.5 animate-spark rounded-full"
              style={{ left: `${left}%`, background: style.hex, boxShadow: `0 0 8px ${style.hex}`, animationDelay: `${i * 0.8}s` }}
            />
          ))}
          <div className="relative text-center">
            <div className="font-display text-6xl leading-none [text-shadow:0_0_24px_rgba(255,255,255,.25)]">{aura?.score ?? "…"}</div>
            <div className="label-mono mt-1 text-[10px] text-muted-foreground">Aura</div>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-5">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl border border-white/10" style={{ background: `${style.hex}22`, color: style.hex }}>
              <Icon icon={TIER_ICON[tierName]} size={22} />
            </span>
            <div className="min-w-0">
              <p className="label-mono text-[10px] text-muted-foreground">Soul worth</p>
              <p className={cn("font-display text-4xl leading-none", style.text)}>{tierName}</p>
            </div>
          </div>

          {/* Tier ladder: the journey from Dormant to Legendary Soul */}
          <div>
            <div className="relative flex items-center justify-between">
              <div className="absolute inset-x-2 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/10" />
              <div
                className="absolute top-1/2 left-2 h-[3px] -translate-y-1/2 rounded-full transition-all duration-1000"
                style={{
                  width: `calc((100% - 1rem) * ${(tierIdx + (aura?.next ? aura.progress : 0)) / (TIERS.length - 1)})`,
                  background: `linear-gradient(90deg, #836ef9, ${style.hex})`,
                  boxShadow: `0 0 12px ${style.hex}`,
                }}
              />
              {TIERS.map((t, i) => {
                const reached = i <= tierIdx;
                const ts = TIER_STYLE[t.name];
                return (
                  <div key={t.name} className="relative z-10 grid place-items-center" title={`${t.name} · ${t.min}+ Aura`}>
                    <span
                      className={cn(
                        "grid size-7 place-items-center rounded-full border-2 transition-all",
                        i === tierIdx && "scale-125 animate-pulse-dot",
                      )}
                      style={{
                        borderColor: reached ? ts.hex : "rgba(255,255,255,.15)",
                        background: reached ? `${ts.hex}33` : "#0e0b1a",
                        color: reached ? ts.hex : "rgba(255,255,255,.3)",
                        boxShadow: i === tierIdx ? `0 0 18px ${ts.hex}` : undefined,
                      }}
                    >
                      <Icon icon={TIER_ICON[t.name]} size={13} />
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between">
              {TIERS.map((t, i) => (
                <span
                  key={t.name}
                  className={cn("label-mono w-12 text-center text-[8.5px] first:text-left last:text-right", i === tierIdx ? style.text : "text-muted-foreground/60")}
                >
                  {t.name.replace(" Soul", "")}
                </span>
              ))}
            </div>
            {aura?.next && (
              <p className="mt-3 text-sm text-muted-foreground">
                {aura.blockedBySocial ? (
                  <>
                    Has the points, needs <b className="text-pink-300">{aura.next.social} social Aura</b> to become {aura.next.name}.
                    Only others can make it famous.
                  </>
                ) : (
                  <>
                    <b className="text-foreground">{aura.next.min - aura.score} Aura</b> until {aura.next.name}
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Where its Aura came from */}
      {aura && (
        <div className="space-y-3 border-t border-border px-5 py-4 sm:px-6">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-white/10">
            {parts.map((p) =>
              p.value > 0 ? <div key={p.key} className={cn("h-full transition-all duration-700", p.bar)} style={{ width: `${(p.value / total) * 100}%` }} /> : null,
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {parts.map((p) => (
              <div key={p.key} className="flex min-w-0 items-start gap-2">
                <Icon icon={p.icon} size={16} className={cn("mt-0.5", p.text)} />
                <div className="min-w-0">
                  <p className="flex items-baseline gap-1.5">
                    <span className="font-display text-xl leading-none">{p.value}</span>
                    <span className="label-mono text-[9.5px] text-muted-foreground">{p.key}</span>
                  </p>
                  <p className="hidden truncate text-[11px] text-muted-foreground/80 sm:block">{p.hint}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {aura?.fading && (
        <p className="flex items-center gap-2 border-t border-chog-pink/30 bg-chog-pink/10 px-5 py-2.5 text-sm text-pink-200">
          <Icon icon={Moon02Icon} size={15} />
          Its human hasn&apos;t checked in for {aura.idleDays} days. Its Aura is fading ({aura.neglect}).
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3.5 sm:px-6">
        {isOwner ? (
          <Button size="sm" variant="ok" onClick={care} disabled={!!busy || signing}>
            <Icon icon={Sun03Icon} size={15} />
            {busy === "care" || signing ? "…" : "Daily check-in"}
          </Button>
        ) : (
          <span className="mr-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Icon icon={BubbleChatIcon} size={15} className="text-chog-soft" />
            Every visitor who talks to it adds Aura
          </span>
        )}
        {TREASURY ? (
          <div className="ml-auto flex items-center overflow-hidden rounded-[10px] border border-chog-gold/30 bg-chog-gold/[.04]">
            <span className="label-mono flex items-center gap-1.5 px-3 text-[10px] text-chog-gold">
              <Icon icon={Coins01Icon} size={14} />
              Feed
            </span>
            {[100, 500, 1000].map((n) => (
              <button
                key={n}
                onClick={() => feed(n)}
                disabled={!!busy}
                className="h-9 cursor-pointer border-l border-chog-gold/25 px-3 font-mono text-xs transition-colors hover:bg-chog-gold/15 hover:text-chog-gold disabled:opacity-50"
              >
                {busy === `feed${n}` ? "…" : n}
              </button>
            ))}
          </div>
        ) : (
          <span className="label-mono ml-auto text-[10px] text-muted-foreground/60">$CHOG feeding opens soon</span>
        )}
        {flash && <p className="w-full pt-1 text-sm text-chog-soft">{flash}</p>}
      </div>
    </section>
  );
}
