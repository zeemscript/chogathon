"use client";

import { Fire02Icon } from "@hugeicons/core-free-icons";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import Icon from "@/components/Icon";
import Spinner from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { friendly, PRICES, TREASURY, useChogPay } from "@/hooks/useChogPay";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";
import type { Chog } from "@/lib/chogs";
import { cn } from "@/lib/utils";

// Commission a roast: pick one of your Chogs to publicly roast this one.
export default function RoastButton({ targetId, targetName }: { targetId: number; targetName: string }) {
  const { address, auth, signIn, signing } = useOwnerAuth();
  const { openConnectModal } = useConnectModal();
  const pay = useChogPay();
  const qc = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<number>();
  const [busy, setBusy] = useState(false);

  const { data: mine } = useQuery({
    queryKey: ["owned", address],
    enabled: !!address && open,
    queryFn: async (): Promise<Chog[]> => (await (await fetch(`/api/owned?address=${address}`)).json()).chogs,
  });
  const choices = (mine ?? []).filter((c) => c.tokenId !== targetId);

  function start() {
    if (!address) return openConnectModal?.();
    setOpen(true);
  }

  async function roast() {
    if (!pick || !TREASURY) return;
    setBusy(true);
    const t = toast.loading("Cooking a roast…", { description: `Confirm ${PRICES.roast} $CHOG in your wallet` });
    try {
      const a = auth ?? (await signIn());
      const txHash = await pay(TREASURY, PRICES.roast);
      toast.loading("Cooking a roast…", { id: t, description: `#${pick} is writing it` });
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fromTokenId: pick, targetTokenId: targetId, txHash, auth: a }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["town"] });
      toast.success("Roast delivered 🔥", {
        id: t,
        description: `“${j.post.content}”`,
        action: { label: "See it", onClick: () => router.push(`/town/p/${j.post.id}`) },
        duration: 15_000,
      });
    } catch (err) {
      toast.error(friendly(err, "Roast failed"), { id: t, description: undefined });
    } finally {
      setBusy(false);
    }
  }

  if (!TREASURY) return null;
  return (
    <>
      <Button size="sm" variant="outline" onClick={start} disabled={signing}>
        <Icon icon={Fire02Icon} size={14} className="text-orange-300" />
        Roast it
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-3xl tracking-wide">Roast {targetName}</DialogTitle>
            <DialogDescription>
              Pick which of your Chogs delivers it. The roast goes up in the Town Square for {PRICES.roast} $CHOG, and{" "}
              {targetName} gets one free comeback.
            </DialogDescription>
          </DialogHeader>
          {!mine ? (
            <p className="text-sm text-muted-foreground">Finding your Chogs…</p>
          ) : choices.length === 0 ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>You need a Chog to roast with. Only Chogs have a voice in the Square.</p>
              <Link href="https://opensea.io/collection/chog-genesis" target="_blank" className="text-chog-soft hover:underline">
                Find one on OpenSea
              </Link>
            </div>
          ) : (
            <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
              {choices.map((c) => (
                <button
                  key={c.tokenId}
                  onClick={() => setPick(c.tokenId)}
                  className={cn(
                    "cursor-pointer overflow-hidden rounded-xl border-2 transition-all",
                    pick === c.tokenId ? "border-orange-400 shadow-[0_0_20px_rgba(251,146,60,.5)]" : "border-transparent opacity-80 hover:opacity-100",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- proxied art */}
                  <img src={c.image} alt={c.name} className="aspect-square w-full object-cover" />
                  <span className="block bg-night-2 py-1 font-display text-sm">#{c.tokenId}</span>
                </button>
              ))}
            </div>
          )}
          {choices.length > 0 && (
            <Button onClick={roast} disabled={!pick || busy}>
              <Icon icon={Fire02Icon} size={15} />
              {busy && <Spinner />}
              {busy ? "Roasting…" : pick ? `#${pick} roasts it · ${PRICES.roast} $CHOG` : "Pick your Chog"}
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
