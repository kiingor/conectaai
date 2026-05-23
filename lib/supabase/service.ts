import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client with the service role key.
 * This client bypasses RLS and should ONLY be used in server-side
 * API routes that need to perform privileged operations (e.g., ticket
 * distribution triggered by bots without a user session).
 *
 * Never expose this client to the browser.
 */
export function createServiceClient() {
  // Server-side prefere SUPABASE_URL_REMOTE pra evitar self-loop via proxy do Next
  const supabaseUrl = (process.env.SUPABASE_URL_REMOTE || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()

  if (!supabaseUrl) {
    throw new Error('[ServiceClient] NEXT_PUBLIC_SUPABASE_URL is not set')
  }

  const key = serviceRoleKey || anonKey
  if (!key) {
    throw new Error('[ServiceClient] SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) is not set')
  }

  if (!serviceRoleKey) {
    console.warn('[ServiceClient] SUPABASE_SERVICE_ROLE_KEY not set — falling back to anon key. RLS will apply.')
  }

  return createClient(supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
