import "server-only";
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

export async function getOwner(tokenId: number): Promise<string | undefined> {
  return (await getOwners()).get(tokenId);
}
