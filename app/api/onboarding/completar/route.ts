import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ORG_ID_HEADER } from '@/lib/tenant'

/**
 * POST /api/onboarding/completar
 * Marca o onboarding como concluído para a organização atual
 */
export async function POST(request: NextRequest) {
  const orgId = request.headers.get(ORG_ID_HEADER)
  if (!orgId) return NextResponse.json({ error: 'Organization context missing' }, { status: 400 })

  const service = createServiceClient()

  const { error } = await service
    .from('organizacoes')
    .update({ onboarding_completo: true, atualizado_em: new Date().toISOString() })
    .eq('id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
