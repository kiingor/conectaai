import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ORG_ID_HEADER } from '@/lib/tenant'

/**
 * POST /api/tickets/transferir
 *
 * Transfere um ticket para um colaborador ou para a fila (colaborador_id = null).
 *
 * Body params:
 * - ticket_id: string (obrigatório)
 * - setor_id: string (opcional) — novo setor destino
 * - colaborador_id: string | null (opcional) — atendente destino; null = fila
 * - from_colaborador_nome: string (opcional) — nome de quem transferiu (para mensagem do sistema)
 * - from_setor_nome: string (opcional) — nome do setor de origem (para mensagem do sistema)
 */
export async function POST(request: Request) {
  try {
    const orgId = (request as any).headers?.get?.(ORG_ID_HEADER) ?? null
    const body = await request.json()
    const { ticket_id, setor_id, colaborador_id, from_colaborador_nome, from_setor_nome, observacao } = body

    if (!ticket_id) {
      return NextResponse.json({ error: 'ticket_id é obrigatório' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // 1. Buscar ticket atual
    const ticketQuery = supabase
      .from('tickets')
      .select('id, setor_id, colaborador_id, cliente_id, status, organizacao_id, setores(nome)')
      .eq('id', ticket_id)
    if (orgId) ticketQuery.eq('organizacao_id', orgId)
    const { data: ticket, error: ticketError } = await ticketQuery.single()

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 })
    }

    const targetSetorId = setor_id || ticket.setor_id
    const updateData: Record<string, unknown> = {}
    let queued = false
    let toColabNome = 'Aguardando atendente'

    if (setor_id) {
      updateData.setor_id = setor_id
    }

    if (colaborador_id) {
      // Transferencia direta cai no atendente escolhido mesmo se ele estiver offline/em pausa.
      // Fila so acontece quando colaborador_id nao e enviado.
      const { data: colab } = await supabase
        .from('colaboradores')
        .select('id, nome, is_online, ativo, pausa_atual_id, organizacao_id')
        .eq('id', colaborador_id)
        .single()

      if (!colab?.ativo) {
        return NextResponse.json(
          { error: 'Este atendente esta inativo. Selecione outro atendente.' },
          { status: 422 }
        )
      }

      if (ticket.organizacao_id && colab.organizacao_id !== ticket.organizacao_id) {
        return NextResponse.json(
          { error: 'Este atendente nao pertence a organizacao do ticket.' },
          { status: 422 }
        )
      }

      const { data: vinculo } = await supabase
        .from('colaboradores_setores')
        .select('colaborador_id')
        .eq('colaborador_id', colaborador_id)
        .eq('setor_id', targetSetorId)
        .maybeSingle()

      if (!vinculo) {
        return NextResponse.json(
          { error: 'Este atendente nao pertence ao setor de destino.' },
          { status: 422 }
        )
      }
      updateData.colaborador_id = colaborador_id
      updateData.status = 'em_atendimento'
      updateData.atribuido_em = new Date().toISOString()
      toColabNome = colab.nome
    } else {
      // Transferir para fila (sem atendente específico)
      updateData.colaborador_id = null
      updateData.status = 'aberto'
      updateData.atribuido_em = null
      queued = true
    }

    // 2. Atualizar o ticket
    const { error: updateError } = await supabase
      .from('tickets')
      .update(updateData)
      .eq('id', ticket_id)

    if (updateError) {
      console.error('[Transferir] Erro ao atualizar ticket:', updateError)
      return NextResponse.json({ error: 'Erro ao transferir ticket' }, { status: 500 })
    }

    // 3. Buscar nome do setor destino para a mensagem
    let toSetorNome = from_setor_nome || 'Desconhecido'
    if (setor_id) {
      const { data: setor } = await supabase
        .from('setores')
        .select('nome')
        .eq('id', setor_id)
        .single()
      toSetorNome = setor?.nome || toSetorNome
    } else {
      toSetorNome = (ticket.setores as any)?.nome || toSetorNome
    }

    // 4. Inserir mensagem de sistema com log de transferência
    const fromNome = from_colaborador_nome || 'Desconhecido'
    const fromSetor = from_setor_nome || (ticket.setores as any)?.nome || 'Desconhecido'
    const conteudo = `Transferido de ${fromNome} - ${fromSetor} >> ${toColabNome} - ${toSetorNome}${observacao ? `. Obs: ${observacao}` : ''}`

    await supabase.from('mensagens').insert({
      ticket_id,
      cliente_id: ticket.cliente_id,
      remetente: 'sistema',
      conteudo,
      tipo: 'texto',
      enviado_em: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      queued,
      message: queued ? 'Ticket transferido para a fila' : 'Ticket transferido com sucesso',
      colaborador_id: updateData.colaborador_id ?? null,
      setor_id: targetSetorId,
    })
  } catch (error) {
    console.error('[Transferir] Erro inesperado:', error)
    return NextResponse.json(
      { error: 'Erro interno', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
