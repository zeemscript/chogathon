import { createClient } from "@supabase/supabase-js";

// Publishable-key client for the browser: read-only access to public tables (RLS enforced).
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
);
