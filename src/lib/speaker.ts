import "server-only";
import { createHash } from "node:crypto";
import { isAddress, verifyMessage } from "viem";
import { AUTH_TTL_MS, authMessage } from "./auth";
import { DEV_OWNER } from "./dev";
import { getOwners, publicClient } from "./owners";
import type { Speaker } from "./soul";

export type AuthPayload = { address: string; issuedAt: string; signature: `0x${string}` };

// Resolve who is talking. A valid signature from the current holder = owner.
export async function resolveSpeaker(auth: AuthPayload | undefined, owner: string | undefined): Promise<Speaker> {
  // Dev only (see lib/dev): every speaker is the owner.
  if (DEV_OWNER && owner) {
    return { role: "owner", address: owner };
  }
  if (!auth || !isAddress(auth.address)) return { role: "visitor" };
  const age = Date.now() - Date.parse(auth.issuedAt);
  if (!(age >= 0 && age < AUTH_TTL_MS)) return { role: "visitor" };
  const ok = await verifyMessage({
    address: auth.address,
    message: authMessage(auth.address, auth.issuedAt),
    signature: auth.signature,
  }).catch(() => false);
  if (!ok) return { role: "visitor" };
  const address = auth.address.toLowerCase();
  return address === owner ? { role: "owner", address } : { role: "visitor", address };
}

// Stable anonymous id for a visitor without a wallet: their IP, hashed.
// (Not the user agent: changing it must not mint a "new" visitor.)
export function visitorId(request: Request, speaker: Speaker): string {
  if (speaker.address) return speaker.address;
  const ip = (request.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  return `anon:${createHash("sha256").update(`chog-souls:${ip}`).digest("hex").slice(0, 16)}`;
}

// Anti-sybil: brand-new throwaway wallets can't boost Aura. A wallet counts if
// it holds a Chog or has real history on Monad. Cached per address.
const realCache = new Map<string, { at: number; ok: boolean }>();
export async function isRealWallet(address: string): Promise<boolean> {
  const a = address.toLowerCase();
  const hit = realCache.get(a);
  if (hit && Date.now() - hit.at < 3600_000) return hit.ok;
  const owners = await getOwners();
  let ok = [...owners.values()].includes(a);
  if (!ok) {
    const txs = await publicClient.getTransactionCount({ address: a as `0x${string}` }).catch(() => 0);
    ok = txs >= MIN_TXS;
  }
  realCache.set(a, { at: Date.now(), ok });
  return ok;
}
const MIN_TXS = 5;
