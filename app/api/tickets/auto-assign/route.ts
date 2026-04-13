import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

/**
 * POST /api/tickets/auto-assign
 *
 * Looks for unassigned (aberto) tickets in a given setor and tries
 * to assign them to available collaborators (online, fresh heartbeat,
 * not on break, fewest active tickets).
 *
 * Body: { setorId?: string, organizacaoId?: string }
 *
 * If setorId is omitted, processes ALL unassigned tickets across all setores
 * in the given organizacaoId.
 */
export async function POST(request: Request) {
  try {
    const supabase = createServiceClient()

    let body: { setorId?: string; organizacaoId?: string } = {}
    try {
      body = await request.json()
    } catch {
      // empty body is fine
    }

    const { setorId, organizacaoId } = body

    const HEARTBEAT_STALE_MS = 5 * 60 * 1000
    const now = Date.now()

    // ── 1. Find unassigned open tickets ──────────────────────────────
    let ticketQuery = supabase
      .from('tickets')
      .select('id, setor_id, organizacao_id')
      .eq('status', 'aberto')
      .is('colaborador_id', null)

    if (setorId) ticketQuery = ticketQuery.eq('setor_id', setorId)
    if (organizacaoId) ticketQuery = ticketQuery.eq('organizacao_id', organizacaoId)

    const { data: pendingTickets, error: ticketsError } = await ticketQuery

    if (ticketsError) {
      console.error('[auto-assign] Error fetching tickets:', ticketsError)
      return NextResponse.json({ error: ticketsError.message }, { status: 500 })
    }

    if (!pendingTickets || pendingTickets.length === 0) {
      return NextResponse.json({ assigned: 0, message: 'No pending tickets' })
    }

    console.log(`[auto-assign] ${pendingTickets.length} ticket(s) pendente(s)`)

    // ── 2. Group tickets by setor ─────────────────────────────────────
    const bySetor: Record<string, { id: string; organizacao_id: string }[]> = {}
    for (const t of pendingTickets) {
      if (!bySetor[t.setor_id]) bySetor[t.setor_id] = []
      bySetor[t.setor_id].push({ id: t.id, organizacao_id: t.organizacao_id })
    }

    let totalAssigned = 0

    for (const [sId, tickets] of Object.entries(bySetor)) {
      // ── 3. Get collaborators in this setor ───────────────────────────
      const { data: rawData } = await supabase
        .from('colaboradores_setores')
        .select('colaborador_id, colaboradores(id, nome, is_online, ativo, pausa_atual_id, last_heartbeat)')
        .eq('setor_id', sId)

      const allColabs = (rawData || []).map((cs: any) => cs.colaboradores).filter(Boolean)

      // Mark stale collaborators as offline
      const stale = allColabs.filter(
        (c: any) =>
          c.ativo &&
          c.is_online &&
          (!c.last_heartbeat || now - new Date(c.last_heartbeat).getTime() > HEARTBEAT_STALE_MS),
      )
      if (stale.length > 0) {
        await supabase
          .from('colaboradores')
          .update({ is_online: false })
          .in('id', stale.map((c: any) => c.id))
        console.log(`[auto-assign] Marcou ${stale.length} colaborador(es) offline (heartbeat stale)`)
      }

      const available = allColabs.filter(
        (c: any) =>
          c.ativo &&
          c.is_online &&
          !c.pausa_atual_id &&
          c.last_heartbeat &&
          now - new Date(c.last_heartbeat).getTime() < HEARTBEAT_STALE_MS,
      )

      console.log(`[auto-assign] Setor ${sId}: ${available.length} atendente(s) disponível(is)`)

      if (available.length === 0) continue

      // ── 4. Count active tickets per collaborator ─────────────────────
      const colaboradorIds = available.map((c: any) => c.id)

      const { data: ticketCounts } = await supabase
        .from('tickets')
        .select('colaborador_id')
        .in('colaborador_id', colaboradorIds)
        .in('status', ['aberto', 'em_atendimento'])

      const countMap: Record<string, number> = {}
      ticketCounts?.forEach((t: any) => {
        if (t.colaborador_id) countMap[t.colaborador_id] = (countMap[t.colaborador_id] || 0) + 1
      })

      // ── 5. Assign each pending ticket ────────────────────────────────
      for (const ticket of tickets) {
        // Re-sort each iteration so counts stay accurate after assignment
        const sorted = available
          .map((c: any) => ({ id: c.id, nome: c.nome, count: countMap[c.id] || 0 }))
          .sort((a: any, b: any) => a.count - b.count)

        const best = sorted[0]
        if (!best) continue

        const { error: updateError } = await supabase
          .from('tickets')
          .update({ colaborador_id: best.id, status: 'em_atendimento' })
          .eq('id', ticket.id)

        if (!updateError) {
          countMap[best.id] = (countMap[best.id] || 0) + 1
          totalAssigned++
          console.log(`[auto-assign] Ticket ${ticket.id} → ${best.nome} (${best.count} ativos)`)

          // Log
          try {
            await supabase.from('ticket_logs').insert({
              ticket_id: ticket.id,
              tipo: 'atribuicao_automatica',
              descricao: `Ticket atribuído automaticamente para ${best.nome}`,
              ...(ticket.organizacao_id ? { organizacao_id: ticket.organizacao_id } : {}),
            })
          } catch { /* ticket_logs may not exist */ }
        }
      }
    }

    return NextResponse.json({ assigned: totalAssigned })
  } catch (error) {
    console.error('[auto-assign] Unhandled error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
