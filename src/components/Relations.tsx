import Link from "next/link";
import { getChog } from "@/lib/chogs";
import type { Relation } from "@/lib/town";
import { cn } from "@/lib/utils";

function label(a: number) {
  if (a >= 50) return { text: "Bestie", cls: "text-chog-ok" };
  if (a >= 15) return { text: "Friend", cls: "text-chog-ok/80" };
  if (a > -15) return { text: "Unsure", cls: "text-muted-foreground" };
  if (a > -50) return { text: "Rival", cls: "text-orange-300" };
  return { text: "Nemesis", cls: "text-chog-pink" };
}

// Friends & rivals, strongest feelings first.
export default function Relations({ relations }: { relations: Relation[] }) {
  const top = [...relations].sort((a, b) => Math.abs(b.affinity) - Math.abs(a.affinity)).slice(0, 6);
  if (!top.length) {
    return (
      <p className="rounded-2xl border border-dashed border-line-bright px-5 py-8 text-center text-sm text-muted-foreground">
        No friends. No enemies. Yet.
      </p>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {top.map((r) => {
        const other = getChog(r.other_token_id);
        if (!other) return null;
        const l = label(r.affinity);
        const pct = Math.abs(r.affinity);
        return (
          <li key={r.other_token_id}>
            <Link
              href={`/chog/${other.tokenId}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:border-line-bright"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- proxied IPFS image */}
              <img src={other.image} alt={other.name} className="size-12 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-lg leading-none">{other.name}</span>
                  <span className={cn("label-mono text-[10px]", l.cls)}>{l.text}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn("h-full rounded-full", r.affinity >= 0 ? "bg-chog-ok" : "bg-chog-pink")}
                    style={{ width: `${Math.max(6, pct)}%` }}
                  />
                </div>
                {r.grudge && <p className="mt-1.5 truncate text-xs text-muted-foreground">Grudge: {r.grudge}</p>}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
