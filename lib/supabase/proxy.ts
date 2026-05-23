import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SUPABASE_AUTH_COOKIE } from './shared'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Check if Supabase env vars are configured
  // Server-side prefere SUPABASE_URL_REMOTE (URL direta, sem proxy) pra evitar loop-back
  const supabaseUrl = process.env.SUPABASE_URL_REMOTE || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // Supabase not configured - allow request to proceed without auth
    return supabaseResponse
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: { storageKey: SUPABASE_AUTH_COOKIE },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Resolver org_id: preferir header (subdomínio) → fallback cookie (query param flow)
  const orgIdFromHeader = request.headers.get('x-org-id')
  const orgIdFromCookie = request.cookies.get('org_id')?.value ?? null
  const orgId = orgIdFromHeader ?? orgIdFromCookie

  // Propagar/renovar cookie org_id para que componentes client-side possam ler
  if (orgId) {
    supabaseResponse.cookies.set('org_id', orgId, {
      httpOnly: false, // precisa ser legível pelo browser (login pages)
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 8, // 8 horas
      path: '/',
    })
  }

  const pathname = request.nextUrl.pathname

  // Rota /doc é pública (documentação da API)
  if (pathname.startsWith('/doc')) {
    return supabaseResponse
  }

  const isLoginPage = pathname === '/login'
  const isWorkdeskLoginPage = pathname === '/workdesk/login'
  const isWorkdeskResetPage = pathname === '/workdesk/reset-password'
  const isDashboardRoute = pathname.startsWith('/dashboard')
  const isWorkdeskRoute = pathname.startsWith('/workdesk') && !isWorkdeskLoginPage && !isWorkdeskResetPage
  const isSetorRoute = pathname.startsWith('/setor')
  const isProtectedRoute = isDashboardRoute || isWorkdeskRoute || isSetorRoute

  // Redirect to appropriate login if accessing protected routes without authentication
  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone()
    // Workdesk routes go to workdesk login, others go to dashboard login
    url.pathname = pathname.startsWith('/workdesk') ? '/workdesk/login' : '/login'
    return NextResponse.redirect(url)
  }

  // If logged in, check permissions for routing
  if (user) {
    // Get colaborador with permission info — escoped por org quando disponível
    let colaboradorQuery = supabase
      .from('colaboradores')
      .select('id, permissao_id, permissoes:permissao_id(can_view_dashboard)')
      .eq('email', user.email)

    if (orgId) {
      colaboradorQuery = colaboradorQuery.eq('organizacao_id', orgId)
    }

    const { data: colaborador } = await colaboradorQuery.maybeSingle()

    // If no colaborador record exists, redirect to workdesk (default for new users)
    const canViewDashboard = colaborador?.permissoes?.can_view_dashboard ?? false

    // Redirect from login pages based on permissions
    if (isLoginPage) {
      const url = request.nextUrl.clone()
      url.pathname = canViewDashboard ? '/dashboard' : '/workdesk'
      return NextResponse.redirect(url)
    }

    // Redirect from workdesk login page if already logged in
    if (isWorkdeskLoginPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/workdesk'
      return NextResponse.redirect(url)
    }

    // Redirect from root to appropriate page
    if (pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = canViewDashboard ? '/dashboard' : '/workdesk'
      return NextResponse.redirect(url)
    }

    // Block dashboard access if user doesn't have permission
    if (isDashboardRoute && !canViewDashboard) {
      const url = request.nextUrl.clone()
      url.pathname = '/workdesk'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
