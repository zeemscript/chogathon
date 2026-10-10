"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { friendly, OWNER_SHARE, TREASURY, useChogPay } from "@/hooks/useChogPay";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";
import { Coins01Icon, FireIcon, Sun03Icon } from "@hugeicons/core-free-icons";
import AuraFlame from "@/components/AuraFlame";
import Icon from "@/components/Icon";
import RoastButton from "@/components/RoastButton";
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

export default function AuraPanel({ tokenId, owner }: { tokenId: number; owner?: string }) {
  const qc = useQueryClient();
  const { address, isOwner, auth, signIn, signing } = useOwnerAuth(owner);
  const pay = useChogPay();
  const [busy, setBusy] = useState<string>();
  const { openConnectModal } = useConnectModal();

  // No wallet yet? Ask for one in a toast instead of cluttering the card.
  function needWallet(why: string) {
    toast("Connect a wallet first", {
      description: why,
      action: openConnectModal ? { label: "Connect", onClick: () => openConnectModal() } : undefined,
    });
  }

  const { data: aura } = useQuery({
    queryKey: ["aura", tokenId],
    refetchInterval: 30_000,
    queryFn: async (): Promise<Aura> => (await fetch(`/api/aura/${tokenId}`)).json(),
  });

  async function care() {
    setBusy("care");
    try {
      const a = auth ?? (await signIn());
      const res = await fetch("/api/care", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tokenId, auth: a }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      if (j.alreadyToday) toast("Already checked in today", { description: "It noticed. Come back tomorrow to keep the streak." });
      else
        toast.success(`+${j.granted} Aura · it missed you`, {
          description: `Day ${j.streak} in a row${j.multiplier > 1 ? ` · ×${j.multiplier} streak bonus` : ""}`,
        });
      qc.setQueryData(["aura", tokenId], j.aura);
    } catch (err) {
      toast.error(friendly(err, "Couldn't check in"));
    } finally {
      setBusy(undefined);
    }
  }

  async function hype() {
    if (!address) return needWallet("Hyping gives this Chog +3 Aura, once a day.");
    setBusy("hype");
    try {
      const a = auth ?? (await signIn());
      const res = await fetch("/api/hype", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tokenId, auth: a }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      if (j.alreadyToday) toast("You already hyped it today", { description: "Come back tomorrow." });
      else toast.success(`+${j.granted} Aura · hyped!`, { description: `${j.hypesLeft} hypes left today` });
      qc.setQueryData(["aura", tokenId], j.aura);
    } catch (err) {
      toast.error(friendly(err, "Couldn't hype"));
    } finally {
      setBusy(undefined);
    }
  }

  // Fans: 80% to the Chog's owner, 20% to the treasury (two quick confirms).
  // Owners feeding their own Chog: 100% to the treasury.
  async function feed(amount: number) {
    if (!TREASURY) return;
    if (!address) return needWallet(`Feeding sends ${amount} $CHOG and grows its Aura.`);
    setBusy(`feed${amount}`);
    const self = isOwner || !owner;
    const toOwner = self ? 0 : Math.round(amount * OWNER_SHARE);
    const toVault = amount - toOwner;
    const t = toast.loading(`Feeding ${amount} $CHOG…`, { description: self ? "Confirm in your wallet" : `1/2 · ${toOwner} $CHOG to its owner` });
    try {
      const a = auth ?? (await signIn()); // proves the feed is ours to claim
      const txHashes: string[] = [];
      if (toOwner) txHashes.push(await pay(owner as `0x${string}`, toOwner));
      if (toOwner) toast.loading(`Feeding ${amount} $CHOG…`, { id: t, description: `2/2 · ${toVault} $CHOG platform fee` });
      txHashes.push(await pay(TREASURY, toVault));
      toast.loading(`Feeding ${amount} $CHOG…`, { id: t, description: "Waiting for Monad" });
      const res = await fetch("/api/feed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tokenId, txHashes, auth: a }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success(`Nom. +${j.points} Aura`, {
        id: t,
        description: j.toOwner ? `${j.amount} $CHOG fed · ${j.toOwner} went to its owner` : `${j.amount} $CHOG fed`,
      });
      qc.setQueryData(["aura", tokenId], j.aura);
    } catch (err) {
      toast.error(friendly(err, "Feeding failed"), { id: t, description: undefined });
    } finally {
      setBusy(undefined);
    }
  }


  const style = TIER_STYLE[aura?.tier ?? "Dormant"] ?? TIER_STYLE.Dormant;
  const total = aura ? Math.max(1, aura.social + aura.care + aura.chog) : 1;

  return (
    <section className="rounded-2xl border border-line-bright bg-night/55 backdrop-blur-md">
      <div className="flex items-center gap-4 p-4 sm:gap-5 sm:p-5">
        {/* Aura: the Soul flame, with the score where its face would be */}
        <AuraFlame score={aura?.score} glow={style.glow} className="size-[72px] sm:size-24" numberClass="text-[26px] sm:text-[36px]" />

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
            <Button size="sm" onClick={hype} disabled={!!busy || signing}>
              <Icon icon={FireIcon} size={14} />
              {busy === "hype" || signing ? "…" : "Hype"}
            </Button>
            <RoastButton targetId={tokenId} targetName={`#${tokenId}`} />
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
      </div>
    </section>
  );
}
