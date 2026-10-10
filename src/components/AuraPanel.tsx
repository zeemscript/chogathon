"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { parseUnits } from "viem";
import { useWriteContract } from "wagmi";
import { Button } from "@/components/ui/button";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";
import { CHOG_TOKEN } from "@/lib/chain";
import { BubbleChatIcon, Coins01Icon, FireIcon, Sun03Icon } from "@hugeicons/core-free-icons";
import Icon from "@/components/Icon";
import { TIER_STYLE } from "@/lib/tiers";
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

function Bar({ label, value, total, cls, note }: { label: string; value: number; total: number; cls: string; note?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="label-mono truncate text-[10px] whitespace-nowrap text-muted-foreground">{label}</span>
        <span className="font-mono text-xs">
          {value}
          {note && <span className="ml-1.5 text-muted-foreground">{note}</span>}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={cn("h-full rounded-full transition-all duration-700", cls)} style={{ width: `${total ? (value / total) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

// Wallet errors are long and scary; say what happened in one line.
function friendly(err: unknown, fallback: string) {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (/reject|denied|cancel/i.test(msg)) return "Cancelled in your wallet. No $CHOG was sent.";
  if (/insufficient|exceeds balance/i.test(msg)) return "Not enough $CHOG (or MON for gas) in this wallet.";
  return msg.split("\n")[0] || fallback;
}

export default function AuraPanel({ tokenId, owner }: { tokenId: number; owner?: string }) {
  const qc = useQueryClient();
  const { address, isOwner, auth, signIn, signing } = useOwnerAuth(owner);
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
      setFlash(
        j.alreadyToday
          ? "Already checked in today. It noticed."
          : `+${j.granted} Aura · day ${j.streak} in a row${j.multiplier > 1 ? ` (×${j.multiplier} streak bonus)` : ""}`,
      );
      qc.setQueryData(["aura", tokenId], j.aura);
    } catch (err) {
      setFlash(friendly(err, "Couldn't check in"));
    } finally {
      setBusy(undefined);
    }
  }

  async function hype() {
    setBusy("hype");
    setFlash(undefined);
    try {
      const a = auth ?? (await signIn());
      const res = await fetch("/api/hype", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tokenId, auth: a }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setFlash(j.alreadyToday ? "You already hyped it today. Come back tomorrow." : `+${j.granted} Aura · hyped! ${j.hypesLeft} hypes left today`);
      qc.setQueryData(["aura", tokenId], j.aura);
    } catch (err) {
      setFlash(friendly(err, "Couldn't hype"));
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

  const style = TIER_STYLE[aura?.tier ?? "Dormant"] ?? TIER_STYLE.Dormant;
  const total = aura ? Math.max(1, aura.social + aura.care + aura.chog) : 1;

  return (
    <section className="rounded-2xl border border-line-bright bg-night/55 backdrop-blur-md">
      <div className="flex items-center gap-4 p-4 sm:gap-5 sm:p-5">
        {/* Aura orb */}
        <div className="relative grid size-16 shrink-0 place-items-center sm:size-[88px]">
          <div
            className={cn("absolute inset-0 animate-[spin_9s_linear_infinite] rounded-full bg-gradient-to-br p-[3px]", style.ring)}
            style={{ boxShadow: `0 0 34px ${style.glow}` }}
          >
            <div className="size-full rounded-full bg-card" />
          </div>
          <div className="relative text-center">
            <div className="font-display text-3xl leading-none sm:text-4xl">{aura?.score ?? "…"}</div>
            <div className="label-mono text-[9px] text-muted-foreground">Aura</div>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <p className={cn("font-display text-2xl leading-none sm:text-3xl", style.text)}>{aura?.tier ?? "…"}</p>
            <p className="label-mono text-[10px] text-muted-foreground">Soul worth</p>
          </div>
          {aura?.next && (
            <>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700", style.ring)}
                  style={{ width: `${Math.max(3, Math.round(aura.progress * 100))}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {aura.blockedBySocial
                  ? `Needs ${aura.next.social} social Aura to become ${aura.next.name}. Only others can make it famous.`
                  : `${aura.next.min - aura.score} Aura to ${aura.next.name}`}
              </p>
            </>
          )}
        </div>
      </div>

      {aura && (
        <div className="grid grid-cols-3 gap-4 border-t border-border px-4 py-3.5 sm:px-5">
          <Bar label="Social" value={aura.social} total={total} cls="bg-chog-pink" />
          <Bar label="Care" value={aura.care} total={total} cls="bg-chog-ok" />
          <Bar
            label="$CHOG ≤30%"
            value={aura.chog}
            total={total}
            cls="bg-chog-gold"
            note={aura.chogRaw > aura.chog ? `/${aura.chogRaw}` : undefined}
          />
        </div>
      )}

      {aura?.fading && (
        <p className="border-t border-chog-pink/30 bg-chog-pink/10 px-5 py-2.5 text-sm text-pink-200">
          Its human hasn&apos;t checked in for {aura.idleDays} days. Its Aura is fading ({aura.neglect}).
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3 sm:px-5">
        {isOwner ? (
          <Button size="sm" variant="ok" onClick={care} disabled={!!busy || signing}>
            <Icon icon={Sun03Icon} size={14} />
            {busy === "care" || signing ? "…" : "Daily check-in"}
          </Button>
        ) : (
          <>
            <Button size="sm" onClick={hype} disabled={!!busy || signing || !address}>
              <Icon icon={FireIcon} size={14} />
              {busy === "hype" || signing ? "…" : "Hype"}
            </Button>
            <span className="mr-auto hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <Icon icon={BubbleChatIcon} size={14} className="text-chog-soft" />
              {address ? "+3 Aura, once a day" : "Connect a wallet to hype"}
            </span>
          </>
        )}
        {TREASURY ? (
          <div className="ml-auto flex items-center overflow-hidden rounded-[10px] border border-line-bright">
            <span className="label-mono flex items-center gap-1.5 px-2.5 text-[10px] text-chog-gold sm:px-3">
              <Icon icon={Coins01Icon} size={14} />
              <span className="hidden sm:inline">Feed</span>
            </span>
            {[100, 500, 1000].map((n) => (
              <button
                key={n}
                onClick={() => feed(n)}
                disabled={!!busy}
                className="h-9 cursor-pointer border-l border-line-bright px-2.5 font-mono text-xs sm:px-3 transition-colors hover:bg-chog-gold/15 hover:text-chog-gold disabled:opacity-50"
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
