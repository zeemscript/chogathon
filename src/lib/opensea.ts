import "server-only";
import { CHOG_NFT } from "./chain";

// OpenSea API v2: market data, transfer history and a fast CDN image per Chog.
// Everything is cached in memory so we stay well under OpenSea's rate limits.

const BASE = "https://api.opensea.io/api/v2";
const SLUG = "chog-genesis";
const CHAIN = "monad";

type Cached<T> = { at: number; value: T };
const cache = new Map<string, Cached<unknown>>();

async function os<T>(path: string, ttlMs: number): Promise<T | undefined> {
  const key = process.env.OPENSEA_API_KEY;
  if (!key) return;
  const hit = cache.get(path) as Cached<T> | undefined;
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  try {
    const res = await fetch(`${BASE}/${path}`, {
      headers: { "x-api-key": key, accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    // 404 = "no listings" etc.; cache the miss so we don't keep asking.
    const value = (res.ok ? await res.json() : undefined) as T | undefined;
    if (res.ok || res.status === 404) cache.set(path, { at: Date.now(), value });
    if (cache.size > 5000) cache.delete(cache.keys().next().value!);
    return value;
  } catch {
    return hit?.value;
  }
}

const mon = (q: string | number, decimals = 18) => Number(q) / 10 ** decimals;

export type Market = {
  floor?: number; // MON
  lastSale?: { price: number; symbol: string; at: string };
  url: string;
};

export async function getMarket(tokenId: number): Promise<Market> {
  type Stats = { total?: { floor_price?: number } };
  type Events = { asset_events?: { payment?: { quantity: string; symbol: string; decimals: number }; event_timestamp: number }[] };
  const [stats, sales] = await Promise.all([
    os<Stats>(`collections/${SLUG}/stats`, 10 * 60_000),
    os<Events>(`events/chain/${CHAIN}/contract/${CHOG_NFT}/nfts/${tokenId}?event_type=sale&limit=1`, 10 * 60_000),
  ]);
  const sale = sales?.asset_events?.[0];
  return {
    floor: stats?.total?.floor_price,
    lastSale: sale?.payment && {
      price: mon(sale.payment.quantity, sale.payment.decimals),
      symbol: sale.payment.symbol,
      at: new Date(sale.event_timestamp * 1000).toISOString(),
    },
    url: `https://opensea.io/item/${CHAIN}/${CHOG_NFT}/${tokenId}`,
  };
}

export type Transfer = { from: string; to: string; at: string; tx: string };

// Every transfer of one Chog, oldest first (paged; Chogs rarely have many).
export async function getTransfers(tokenId: number): Promise<Transfer[]> {
  type Page = { asset_events?: { from_address: string; to_address: string; event_timestamp: number; transaction: string }[]; next?: string };
  const out: Transfer[] = [];
  let next: string | undefined;
  for (let i = 0; i < 10; i++) {
    const page = await os<Page>(
      `events/chain/${CHAIN}/contract/${CHOG_NFT}/nfts/${tokenId}?event_type=transfer&limit=50${next ? `&next=${next}` : ""}`,
      10 * 60_000,
    );
    for (const e of page?.asset_events ?? []) {
      out.push({ from: e.from_address.toLowerCase(), to: e.to_address.toLowerCase(), at: new Date(e.event_timestamp * 1000).toISOString(), tx: e.transaction });
    }
    if (!page?.next) break;
    next = page.next;
  }
  return out.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

// OpenSea's CDN copy of the art: ~60KB and fast, vs ~300KB and slow from IPFS.
export async function getCdnImage(tokenId: number): Promise<string | undefined> {
  type Nft = { nft?: { display_image_url?: string; image_url?: string } };
  const res = await os<Nft>(`chain/${CHAIN}/contract/${CHOG_NFT}/nfts/${tokenId}`, 24 * 3600_000);
  const url = res?.nft?.display_image_url ?? res?.nft?.image_url;
  return url && `${url}${url.includes("?") ? "&" : "?"}w=512`;
}

export type Sale = { tx: string; price: number; symbol: string; at: string };

// Every sale of one Chog (price per transaction), for "Sold for X" in its story.
export async function getSales(tokenId: number): Promise<Sale[]> {
  type Page = {
    asset_events?: { transaction: string; event_timestamp: number; payment?: { quantity: string; symbol: string; decimals: number } }[];
  };
  const page = await os<Page>(`events/chain/${CHAIN}/contract/${CHOG_NFT}/nfts/${tokenId}?event_type=sale&limit=50`, 10 * 60_000);
  return (page?.asset_events ?? [])
    .filter((e) => e.payment)
    .map((e) => ({
      tx: e.transaction,
      price: mon(e.payment!.quantity, e.payment!.decimals),
      symbol: e.payment!.symbol,
      at: new Date(e.event_timestamp * 1000).toISOString(),
    }));
}
