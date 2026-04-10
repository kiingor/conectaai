import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'
import { criarEDistribuirTicket } from '@/lib/ticket-distribution'
import { ORG_ID_HEADER } from '@/lib/tenant'

/**
 * API to create a new ticket with optional subsetor routing
 * This is typically called by external systems (chatbots, flows)
 * that have already determined the appropriate setor and subsetor
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // Use service role to bypass RLS — this endpoint is called by bots/n8n without user session
    const supabase = createServiceClient()

    const {
      cliente_id,
      telefone,
      nome_cliente,
      setor_id,
      subsetor_id,
      canal = 'whatsapp',
      phone_number_id,
      organizacao_id: orgIdFromBody,
    } = body

    // orgId: header (browser/subdomain) > body (n8n/bot) > resolve from setor_id
    let orgId: string | null = request.headers.get(ORG_ID_HEADER) || orgIdFromBody || null

    // Validate required fields
    if (!setor_id) {
      return NextResponse.json({ error: 'setor_id é obrigatório' }, { status: 400 })
    }

    if (!cliente_id && !telefone) {
      return NextResponse.json({ error: 'cliente_id ou telefone é obrigatório' }, { status: 400 })
    }

    // Se orgId não veio no header nem no body, resolve a partir do setor_id
    if (!orgId) {
      const { data: setorData } = await supabase
        .from('setores')
        .select('organizacao_id')
        .eq('id', setor_id)
        .single()
      orgId = setorData?.organizacao_id || null
    }

    if (!orgId) {
      return NextResponse.json({ error: 'Organization context missing' }, { status: 400 })
    }

    let finalClienteId = cliente_id

    // If cliente_id not provided, find or create by telefone
    if (!finalClienteId && telefone) {
      const { data: existingCliente } = await supabase
        .from('clientes')
        .select('id')
        .eq('telefone', telefone)
        .eq('organizacao_id', orgId)
        .maybeSingle()

      if (existingCliente) {
        finalClienteId = existingCliente.id
      } else {
        // Create new cliente
        const { data: newCliente, error: clienteError } = await supabase
          .from('clientes')
          .insert({
            telefone,
            nome: nome_cliente || 'Desconhecido',
            organizacao_id: orgId,
          })
          .select('id')
          .single()

        if (clienteError || !newCliente) {
          return NextResponse.json({ error: 'Erro ao criar cliente' }, { status: 500 })
        }

        finalClienteId = newCliente.id
      }
    }

    // Check if there's already an open ticket for this cliente in this setor + org
    const { data: existingTicket } = await supabase
      .from('tickets')
      .select('id, status, colaborador_id')
      .eq('cliente_id', finalClienteId)
      .eq('setor_id', setor_id)
      .eq('organizacao_id', orgId)
      .in('status', ['aberto', 'em_atendimento'])
      .maybeSingle()

    if (existingTicket) {
      return NextResponse.json({
        success: true,
        ticket_id: existingTicket.id,
        existing: true,
        message: 'Ticket já existe para este cliente neste setor'
      })
    }

    // Create and distribute the ticket
    const result = await criarEDistribuirTicket(
      finalClienteId,
      setor_id,
      canal,
      null,
      orgId
    )

    if (!result) {
      return NextResponse.json({ error: 'Erro ao criar ticket' }, { status: 500 })
    }

    console.log(`[v0] Ticket created via API: ${result.ticketId}, setor: ${setor_id}, subsetor: ${subsetor_id || 'none'}, assigned to: ${result.colaboradorId || 'none'}`)

    return NextResponse.json({
      success: true,
      ticket_id: result.ticketId,
      colaborador_id: result.colaboradorId,
      existing: false,
      message: result.colaboradorId
        ? 'Ticket criado e atribuído automaticamente'
        : 'Ticket criado e aguardando atribuição'
    })

  } catch (error) {
    console.error('[v0] Error creating ticket:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
