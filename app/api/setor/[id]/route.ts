import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

/**
 * DELETE /api/setor/[id]
 *
 * Exclui permanentemente um setor e suas dependencias (vinculos de
 * colaboradores, subsetores, pausas, templates, canais, tipos de
 * atendimento, instancias Evolution). Apenas usuarios com
 * `colaboradores.is_master = true` e que pertencem a mesma organizacao
 * do setor podem executar.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: setorId } = await params
    if (!setorId) {
      return NextResponse.json({ error: 'setor id obrigatorio' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const service = createServiceClient()

    // Verifica se o usuario e master
    const { data: colaborador, error: colabErr } = await service
      .from('colaboradores')
      .select('id, is_master, organizacao_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (colabErr) {
      return NextResponse.json({ error: colabErr.message }, { status: 500 })
    }
    if (!colaborador) {
      return NextResponse.json({ error: 'Colaborador nao encontrado' }, { status: 403 })
    }
    if (!colaborador.is_master) {
      return NextResponse.json(
        { error: 'Apenas o master da organizacao pode excluir setores' },
        { status: 403 }
      )
    }

    // Verifica que o setor pertence a mesma organizacao do master
    const { data: setor, error: setorErr } = await service
      .from('setores')
      .select('id, organizacao_id, nome')
      .eq('id', setorId)
      .maybeSingle()

    if (setorErr) {
      return NextResponse.json({ error: setorErr.message }, { status: 500 })
    }
    if (!setor) {
      return NextResponse.json({ error: 'Setor nao encontrado' }, { status: 404 })
    }
    if (setor.organizacao_id !== colaborador.organizacao_id) {
      return NextResponse.json(
        { error: 'Setor nao pertence a sua organizacao' },
        { status: 403 }
      )
    }

    // Remover instancias Evolution antes de deletar canais do banco
    const { data: canais } = await service
      .from('setor_canais')
      .select('tipo, instancia')
      .eq('setor_id', setorId)

    const evolutionCanais = (canais || []).filter(
      (c) => c.tipo === 'evolution_api' && c.instancia
    )
    for (const canal of evolutionCanais) {
      try {
        const base = process.env.NEXT_PUBLIC_APP_URL || ''
        await fetch(`${base}/api/evolution/instance/${canal.instancia}`, {
          method: 'DELETE',
        })
      } catch (evoError) {
        console.error(
          `[setor][DELETE] Erro ao remover instancia Evolution ${canal.instancia}:`,
          evoError
        )
      }
    }

    // Deletar dependencias
    await service.from('colaboradores_setores').delete().eq('setor_id', setorId)
    await service.from('subsetores').delete().eq('setor_id', setorId)
    await service.from('pausas').delete().eq('setor_id', setorId)
    await service.from('templates_mensagem').delete().eq('setor_id', setorId)
    await service.from('setor_canais').delete().eq('setor_id', setorId)
    await service.from('setor_tipos_atendimento').delete().eq('setor_id', setorId)

    const { error: delErr } = await service
      .from('setores')
      .delete()
      .eq('id', setorId)

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, nome: setor.nome })
  } catch (error: any) {
    console.error('[setor][DELETE]', error)
    return NextResponse.json(
      { error: error?.message || 'Erro interno' },
      { status: 500 }
    )
  }
}
