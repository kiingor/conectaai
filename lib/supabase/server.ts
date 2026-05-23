import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { SUPABASE_AUTH_COOKIE } from './shared'

export async function createClient() {
  const cookieStore = await cookies()

  // Server-side prefere SUPABASE_URL_REMOTE pra evitar self-loop via proxy do Next
  return createServerClient(
    (process.env.SUPABASE_URL_REMOTE || process.env.NEXT_PUBLIC_SUPABASE_URL)!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { storageKey: SUPABASE_AUTH_COOKIE },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // The "setAll" method was called from a Server Component.
            // This can be ignored if you have proxy refreshing user sessions.
          }
        },
      },
    },
  )
}
