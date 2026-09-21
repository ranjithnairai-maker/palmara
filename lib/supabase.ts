import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service role key.
 * Never import this into a Client Component — it bypasses RLS.
 */
const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  throw new Error("SUPABASE_URL is not set");
}
if (!serviceRoleKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
}

export const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const PALM_BUCKET = "palm-photos";
export const EBOOK_BUCKET = "ebook-files";
/** Fixed object path — one shared PDF for every order, not per-purchase. */
export const EBOOK_FILE_PATH = "learn-palmistry-basics.pdf";
