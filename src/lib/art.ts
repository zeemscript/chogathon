import "server-only";
import { getChogRaw } from "./chogs";
import { fetchIpfs } from "./ipfs";
import { getCdnImage } from "./opensea";
import { supabaseAdmin } from "./supabase/server";

// Fetch a Chog's art: OpenSea's CDN first (fast, small), IPFS as the fallback.
// The CDN URL is remembered in memory and in the chogs table.
const cdnUrls = new Map<number, string | null>();

async function cdnUrl(tokenId: number): Promise<string | undefined> {
  if (cdnUrls.has(tokenId)) return cdnUrls.get(tokenId) ?? undefined;
  const db = supabaseAdmin();
  const { data } = await db.from("chogs").select("cdn_image").eq("token_id", tokenId).maybeSingle();
  let url: string | undefined = data?.cdn_image ?? undefined;
  if (!url) {
    url = await getCdnImage(tokenId);
    if (url) await db.from("chogs").update({ cdn_image: url }).eq("token_id", tokenId);
  }
  cdnUrls.set(tokenId, url ?? null);
  return url;
}

export async function fetchArt(tokenId: number): Promise<Response> {
  const url = await cdnUrl(tokenId).catch(() => undefined);
  if (url) {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) }).catch(() => undefined);
    if (res?.ok) return res;
  }
  return fetchIpfs(getChogRaw(tokenId)!.image);
}
