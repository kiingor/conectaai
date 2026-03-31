import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ORG_ID_HEADER } from '@/lib/tenant'

/**
 * PATCH /api/onboarding/empresa
 * Atualiza dados da empresa durante o onboarding (nome, logo, cor)
 */
export async function PATCH(request: NextRequest) {
  const orgId = request.headers.get(ORG_ID_HEADER)
  if (!orgId) return NextResponse.json({ error: 'Organization context missing' }, { status: 400 })

  const body = await request.json()
  const { nome, logo_url, cor_primaria } = body

  const service = createServiceClient()
  const updates: Record<string, unknown> = { atualizado_em: new Date().toISOString() }
  if (nome) updates.nome = nome
  if (logo_url !== undefined) updates.logo_url = logo_url
  if (cor_primaria) updates.cor_primaria = cor_primaria

  const { data, error } = await service
    .from('organizacoes')
    .update(updates)
    .eq('id', orgId)
    .select('id, nome, logo_url, cor_primaria')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, organizacao: data })
}
