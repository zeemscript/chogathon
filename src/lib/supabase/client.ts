import { createClient } from "@supabase/supabase-js";

// Anon client for the browser: read-only access to public tables (RLS enforced).
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
);
