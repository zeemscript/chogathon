// Caches tokenURI metadata for all Chog Genesis tokens into src/data/chogs.json.
// tokenURI is shuffled (token 1 -> 1462.json), so we resolve it per token.
// Public IPFS gateways rate-limit hard, so we rotate gateways, back off on 429
// and save progress as we go; re-running resumes where it stopped.
// If SUPABASE_SECRET_KEY is set, also upserts rows into the `chogs` table.
// Usage: npm run cache:metadata
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createPublicClient, http, parseAbi } from "viem";
import { monad } from "viem/chains";
import { createClient } from "@supabase/supabase-js";

const RPC = process.env.NEXT_PUBLIC_MONAD_RPC ?? "https://rpc.monad.xyz";
const NFT = process.env.NEXT_PUBLIC_CHOG_NFT ?? "0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763";
const GATEWAYS = [
  process.env.IPFS_GATEWAY ?? "https://gateway.pinata.cloud/ipfs",
  "https://ipfs.filebase.io/ipfs",
  "https://ipfs.io/ipfs",
  "https://w3s.link/ipfs",
];
const OUT = "src/data/chogs.json";
const CONCURRENCY = 6;

const client = createPublicClient({ chain: monad, transport: http(RPC, { retryCount: 5 }) });
const abi = parseAbi([
  "function tokenURI(uint256) view returns (string)",
  "function totalSupply() view returns (uint256)",
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Gateways that answered 429 sit out until this timestamp.
const coolUntil = new Map();
let next = 0;

async function fetchMeta(uri) {
  const path = uri.replace(/^ipfs:\/\//, "");
  for (let attempt = 0; attempt < 30; attempt++) {
    const ready = GATEWAYS.filter((g) => (coolUntil.get(g) ?? 0) <= Date.now());
    if (!ready.length) {
      await sleep(2_000);
      continue;
    }
    const gw = ready[next++ % ready.length];
    try {
      const res = await fetch(`${gw}/${path}`, { signal: AbortSignal.timeout(20_000) });
      if (res.status === 429 || res.status >= 500) {
        coolUntil.set(gw, Date.now() + 30_000);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      coolUntil.set(gw, Date.now() + 10_000);
    }
  }
  throw new Error(`gave up on ${path}`);
}

// Resume from an existing cache so a failed run doesn't start over.
let cached = [];
try {
  cached = JSON.parse(await readFile(OUT, "utf8"));
} catch {}
const byId = new Map(cached.map((c) => [c.tokenId, c]));
const save = async () => {
  await mkdir("src/data", { recursive: true });
  await writeFile(OUT, JSON.stringify([...byId.values()].sort((a, b) => a.tokenId - b.tokenId)));
};

const supply = Number(await client.readContract({ address: NFT, abi, functionName: "totalSupply" }));
const missing = Array.from({ length: supply }, (_, i) => i + 1).filter((id) => !byId.has(id));
console.log(`supply ${supply}, cached ${byId.size}, fetching ${missing.length}`);

const uris = await client.multicall({
  contracts: missing.map((id) => ({ address: NFT, abi, functionName: "tokenURI", args: [BigInt(id)] })),
  allowFailure: false,
});
const todo = missing.map((tokenId, i) => ({ tokenId, uri: uris[i] }));

const failed = [];
let done = 0;
async function worker() {
  while (todo.length) {
    const { tokenId, uri } = todo.shift();
    try {
      const meta = await fetchMeta(uri);
      const traits = Object.fromEntries(meta.attributes.map((a) => [a.trait_type, a.value]));
      byId.set(tokenId, { tokenId, name: `Chog #${tokenId}`, metaName: meta.name, image: meta.image, traits });
    } catch (err) {
      failed.push(tokenId);
      console.warn(`token ${tokenId} failed: ${err.message}`);
    }
    if (++done % 50 === 0) {
      await save();
      console.log(`${done}/${missing.length}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
await save();
console.log(`wrote ${byId.size} chogs to ${OUT}${failed.length ? `, ${failed.length} failed (re-run to retry)` : ""}`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (url && key) {
  const db = createClient(url, key, { auth: { persistSession: false } });
  const rows = [...byId.values()].map(({ tokenId, name, image, traits }) => ({ token_id: tokenId, name, image, traits }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("chogs").upsert(rows.slice(i, i + 500), { onConflict: "token_id" });
    if (error) throw new Error(`supabase upsert failed: ${error.message}`);
  }
  console.log(`upserted ${rows.length} rows into chogs`);
} else {
  console.log("SUPABASE_SECRET_KEY not set, skipped database upsert");
}
