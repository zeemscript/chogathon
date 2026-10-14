import "server-only";
import { getFloor } from "./opensea";

// What's happening in crypto right now, in one short line for the AI: prices,
// what's trending, the Chog floor. DeepSeek can't browse, so this is how roasts
// stay current without inventing news. Cached 30 min; never blocks a post.

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

export async function marketPulse(): Promise<string> {
  if (cached && Date.now() - cached.at < 30 * 60_000) return cached.text;
  type Prices = Record<string, { usd: number; usd_24h_change?: number }>;
  type Trending = { coins?: { item: { symbol: string } }[]; nfts?: { name: string }[] };
  const [prices, trending, floor] = await Promise.all([
    json<Prices>("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,monad,solana&vs_currencies=usd&include_24hr_change=true"),
    json<Trending>("https://api.coingecko.com/api/v3/search/trending"),
    getFloor().catch(() => undefined),
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
  const text = parts.join(". ");
  // Keep an old pulse if this fetch failed; retry in 5 min rather than 30.
  if (text) cached = { at: Date.now(), text };
  else if (cached) cached = { ...cached, at: Date.now() - 25 * 60_000 };
  return text || cached?.text || "";
}
