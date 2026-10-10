import "server-only";
import { createHash } from "node:crypto";
import { isAddress, verifyMessage } from "viem";
import { AUTH_TTL_MS, authMessage } from "./auth";
import type { Speaker } from "./soul";

export type AuthPayload = { address: string; issuedAt: string; signature: `0x${string}` };

// Resolve who is talking. A valid signature from the current holder = owner.
export async function resolveSpeaker(auth: AuthPayload | undefined, owner: string | undefined): Promise<Speaker> {
  // Dev only: DEV_IMPERSONATE_OWNER=1 treats every speaker as the owner.
  if (process.env.NODE_ENV !== "production" && process.env.DEV_IMPERSONATE_OWNER === "1" && owner) {
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

// Stable anonymous id for a visitor without a wallet (hashed IP + UA).
export function visitorId(request: Request, speaker: Speaker): string {
  if (speaker.address) return speaker.address;
  const raw = `${request.headers.get("x-forwarded-for") ?? "local"}|${request.headers.get("user-agent") ?? ""}`;
  return `anon:${createHash("sha256").update(raw).digest("hex").slice(0, 16)}`;
}
