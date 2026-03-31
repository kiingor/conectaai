import { updateSession } from '@/lib/supabase/proxy'
import { extractSlugFromHost, resolveOrgBySlug, ORG_ID_HEADER } from '@/lib/tenant'
import { type NextRequest, NextResponse } from 'next/server'

// Paths que não precisam de org context (super admin, APIs internas, docs)
const NO_ORG_PATHS = ['/admin', '/api/super-admin', '/api/onboarding', '/api/org', '/doc', '/api/logs']

export async function middleware(request: NextRequest) {
  const { pathname } = new URL(request.url)

  // Super admin e onboarding passam sem org context
  if (NO_ORG_PATHS.some(p => pathname.startsWith(p))) {
    return await updateSession(request)
  }

  const host = request.headers.get('host') || ''
  const slug = extractSlugFromHost(host)

  // Resolve org pelo subdomínio ou pelo ?org= da URL
  const orgSlugFromQuery = !slug ? new URL(request.url).searchParams.get('org') : null
  const resolvedSlug = slug || orgSlugFromQuery || null

  if (resolvedSlug) {
    try {
      const orgId = await resolveOrgBySlug(resolvedSlug)
      if (!orgId && slug) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
      }

      if (orgId) {
        const requestHeaders = new Headers(request.headers)
        requestHeaders.set(ORG_ID_HEADER, orgId)

        // Só inclui body/duplex para requests que podem ter body
        const hasBody = request.body !== null && request.method !== 'GET' && request.method !== 'HEAD'
        const modifiedRequest = new Request(request.url, {
          method: request.method,
          headers: requestHeaders,
          ...(hasBody ? { body: request.body, duplex: 'half' } : {}),
        } as RequestInit)

        return await updateSession(modifiedRequest as unknown as NextRequest)
      }
    } catch (err) {
      console.error('[middleware] erro ao resolver org:', err)
      // Falha silenciosa — continua sem contexto de org
    }
  }

  // Sem subdomínio nem ?org= — deixa proxy.ts decidir (homepage pública)
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Inclui rotas de API para que o org header seja injetado nelas também
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
