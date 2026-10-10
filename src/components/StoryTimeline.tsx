"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useAccount } from "wagmi";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Category = "Sale" | "Transfer" | "Mint" | "Aura" | "Rivalry" | "Friendship" | "$CHOG" | "Square" | "Visitor" | "Human";
type StoryEvent = { at: string; type: string; category: Category; title: string; detail?: string; tokenId?: number };
type Era = { owner: string | null; from: string | null; to: string | null; days: number | null; events: StoryEvent[] };
export type Story = {
  eras: Era[];
  owners: number;
  owner: string | null;
  summary: { owners: number; days: number | null; moments: number; lastSale?: { price: number; symbol: string } };
  meeting: { previousOwner: string; since: string } | null;
};

export function useStory(tokenId: number) {
  return useQuery({
    queryKey: ["story", tokenId],
    queryFn: async (): Promise<Story> => (await fetch(`/api/story/${tokenId}`)).json(),
  });
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const longDate = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function ago(iso: string) {
  const s = Math.max(1, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`;
  return shortDate(iso);
}

// A unique two-tone avatar per wallet, derived from its address.
function WalletAvatar({ address, className }: { address: string | null; className?: string }) {
  const h = address ? parseInt(address.slice(2, 8), 16) : 0;
  const a = h % 360;
  const b = (a + 60 + ((h >> 8) % 120)) % 360;
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0 rounded-full ring-2 ring-night", className)}
      style={{
        background: address
          ? `radial-gradient(circle at 30% 25%, hsl(${a} 85% 72%), hsl(${b} 70% 45%) 70%)`
          : "repeating-linear-gradient(45deg, #1e1838 0 4px, #2a2250 4px 8px)",
      }}
    />
  );
}

const PILL: Record<Category, string> = {
  Sale: "text-chog-gold bg-chog-gold/10 border-chog-gold/30",
  Transfer: "text-muted-foreground bg-white/[.04] border-border",
  Mint: "text-chog-soft bg-chog/10 border-chog/30",
  Aura: "text-chog-ok bg-chog-ok/10 border-chog-ok/30",
  Friendship: "text-chog-ok bg-chog-ok/10 border-chog-ok/30",
  Rivalry: "text-pink-300 bg-chog-pink/10 border-chog-pink/30",
  $CHOG: "text-chog-gold bg-chog-gold/10 border-chog-gold/30",
  Square: "text-chog-soft bg-chog/10 border-chog/30",
  Visitor: "text-cyan-300 bg-chog-cyan/10 border-chog-cyan/30",
  Human: "text-chog-soft bg-chog/10 border-chog/30",
};

function Row({ e, last }: { e: StoryEvent; last: boolean }) {
  return (
    <li className="relative grid grid-cols-[64px_minmax(0,1fr)] gap-3 sm:grid-cols-[76px_minmax(0,1fr)]">
      <time title={longDate(e.at)} className="label-mono pt-1 text-right text-[10px] text-muted-foreground/70">
        {ago(e.at)}
      </time>
      <div className={cn("relative border-l border-line-bright pb-5 pl-5", last && "border-transparent pb-0")}>
        <span className="absolute top-1.5 -left-[5px] size-[9px] rounded-full border-2 border-chog-soft bg-night" />
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("label-mono rounded-md border px-1.5 py-0.5 text-[9px]", PILL[e.category])}>{e.category}</span>
          {e.tokenId && (
            <Link href={`/chog/${e.tokenId}`} className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- proxied art */}
              <img src={`/api/img/${e.tokenId}`} alt="" className="size-5 rounded-md object-cover" />
            </Link>
          )}
          <p className="min-w-0 text-[15px] font-medium leading-snug">
            {e.title.split(/(#\d{1,4}\b)/g).map((p, i) =>
              /^#\d+$/.test(p) ? (
                <Link key={i} href={`/chog/${p.slice(1)}`} className="text-chog-soft hover:underline">
                  {p}
                </Link>
              ) : (
                p
              ),
            )}
          </p>
        </div>
        {e.detail && e.type !== "owner" && (
          <p className={cn("mt-1 line-clamp-2 text-sm text-muted-foreground", e.detail.startsWith("“") && "italic")}>{e.detail}</p>
        )}
      </div>
    </li>
  );
}

function EraCard({ era, current, you }: { era: Era; current: boolean; you: boolean }) {
  const [open, setOpen] = useState(false);
  const events = [...era.events].reverse(); // newest first
  const shown = open ? events : events.slice(0, 3);
  return (
    <li
      className={cn(
        "rounded-2xl border p-4 sm:p-5",
        current ? "border-chog/40 bg-[linear-gradient(160deg,rgba(131,110,249,.12),transparent_55%)]" : "border-border bg-white/[.02]",
      )}
    >
      <div className="flex items-center gap-3">
        <WalletAvatar address={era.owner} className="size-9" />
        <div className="min-w-0 flex-1">
          <p className="label-mono text-[9.5px] text-muted-foreground">{current ? "Current human" : "Former human"}</p>
          <p className="truncate font-mono text-sm">
            {era.owner ? (you ? "You" : short(era.owner)) : "Before our records"}
          </p>
        </div>
        <div className="text-right">
          {era.days !== null && (
            <p className="font-display text-xl leading-none">
              {era.days}
              <span className="ml-1 font-sans text-xs text-muted-foreground">{era.days === 1 ? "day" : "days"}</span>
            </p>
          )}
          <p className="label-mono mt-1 text-[9.5px] text-muted-foreground/70">
            {era.from ? shortDate(era.from) : "start"} → {era.to ? shortDate(era.to) : "now"}
          </p>
        </div>
      </div>

      {events.length > 0 ? (
        <ol className="mt-4">
          {shown.map((e, i) => (
            <Row key={`${e.at}-${i}`} e={e} last={i === shown.length - 1} />
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Quiet times. Nothing happened with this human yet.</p>
      )}
      {events.length > 3 && (
        <button
          onClick={() => setOpen(!open)}
          className="label-mono mt-3 cursor-pointer text-[10px] text-chog-soft hover:underline"
        >
          {open ? "Show less" : `Show ${events.length - 3} more`}
        </button>
      )}
    </li>
  );
}

// Former owners in one line each: who, how long, what it sold for.
function FormerHumans({ eras, address }: { eras: Era[]; address?: string }) {
  const [all, setAll] = useState(false);
  if (!eras.length) return null;
  const shown = all ? eras : eras.slice(0, 3);
  return (
    <div className="rounded-2xl border border-border bg-white/[.02] p-4 sm:p-5">
      <p className="label-mono mb-3 text-[9.5px] text-muted-foreground">Former humans</p>
      <ul className="divide-y divide-border">
        {shown.map((era) => {
          const sale = era.events.find((e) => e.category === "Sale");
          const moments = era.events.filter((e) => e.type !== "owner").length;
          return (
            <li key={`${era.owner}-${era.from}`} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <WalletAvatar address={era.owner} className="size-7" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm">
                  {era.owner ? (address && era.owner === address.toLowerCase() ? "You" : short(era.owner)) : "Before our records"}
                </p>
                <p className="label-mono text-[9.5px] text-muted-foreground/70">
                  {era.days !== null ? `${era.days} ${era.days === 1 ? "day" : "days"}` : "unknown"}
                  {moments > 0 && ` · ${moments} ${moments === 1 ? "moment" : "moments"}`}
                </p>
              </div>
              <div className="text-right">
                {sale ? (
                  <p className="text-sm font-medium text-chog-gold">{sale.title.replace("Sold for ", "")}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Transferred</p>
                )}
                {era.from && <p className="label-mono text-[9.5px] text-muted-foreground/70">bought {shortDate(era.from)}</p>}
              </div>
            </li>
          );
        })}
      </ul>
      {eras.length > 3 && (
        <button onClick={() => setAll(!all)} className="label-mono mt-3 cursor-pointer text-[10px] text-chog-soft hover:underline">
          {all ? "Show less" : `Show all ${eras.length}`}
        </button>
      )}
    </div>
  );
}

export default function StoryTimeline({ tokenId }: { tokenId: number }) {
  const { address } = useAccount();
  const { data, isPending } = useStory(tokenId);

  if (isPending) return <Skeleton className="h-72 rounded-2xl bg-night-3" />;
  if (!data?.eras?.length) return null;
  const s = data.summary;
  const stats = [
    { v: String(s.owners), l: s.owners === 1 ? "Human" : "Humans" },
    { v: s.days !== null ? String(s.days) : "–", l: "Days known" },
    { v: String(s.moments), l: "Moments" },
  ];

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-border bg-card">
        {stats.map((x, i) => (
          <div key={x.l} className={cn("px-3 py-3 text-center sm:px-4", i > 0 && "border-l border-border")}>
            <p className="font-display text-2xl leading-none sm:text-3xl">{x.v}</p>
            <p className="label-mono mt-1.5 truncate text-[9px] text-muted-foreground">{x.l}</p>
          </div>
        ))}
      </div>
      <ol>
        <EraCard era={data.eras[0]} current you={!!address && data.eras[0].owner === address.toLowerCase()} />
      </ol>
      <FormerHumans eras={data.eras.slice(1)} address={address} />
    </section>
  );
}
