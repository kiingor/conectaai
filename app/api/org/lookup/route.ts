import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/org/lookup?slug=xxx
 * Rota pública — resolve slug → org_id para o fluxo de login via ?org=
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug')
  if (!slug) {
    return NextResponse.json({ error: 'slug obrigatório' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data } = await service
    .from('organizacoes')
    .select('id, nome')
    .eq('slug', slug)
    .eq('ativo', true)
    .maybeSingle()

  if (!data) {
    return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 })
  }

  return NextResponse.json({ id: data.id, nome: data.nome })
}
