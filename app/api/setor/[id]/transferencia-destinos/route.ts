import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const CONFIG_TELA = 'setor_transferencia_config'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: setorId } = await params
    const supabase = createServiceClient()

    const { data: setor, error: setorError } = await supabase
      .from('setores')
      .select('id, organizacao_id')
      .eq('id', setorId)
      .maybeSingle()

    if (setorError) throw setorError
    if (!setor) return NextResponse.json({ error: 'Setor nao encontrado' }, { status: 404 })

    const { data: config, error: configError } = await supabase
      .from('error_logs')
      .select('metadata')
      .eq('tela', CONFIG_TELA)
      .eq('rota', `/setor/${setorId}`)
      .eq('resolvido', false)
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (configError) throw configError

    const destinoIds = Array.isArray(config?.metadata?.destino_ids)
      ? config.metadata.destino_ids
      : []

    const { data: destinos, error: destinosError } = await supabase
      .from('setores')
      .select('id, nome')
      .eq('organizacao_id', setor.organizacao_id)
      .neq('id', setorId)
      .in('id', destinoIds.length > 0 ? destinoIds : ['00000000-0000-0000-0000-000000000000'])
      .order('nome')

    if (destinosError) throw destinosError

    return NextResponse.json({
      destino_ids: destinoIds,
      destinos: destinos || [],
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao carregar destinos de transferencia' },
      { status: 500 },
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: setorId } = await params
    const body = await request.json()
    const destinoIds = Array.isArray(body?.destino_ids)
      ? [...new Set(body.destino_ids.filter((id: unknown) => typeof id === 'string' && id !== setorId))]
      : []

    const supabase = createServiceClient()

    const { data: setor, error: setorError } = await supabase
      .from('setores')
      .select('id, nome, organizacao_id')
      .eq('id', setorId)
      .maybeSingle()

    if (setorError) throw setorError
    if (!setor) return NextResponse.json({ error: 'Setor nao encontrado' }, { status: 404 })

    const { data: destinosValidos, error: destinosError } = await supabase
      .from('setores')
      .select('id')
      .eq('organizacao_id', setor.organizacao_id)
      .neq('id', setorId)
      .in('id', destinoIds.length > 0 ? destinoIds : ['00000000-0000-0000-0000-000000000000'])

    if (destinosError) throw destinosError

    const validDestinoIds = (destinosValidos || []).map((s: any) => s.id)

    const { error: clearError } = await supabase
      .from('error_logs')
      .update({ resolvido: true, resolvido_por: 'transferencia_config' })
      .eq('tela', CONFIG_TELA)
      .eq('rota', `/setor/${setorId}`)
      .eq('resolvido', false)

    if (clearError) throw clearError

    const { error: insertError } = await supabase.from('error_logs').insert({
      tela: CONFIG_TELA,
      rota: `/setor/${setorId}`,
      log: 'Configuracao de destinos de transferencia',
      componente: 'transferencia-destinos',
      organizacao_id: setor.organizacao_id,
      metadata: {
        setor_id: setorId,
        setor_nome: setor.nome,
        destino_ids: validDestinoIds,
      },
    })

    if (insertError) throw insertError

    return NextResponse.json({ destino_ids: validDestinoIds })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao salvar destinos de transferencia' },
      { status: 500 },
    )
  }
}
