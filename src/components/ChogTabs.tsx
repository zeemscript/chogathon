"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// The Chog's world, one tab at a time: who it loves and hates, what's being
// said, its shareable card, and the raw traits its soul was born from.
export default function ChogTabs({
  rivals,
  gossip,
  card,
  traits,
  counts,
}: {
  rivals: React.ReactNode;
  gossip: React.ReactNode;
  card: React.ReactNode;
  traits: React.ReactNode;
  counts: { rivals: number };
}) {
  return (
    <Tabs defaultValue="rivals" className="gap-4">
      <TabsList className="w-full">
        <TabsTrigger value="rivals">
          Rivals{counts.rivals > 0 && <span className="text-[10px] opacity-70">{counts.rivals}</span>}
        </TabsTrigger>
        <TabsTrigger value="gossip">Gossip</TabsTrigger>
        <TabsTrigger value="card">Soul card</TabsTrigger>
        <TabsTrigger value="traits">Traits</TabsTrigger>
      </TabsList>
      <TabsContent value="rivals" className="animate-in duration-300 fade-in">{rivals}</TabsContent>
      <TabsContent value="gossip" className="animate-in duration-300 fade-in">{gossip}</TabsContent>
      <TabsContent value="card" className="animate-in duration-300 fade-in">{card}</TabsContent>
      <TabsContent value="traits" className="animate-in duration-300 fade-in">{traits}</TabsContent>
    </Tabs>
  );
}
