import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

/**
 * GET /api/organizacao/workdesk-config?setorId=<uuid>
 * Retorna flags de configuracao do setor que afetam a UI do workdesk.
 * Endpoint usado por colaboradores autenticados.
 *
 * Se nao for passado setorId, usa o setor_id do colaborador atual
 * (ou o primeiro setor vinculado, se houver).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const service = createServiceClient()
    const { data: colaborador } = await service
      .from('colaboradores')
      .select('organizacao_id, setor_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!colaborador?.organizacao_id) {
      return NextResponse.json({ error: 'Colaborador sem organizacao' }, { status: 400 })
    }

    const url = new URL(request.url)
    let setorId = url.searchParams.get('setorId') || colaborador.setor_id

    // Fallback: primeiro setor vinculado via colaboradores_setores
    if (!setorId) {
      const { data: vinc } = await service
        .from('colaboradores_setores')
        .select('setor_id')
        .eq('organizacao_id', colaborador.organizacao_id)
        .limit(1)
        .maybeSingle()
      setorId = vinc?.setor_id || null
    }

    if (!setorId) {
      // Sem setor identificado — padrao: habilitado
      return NextResponse.json({ workdesk_novo_disparo_enabled: true })
    }

    const { data: setor, error } = await service
      .from('setores')
      .select('workdesk_novo_disparo_enabled')
      .eq('id', setorId)
      .eq('organizacao_id', colaborador.organizacao_id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      workdesk_novo_disparo_enabled: setor?.workdesk_novo_disparo_enabled ?? true,
    })
  } catch (error) {
    console.error('[workdesk-config][GET]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
