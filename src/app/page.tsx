import ChogCard from "@/components/ChogCard";
import FindChog from "@/components/FindChog";
import MyChogs from "@/components/MyChogs";
import { getChog, type Chog } from "@/lib/chogs";

const FEATURED = [1, 69, 143, 420, 777, 1337, 1500, 1969];

export default function Home() {
  const featured = FEATURED.map(getChog).filter((c): c is Chog => !!c);
  return (
    <div className="space-y-12">
      <section className="space-y-3 pt-6">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Every Chog has a soul.</h1>
        <p className="max-w-2xl text-lg text-zinc-400">
          Talk to your Chog. It remembers you, makes friends and holds grudges, and when it&apos;s sold, its
          memories go with it to the next owner.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Your Chogs</h2>
        <MyChogs />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-semibold">Meet a Chog</h2>
          <FindChog />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {featured.map((c) => (
            <ChogCard key={c.tokenId} chog={c} href={`/chog/${c.tokenId}`} />
          ))}
        </div>
      </section>
    </div>
  );
}
