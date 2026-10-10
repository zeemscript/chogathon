import "server-only";
import { getTransfers } from "./opensea";
import { supabaseAdmin } from "./supabase/server";

const RESYNC_MS = 6 * 3600_000;

// Pull a Chog's full transfer history from OpenSea into owner_history, at most
// every few hours per Chog. Rows are unique per (tx, token), so re-runs are safe.
export async function syncHistory(tokenId: number): Promise<void> {
  const db = supabaseAdmin();
  const { data: state } = await db.from("chog_state").select("history_synced_at").eq("token_id", tokenId).maybeSingle();
  if (state?.history_synced_at && Date.now() - Date.parse(state.history_synced_at) < RESYNC_MS) return;

  const transfers = await getTransfers(tokenId);
  if (transfers.length) {
    const { error } = await db.from("owner_history").upsert(
      transfers.map((t) => ({
        token_id: tokenId,
        from_address: t.from,
        to_address: t.to,
        tx_hash: t.tx,
        log_index: tokenId, // OpenSea has no log index; token id keeps (tx, token) unique
        created_at: t.at,
      })),
      { onConflict: "tx_hash,log_index" },
    );
    if (error) throw new Error(`syncHistory: ${error.message}`);
    // Transfers we noticed ourselves (no tx hash) are now covered by real ones.
    await db.from("owner_history").delete().eq("token_id", tokenId).is("tx_hash", null);
  }
  await db.from("chog_state").update({ history_synced_at: new Date().toISOString() }).eq("token_id", tokenId);
}
