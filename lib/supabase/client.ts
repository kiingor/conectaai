import { createBrowserClient } from '@supabase/ssr'
import { SUPABASE_AUTH_COOKIE } from './shared'

export { SUPABASE_AUTH_COOKIE }

export function createClient() {
  return createBrowserClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim(),
    {
      auth: { storageKey: SUPABASE_AUTH_COOKIE },
    },
  )
}
