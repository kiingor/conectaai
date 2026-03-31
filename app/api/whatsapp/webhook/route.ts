import { createServiceClient } from '@/lib/supabase/service'
import { resolveOrgByPhoneNumberId } from '@/lib/tenant'
import { NextRequest, NextResponse } from 'next/server'
import { criarEDistribuirTicket } from '@/lib/ticket-distribution'

// Webhook verification (GET request from WhatsApp)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[v0] Webhook verified successfully')
    return new NextResponse(challenge, { status: 200 })
  }

  return new NextResponse('Forbidden', { status: 403 })
}

// Receive messages (POST request from WhatsApp)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // Webhook is called by external systems (WhatsApp/Evolution) without user session
    const supabase = createServiceClient()

    // Process WhatsApp Cloud API webhook payload
    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value

    if (!value?.messages?.[0]) {
      // Not a message event, could be status update
      return NextResponse.json({ status: 'ok' })
    }

    const message = value.messages[0]
    const contact = value.contacts?.[0]
    const metadata = value.metadata

    const phoneNumber = message.from
    const customerName = contact?.profile?.name || 'Desconhecido'
    const messageContent = message.text?.body || ''
    const messageType = message.type || 'texto'
    const phoneNumberId = metadata?.phone_number_id

    // Map WhatsApp message types to our types
    const tipoMapeado =
      {
        text: 'texto',
        image: 'imagem',
        audio: 'audio',
        video: 'video',
        document: 'documento',
      }[messageType] || 'texto'

    // 1. Resolve organizacao_id e setor a partir do phone_number_id
    let targetSetorId: string | null = null
    let resolvedCanalEnvio: string = 'whatsapp'
    let orgId: string | null = null

    if (phoneNumberId) {
      // Priority 1: Check setor_canais by phone_number_id (WhatsApp)
      const { data: canalMatch } = await supabase
        .from('setor_canais')
        .select('setor_id, tipo, organizacao_id')
        .eq('phone_number_id', phoneNumberId)
        .eq('ativo', true)
        .limit(1)
        .maybeSingle()

      if (canalMatch) {
        targetSetorId = canalMatch.setor_id
        orgId = canalMatch.organizacao_id
        resolvedCanalEnvio = canalMatch.tipo === 'evolution_api' ? 'evolutionapi' : canalMatch.tipo
        console.log(`[v0] Resolved setor ${targetSetorId} / org ${orgId} from setor_canais (phone_number_id: ${phoneNumberId})`)
      }

      // Priority 1b: Check setor_canais by instancia (Evolution API)
      if (!targetSetorId) {
        const { data: evoMatch } = await supabase
          .from('setor_canais')
          .select('setor_id, tipo, organizacao_id')
          .eq('instancia', phoneNumberId)
          .eq('tipo', 'evolution_api')
          .eq('ativo', true)
          .limit(1)
          .maybeSingle()

        if (evoMatch) {
          targetSetorId = evoMatch.setor_id
          orgId = evoMatch.organizacao_id
          resolvedCanalEnvio = 'evolutionapi'
          console.log(`[v0] Resolved setor ${targetSetorId} / org ${orgId} from setor_canais (instancia: ${phoneNumberId})`)
        }
      }

      // Priority 2: Fallback to setores table (campo legado)
      if (!targetSetorId) {
        const { data: setorByPhone } = await supabase
          .from('setores')
          .select('id, organizacao_id')
          .eq('phone_number_id', phoneNumberId)
          .limit(1)
          .maybeSingle()

        if (setorByPhone) {
          targetSetorId = setorByPhone.id
          orgId = setorByPhone.organizacao_id
          console.log(`[v0] Resolved setor ${targetSetorId} / org ${orgId} from setores.phone_number_id`)
        }
      }

      // Priority 3: resolve org via lib/tenant helper (verifica setor_canais + setores)
      if (!orgId) {
        orgId = await resolveOrgByPhoneNumberId(phoneNumberId)
      }
    }

    // Em multi-tenant não há fallback genérico — sem org identificada, rejeita silenciosamente
    if (!orgId || !targetSetorId) {
      console.error(`[v0] Could not resolve org/setor from phone_number_id: ${phoneNumberId}`)
      return NextResponse.json({ status: 'ok' })
    }

    // 2. Find or create customer scoped to this org
    let { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .upsert(
        {
          nome: customerName,
          telefone: phoneNumber,
          organizacao_id: orgId,
        },
        {
          onConflict: 'telefone,organizacao_id',
          ignoreDuplicates: false,
        }
      )
      .select('id')
      .single()

    // If upsert fails, try to find existing customer
    if (clienteError || !cliente) {
      const { data: existingCliente } = await supabase
        .from('clientes')
        .select('id')
        .eq('telefone', phoneNumber)
        .eq('organizacao_id', orgId)
        .single()

      if (!existingCliente) {
        console.error('[v0] Error finding/creating customer:', clienteError)
        return NextResponse.json({ error: 'Error creating customer' }, { status: 500 })
      }

      cliente = existingCliente
    }

    // 3. Find open ticket for this cliente IN THIS SPECIFIC SETOR + ORG
    let { data: ticket } = await supabase
      .from('tickets')
      .select('id, setor_id')
      .eq('cliente_id', cliente.id)
      .eq('setor_id', targetSetorId)
      .eq('organizacao_id', orgId)
      .in('status', ['aberto', 'em_atendimento'])
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Also check other clientes with same phone (dedup by telefone dentro da org)
    if (!ticket) {
      const { data: allClientesWithPhone } = await supabase
        .from('clientes')
        .select('id')
        .eq('telefone', phoneNumber)
        .eq('organizacao_id', orgId)

      if (allClientesWithPhone && allClientesWithPhone.length > 0) {
        const clienteIds = allClientesWithPhone.map(c => c.id)

        const { data: existingTicket } = await supabase
          .from('tickets')
          .select('id, setor_id, cliente_id')
          .in('cliente_id', clienteIds)
          .eq('setor_id', targetSetorId)
          .eq('organizacao_id', orgId)
          .in('status', ['aberto', 'em_atendimento'])
          .order('criado_em', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (existingTicket) {
          ticket = existingTicket
          cliente = { id: existingTicket.cliente_id }
          console.log(`[v0] Found existing ticket ${ticket.id} for phone ${phoneNumber} in setor ${targetSetorId}`)
        }
      }
    }

    if (!ticket) {
      // Create and distribute ticket in the resolved setor + org
      const result = await criarEDistribuirTicket(cliente.id, targetSetorId, 'whatsapp', null, orgId)

      if (!result) {
        console.error('[v0] Error creating ticket')
        return NextResponse.json({ error: 'Error creating ticket' }, { status: 500 })
      }

      ticket = { id: result.ticketId, setor_id: targetSetorId }

      console.log(
        `[v0] New ticket created: ${result.ticketId} in setor ${targetSetorId} / org ${orgId}, assigned to: ${result.colaboradorId || 'none'}`
      )
    }

    // 4. Save the message with canal_envio for routing replies
    const { error: messageError } = await supabase.from('mensagens').insert({
      ticket_id: ticket.id,
      cliente_id: cliente.id,
      remetente: 'cliente',
      conteudo: messageContent,
      tipo: tipoMapeado,
      phone_number_id: phoneNumberId,
      canal_envio: resolvedCanalEnvio,
      organizacao_id: orgId,
    })

    if (messageError) {
      console.error('[v0] Error saving message:', messageError)
      return NextResponse.json({ error: 'Error saving message' }, { status: 500 })
    }

    console.log(`[v0] Message received and saved for ticket ${ticket.id}`)

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('[v0] Webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
