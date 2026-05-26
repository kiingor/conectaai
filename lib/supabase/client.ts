import { createBrowserClient } from '@supabase/ssr'
import { SUPABASE_AUTH_COOKIE } from './shared'

export { SUPABASE_AUTH_COOKIE }

export function createClient() {
  const configuredUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
  const supabaseUrl =
    typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
      ? `${window.location.origin}/supabase-proxy`
      : configuredUrl

  return createBrowserClient(
    supabaseUrl,
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim(),
    {
      auth: { storageKey: SUPABASE_AUTH_COOKIE },
    },
  )
}
