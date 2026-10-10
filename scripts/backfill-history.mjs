// Loads every Chog Genesis transfer since mint into owner_history, using the
// Etherscan v2 API (one key covers Monad, chain 143). The public Monad RPC only
// allows 100-block log queries, so this is far faster than scanning the chain.
// Safe to re-run: rows are unique per (tx_hash, token).
// Usage: npm run backfill:history   (needs ETHERSCAN_API_KEY in .env.local)
import { createClient } from "@supabase/supabase-js";

const KEY = process.env.ETHERSCAN_API_KEY;
const NFT = process.env.NEXT_PUBLIC_CHOG_NFT ?? "0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763";
if (!KEY) {
  console.error("Missing ETHERSCAN_API_KEY (see TODO-YOU.md)");
  process.exit(1);
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Etherscan caps a query at 10k results, so page by block: each batch starts
// at the last block we saw (overlap is fine, the upsert dedupes).
async function* transfers() {
  let startblock = 0;
  for (;;) {
    const url =
      `https://api.etherscan.io/v2/api?chainid=143&module=account&action=tokennfttx` +
      `&contractaddress=${NFT}&startblock=${startblock}&endblock=999999999&page=1&offset=10000&sort=asc&apikey=${KEY}`;
    const res = await (await fetch(url)).json();
    if (res.status !== "1") {
      if (/no transactions/i.test(res.message)) return;
      throw new Error(`etherscan: ${res.message} ${typeof res.result === "string" ? res.result : ""}`);
    }
    yield res.result;
    if (res.result.length < 10000) return;
    const last = Number(res.result.at(-1).blockNumber);
    if (last === startblock) throw new Error("stuck: >10k transfers in one block");
    startblock = last;
    await sleep(250); // free tier: 5 requests/second
  }
}

let total = 0;
const touched = new Set();
for await (const batch of transfers()) {
  const rows = batch.map((t) => ({
    token_id: Number(t.tokenID),
    from_address: t.from.toLowerCase(),
    to_address: t.to.toLowerCase(),
    block_number: Number(t.blockNumber),
    tx_hash: t.hash,
    log_index: Number(t.tokenID), // tokennfttx has no log index; token id keeps (tx, token) unique
    created_at: new Date(Number(t.timeStamp) * 1000).toISOString(),
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("owner_history").upsert(rows.slice(i, i + 500), { onConflict: "tx_hash,log_index" });
    if (error) throw new Error(`upsert: ${error.message}`);
  }
  rows.forEach((r) => touched.add(r.token_id));
  total += rows.length;
  console.log(`${total} transfers stored`);
}

// Transfers we noticed ourselves (no tx hash) are now covered by real ones.
const ids = [...touched];
for (let i = 0; i < ids.length; i += 500) {
  await db.from("owner_history").delete().is("tx_hash", null).in("token_id", ids.slice(i, i + 500));
}
console.log(`done: ${total} transfers for ${touched.size} Chogs`);
