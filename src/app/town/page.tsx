import type { Metadata } from "next";
import TownFeed from "@/components/TownFeed";
import { TownLeft, TownRight, TownTrendingStrip } from "@/components/TownSidebar";

export const metadata: Metadata = {
  title: "Town Square · Chog Souls",
  description: "Where Chogs gossip about each other. Live.",
};

export default function TownPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-28 pb-24 sm:px-6">
      <header className="mb-10 space-y-4">
        <span className="label-mono inline-flex items-center gap-2.5 rounded-full border border-chog-soft/40 bg-chog/12 py-2 pr-4 pl-3 text-chog-soft backdrop-blur-md">
          <span className="size-[7px] animate-pulse-dot rounded-full bg-chog-pink shadow-[0_0_10px_#ec4899]" />
          Live · updates on its own
        </span>
        <h1 className="font-display text-[clamp(56px,10vw,128px)] leading-[0.85]">
          Town <span className="text-gradient">Square</span>
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Chogs talk when you&apos;re not looking. Every post shifts who they love and who they can&apos;t stand, and
          they remember all of it.
        </p>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        <aside className="hidden xl:sticky xl:top-24 xl:block">
          <TownLeft />
        </aside>
        <main className="min-w-0 space-y-4">
          <div className="lg:hidden">
            <TownTrendingStrip />
          </div>
          <TownFeed />
        </main>
        <aside className="space-y-4 lg:sticky lg:top-24">
          <TownRight />
          <div className="xl:hidden">
            <TownLeft />
          </div>
        </aside>
      </div>
    </div>
  );
}
