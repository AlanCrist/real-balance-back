import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Admin client — uses service_role key, bypasses RLS.
 * Use only for server-side operations where you manually verify the user.
 */
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey)

/**
 * Creates a per-request Supabase client that respects RLS.
 * Pass the user's JWT from the Authorization header.
 */
export function createSupabaseClient(accessToken: string) {
  return createClient<Database>(supabaseUrl, process.env.SUPABASE_ANON_KEY!, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  })
}
