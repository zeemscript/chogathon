"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useAccount } from "wagmi";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type StoryEvent = {
  at: string;
  type: string;
  title: string;
  detail?: string;
  tokenId?: number;
  tone?: "good" | "bad" | "neutral";
};
type Era = { owner: string | null; from: string | null; to: string | null; events: StoryEvent[] };
export type Story = {
  eras: Era[];
  owners: number;
  owner: string | null;
  meeting: { previousOwner: string; since: string } | null;
};

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

export function useStory(tokenId: number) {
  return useQuery({
    queryKey: ["story", tokenId],
    queryFn: async (): Promise<Story> => (await fetch(`/api/story/${tokenId}`)).json(),
  });
}

// "#123" in titles become links to that Chog.
function Linked({ text }: { text: string }) {
  return (
    <>
      {text.split(/(#\d{1,4}\b)/g).map((p, i) =>
        /^#\d+$/.test(p) ? (
          <Link key={i} href={`/chog/${p.slice(1)}`} className="text-chog-soft hover:underline">
            {p}
          </Link>
        ) : (
          p
        ),
      )}
    </>
  );
}

const DOT = {
  good: "bg-chog-ok shadow-[0_0_10px_rgba(92,230,138,.6)]",
  bad: "bg-chog-pink shadow-[0_0_10px_rgba(236,72,153,.6)]",
  neutral: "bg-chog-soft shadow-[0_0_10px_rgba(169,155,252,.5)]",
};

export default function StoryTimeline({ tokenId }: { tokenId: number }) {
  const { address } = useAccount();
  const { data, isPending } = useStory(tokenId);

  if (isPending) return <Skeleton className="h-72 rounded-2xl bg-night-3" />;
  if (!data?.eras.length) return null;

  return (
    <section className="space-y-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl">Its story</h2>
        <span className="label-mono text-[10px] text-muted-foreground">
          {data.owners} {data.owners === 1 ? "human so far" : "humans so far"}
        </span>
      </div>

      <ol className="space-y-6">
        {data.eras.map((era, i) => {
          const current = i === 0;
          const you = !!address && era.owner === address.toLowerCase();
          return (
            <li key={`${era.owner}-${era.from}`} className="space-y-3">
              {/* era header */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "label-mono rounded-full border px-2.5 py-1 text-[10px]",
                    current ? "border-chog/50 bg-chog/15 text-chog-soft" : "border-border text-muted-foreground",
                  )}
                >
                  {current ? "Now" : "Before"}
                </span>
                <span className="text-sm">
                  {era.owner ? (
                    <>
                      {current ? "Held by " : "Was held by "}
                      <span className="font-mono">{you ? "you" : short(era.owner)}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">An earlier human (history loading)</span>
                  )}
                </span>
                <span className="label-mono ml-auto text-[10px] text-muted-foreground">
                  {era.from ? date(era.from) : "from the start"}
                  {era.to ? ` → ${date(era.to)}` : ""}
                </span>
              </div>

              {/* events, newest first */}
              {era.events.length ? (
                <ul className="relative ml-[5px] space-y-3.5 border-l border-line-bright pl-5">
                  {[...era.events].reverse().map((e, j) => (
                    <li key={`${e.at}-${j}`} className="relative">
                      <span className={cn("absolute top-1.5 -left-[24.5px] size-2 rounded-full", DOT[e.tone ?? "neutral"])} />
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-sm font-medium">
                          <Linked text={e.title} />
                        </p>
                        <span className="label-mono shrink-0 text-[9.5px] text-muted-foreground/70">
                          {date(e.at)} · {time(e.at)}
                        </span>
                      </div>
                      {e.detail && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{e.detail}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ml-[5px] border-l border-line-bright pl-5 text-sm text-muted-foreground">
                  Nothing yet. Talk to it and this page starts filling up.
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
