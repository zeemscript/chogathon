import "server-only";
import { getFloor } from "./opensea";

// What's happening in crypto right now, in one short line for the AI: big price
// moves, what's trending, the Chog floor and the latest headlines from crypto
// news sites. DeepSeek can't browse, so this is how roasts stay current without
// inventing news. Cached 30 min; never blocks a post.

let cached: { at: number; text: string } | undefined;

const pct = (n?: number) => (n === undefined ? "" : ` (${n >= 0 ? "+" : ""}${n.toFixed(1)}% 24h)`);
const usd = (n: number) => (n >= 100 ? `$${Math.round(n).toLocaleString("en-US")}` : `$${n.toPrecision(3)}`);

async function json<T>(url: string): Promise<T | undefined> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500), headers: { accept: "application/json" } });
    return res.ok ? ((await res.json()) as T) : undefined;
  } catch {
    return;
  }
}

// Free RSS feeds that answer server requests (Reddit and X block or charge).
const FEEDS = ["https://decrypt.co/feed", "https://cointelegraph.com/rss", "https://www.theblock.co/rss.xml"];

async function headlines(): Promise<string[]> {
  const pages = await Promise.all(
    FEEDS.map(async (url) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(1500), headers: { "user-agent": "chog-souls/1.0 (+https://chog-souls.vercel.app)" } });
        return res.ok ? await res.text() : "";
      } catch {
        return "";
      }
    }),
  );
  const decode = (t: string) =>
    t
      .replace(/<!\[CDATA\[|\]\]>/g, "")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .trim();
  // The newest two stories from each site, skipping the feed's own title.
  return pages.flatMap((xml) =>
    [...xml.matchAll(/<item[\s\S]*?<title>([\s\S]*?)<\/title>/g)]
      .slice(0, 2)
      .map((m) => decode(m[1]))
      .filter((t) => t.length > 12 && t.length < 140),
  );
}

export async function marketPulse(): Promise<string> {
  if (cached && Date.now() - cached.at < 30 * 60_000) return cached.text;
  type Prices = Record<string, { usd: number; usd_24h_change?: number }>;
  type Trending = { coins?: { item: { symbol: string } }[]; nfts?: { name: string }[] };
  const [prices, trending, floor, news] = await Promise.all([
    json<Prices>("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,monad,solana&vs_currencies=usd&include_24hr_change=true"),
    json<Trending>("https://api.coingecko.com/api/v3/search/trending"),
    getFloor().catch(() => undefined),
    headlines(),
  ]);
  const parts: string[] = [];
  if (prices) {
    const names: Record<string, string> = { bitcoin: "BTC", ethereum: "ETH", monad: "MON", solana: "SOL" };
    // Only real moves are news: a 1% wiggle isn't worth a joke.
    const line = Object.entries(names)
      .filter(([id]) => prices[id] && Math.abs(prices[id].usd_24h_change ?? 0) >= 3)
      .map(([id, s]) => `${s} ${usd(prices[id].usd)}${pct(prices[id].usd_24h_change)}`)
      .join(", ");
    if (line) parts.push(`big moves: ${line}`);
  }
  const coins = trending?.coins?.slice(0, 5).map((c) => c.item.symbol);
  if (coins?.length) parts.push(`trending coins: ${coins.join(", ")}`);
  const nfts = trending?.nfts?.slice(0, 3).map((n) => n.name);
  if (nfts?.length) parts.push(`trending NFTs: ${nfts.join(", ")}`);
  if (floor) parts.push(`Chog Genesis floor: ${Math.round(floor).toLocaleString("en-US")} MON`);
  if (news.length) parts.push(`headlines: ${news.join(" | ")}`);
  const text = parts.join(". ");
  // Keep an old pulse if this fetch failed; retry in 5 min rather than 30.
  if (text) cached = { at: Date.now(), text };
  else if (cached) cached = { ...cached, at: Date.now() - 25 * 60_000 };
  return text || cached?.text || "";
}
