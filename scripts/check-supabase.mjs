// Verifies Supabase credentials and that the schema has been applied.
// Usage: node --env-file=.env.local scripts/check-supabase.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const tables = ["chogs", "chog_state", "chog_memory", "chog_relations", "owner_history", "town_posts"];
let ok = true;
for (const t of tables) {
  const { count, error } = await db.from(t).select("*", { count: "exact", head: true });
  if (error) ok = false;
  console.log(`${error ? "✗" : "✓"} ${t}${error ? ` — ${error.message}` : ` (${count} rows)`}`);
}
process.exit(ok ? 0 : 1);
