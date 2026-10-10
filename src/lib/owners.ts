import "server-only";
import { connection } from "next/server";
import { createPublicClient, getAddress, http } from "viem";
import { CHOG_NFT, CHOG_SUPPLY, MONAD_RPC, chogNftAbi, monad } from "./chain";

export const publicClient = createPublicClient({ chain: monad, transport: http(MONAD_RPC) });

const TTL_MS = 30_000;
let snapshot: { at: number; owners: Map<number, string> } | undefined;
let inflight: Promise<Map<number, string>> | undefined;

// The contract isn't ERC721Enumerable, so we read ownerOf for every token
// via Multicall3 and keep a short-lived snapshot: tokenId -> lowercase owner.
async function loadOwners(): Promise<Map<number, string>> {
  const ids = Array.from({ length: CHOG_SUPPLY }, (_, i) => i + 1);
  const results = await publicClient.multicall({
    contracts: ids.map((id) => ({
      address: CHOG_NFT,
      abi: chogNftAbi,
      functionName: "ownerOf" as const,
      args: [BigInt(id)] as const,
    })),
    batchSize: 64_000,
  });
  const owners = new Map<number, string>();
  results.forEach((r, i) => {
    if (r.status === "success") owners.set(ids[i], r.result.toLowerCase());
  });
  return owners;
}

export async function getOwners(): Promise<Map<number, string>> {
  await connection(); // ownership is live data: always render at request time
  if (snapshot && Date.now() - snapshot.at < TTL_MS) return snapshot.owners;
  inflight ??= loadOwners()
    .then((owners) => {
      snapshot = { at: Date.now(), owners };
      return owners;
    })
    .finally(() => {
      inflight = undefined;
    });
  return inflight;
}

export async function getOwnedTokenIds(address: string): Promise<number[]> {
  const want = getAddress(address).toLowerCase();
  const owners = await getOwners();
  return [...owners].filter(([, o]) => o === want).map(([id]) => id);
}

// One Chog's owner: a single ownerOf call (~100ms) instead of loading all
// 1,969 owners (~2s). Reuses the full snapshot when one is already warm.
const oneOwner = new Map<number, { at: number; owner?: string }>();
export async function getOwner(tokenId: number): Promise<string | undefined> {
  await connection();
  if (snapshot && Date.now() - snapshot.at < TTL_MS) return snapshot.owners.get(tokenId);
  const hit = oneOwner.get(tokenId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.owner;
  const owner = await publicClient
    .readContract({ address: CHOG_NFT, abi: chogNftAbi, functionName: "ownerOf", args: [BigInt(tokenId)] })
    .then((o) => o.toLowerCase())
    .catch(() => undefined);
  if (oneOwner.size > 3000) oneOwner.clear();
  oneOwner.set(tokenId, { at: Date.now(), owner });
  return owner;
}
