import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

async function verifySuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const service = createServiceClient()
  const { data } = await service.from('super_admins').select('user_id').eq('user_id', user.id).maybeSingle()
  return data ? user : null
}

/**
 * GET /api/super-admin/organizacoes/[slug]
 * Detalhes da org + stats completos
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const user = await verifySuperAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  const service = createServiceClient()

  const { data: org, error } = await service
    .from('organizacoes')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !org) return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 })

  const [colabRes, ticketRes, canalRes] = await Promise.all([
    service.from('colaboradores').select('id, nome, email, ativo, is_online').eq('organizacao_id', org.id),
    service.from('tickets').select('id, status').eq('organizacao_id', org.id),
    service.from('setor_canais').select('id, nome, tipo, ativo').eq('organizacao_id', org.id),
  ])

  return NextResponse.json({
    organizacao: org,
    colaboradores: colabRes.data || [],
    tickets: ticketRes.data || [],
    canais: canalRes.data || [],
  })
}

/**
 * PATCH /api/super-admin/organizacoes/[slug]
 * Atualiza campos da org: nome, plano, ativo, logo_url, cor_primaria
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const user = await verifySuperAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  const body = await request.json()
  const { nome, plano, ativo, logo_url, cor_primaria } = body

  const service = createServiceClient()
  const updates: Record<string, unknown> = { atualizado_em: new Date().toISOString() }
  if (nome !== undefined) updates.nome = nome
  if (plano !== undefined) updates.plano = plano
  if (ativo !== undefined) updates.ativo = ativo
  if (logo_url !== undefined) updates.logo_url = logo_url
  if (cor_primaria !== undefined) updates.cor_primaria = cor_primaria

  const { data, error } = await service
    .from('organizacoes')
    .update(updates)
    .eq('slug', slug)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, organizacao: data })
}
