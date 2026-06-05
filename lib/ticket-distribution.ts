import { createServiceClient } from '@/lib/supabase/service'

interface DistribuicaoResult {
  ticketId: string
  colaboradorId: string | null
}

/**
 * Creates a new ticket and assigns it to the first available collaborator
 * in the sector (online, fresh heartbeat, fewest active tickets).
 * If no one is available, ticket stays as 'aberto' (pending).
 */
export async function criarEDistribuirTicket(
  clienteId: string,
  setorId: string,
  canal: string = 'whatsapp',
  subsetorId: string | null = null,
  orgId: string | null = null
): Promise<DistribuicaoResult | null> {
  const supabase = createServiceClient()

  console.log(`[Distribuição] criarEDistribuirTicket — clienteId=${clienteId}, setorId=${setorId}, canal=${canal}`)

  try {
    // 1. Check if auto-assign is enabled
    let autoAssignEnabled = true
    try {
      const configQuery = supabase
        .from('ticket_distribution_config')
        .select('auto_assign_enabled')
        .eq('setor_id', setorId)
      if (orgId) configQuery.eq('organizacao_id', orgId)
      const { data: config } = await configQuery.maybeSingle()
      if (config) autoAssignEnabled = config.auto_assign_enabled ?? true
    } catch {
      // Table may not exist — use defaults
    }

    // 2. Create the ticket
    const ticketData: Record<string, unknown> = {
      cliente_id: clienteId,
      setor_id: setorId,
      status: 'aberto',
      canal: canal,
      prioridade: 'normal',
    }
    if (orgId) ticketData.organizacao_id = orgId

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert(ticketData)
      .select('id')
      .single()

    if (ticketError || !ticket) {
      console.error('[criarEDistribuirTicket] Erro ao inserir ticket:', JSON.stringify(ticketError))
      return null
    }

    let assignedColaboradorId: string | null = null

    // 3. If auto-assign is enabled, find an available collaborator
    if (autoAssignEnabled) {
      const colabQuery = supabase
        .from('colaboradores_setores')
        .select('colaborador_id, colaboradores(id, nome, is_online, ativo, pausa_atual_id)')
        .eq('setor_id', setorId)
      const { data: rawData } = await colabQuery

      const rawColabs = (rawData || []).map((cs: any) => cs.colaboradores).filter(Boolean)

      // Disponibilidade controlada APENAS pelo botão online/offline do workdesk.
      // O heartbeat não bloqueia mais a distribuição.
      const available = rawColabs.filter((c: any) =>
        c && c.ativo && c.is_online && !c.pausa_atual_id
      )

      console.log(`[Distribuição] ${available.length} atendentes disponíveis para setorId=${setorId}`)

      if (available.length > 0) {
        const colaboradorIds = available.map((c: any) => c.id)

        // Count active tickets per collaborator
        const { data: ticketCounts } = await supabase
          .from('tickets')
          .select('colaborador_id')
          .in('colaborador_id', colaboradorIds)
          .in('status', ['aberto', 'em_atendimento'])

        const countMap: Record<string, number> = {}
        ticketCounts?.forEach((t: any) => {
          if (t.colaborador_id) countMap[t.colaborador_id] = (countMap[t.colaborador_id] || 0) + 1
        })

        // Pick collaborator with fewest active tickets
        const sorted = available
          .map((c: any) => ({ id: c.id, nome: c.nome, count: countMap[c.id] || 0 }))
          .sort((a: any, b: any) => a.count - b.count)

        const best = sorted[0]
        if (best) {
          const { data: updatedTicket, error: updateError } = await supabase
            .from('tickets')
            .update({
              colaborador_id: best.id,
              status: 'em_atendimento',
              atribuido_em: new Date().toISOString(),
            })
            .eq('id', ticket.id)
            .is('colaborador_id', null)
            .select('id')
            .maybeSingle()

          if (!updateError && updatedTicket) {
            assignedColaboradorId = best.id
            console.log(`[Distribuição] Ticket ${ticket.id} atribuído para ${best.nome} (${best.count} tickets ativos)`)
          }
        }
      }
    }

    // 4. Log ticket creation
    try {
      await supabase.from('ticket_logs').insert({
        ticket_id: ticket.id,
        tipo: 'criacao',
        descricao: assignedColaboradorId
          ? 'Ticket criado e atribuído automaticamente'
          : 'Ticket criado e aguardando atribuição',
      })
    } catch { /* table may not exist */ }

    return { ticketId: ticket.id, colaboradorId: assignedColaboradorId }
  } catch (error) {
    console.error('Error in criarEDistribuirTicket:', error)
    return null
  }
}
