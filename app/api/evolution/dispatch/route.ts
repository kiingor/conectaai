import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ORG_ID_HEADER } from '@/lib/tenant'

const EVOLUTION_BASE_URL = 'https://evolution.conectaai.net'
const EVOLUTION_GLOBAL_API_KEY =
  'eVo2026xK9mT4wBqL7nRjZ3cY8hF1dSgP5vA0iUoWlEbNfQrHs'

export async function POST(request: NextRequest) {
  try {
    const orgId = request.headers.get(ORG_ID_HEADER)
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { clienteNome, clienteCnpj, clienteRegistro, telefone, setorId, mensagem } = body

    if (!clienteNome || !telefone || !setorId || !mensagem) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: clienteNome, telefone, setorId, mensagem' },
        { status: 400 },
      )
    }

    // Get colaborador info
    let colaboradorQuery = supabase
      .from('colaboradores')
      .select('id, nome, setor_id')
      .eq('email', user.email)
    if (orgId) colaboradorQuery = colaboradorQuery.eq('organizacao_id', orgId)
    const { data: colaborador } = await colaboradorQuery.single()

    if (!colaborador) {
      return NextResponse.json({ error: 'Colaborador não encontrado' }, { status: 404 })
    }

    // Get active Evolution canal for the setor
    let canalQuery = supabase
      .from('setor_canais')
      .select('evolution_base_url, evolution_api_key, instancia')
      .eq('setor_id', setorId)
      .eq('tipo', 'evolution_api')
      .eq('ativo', true)
    if (orgId) canalQuery = canalQuery.eq('organizacao_id', orgId)
    const { data: canalEvolution } = await canalQuery
      .order('criado_em', { ascending: true })
      .limit(1)
      .maybeSingle()

    const evolutionBaseUrl =
      canalEvolution?.evolution_base_url ||
      process.env.EVOLUTION_BASE_URL ||
      EVOLUTION_BASE_URL
    const evolutionApiKey =
      canalEvolution?.evolution_api_key ||
      process.env.EVOLUTION_GLOBAL_API_KEY ||
      EVOLUTION_GLOBAL_API_KEY
    const instanceName = canalEvolution?.instancia

    if (!instanceName) {
      return NextResponse.json(
        { error: 'Nenhuma instância Evolution configurada e ativa neste setor' },
        { status: 400 },
      )
    }

    // Format phone number
    const phoneDigits = telefone.replace(/\D/g, '')
    const formattedPhone = phoneDigits.length === 11 ? `55${phoneDigits}` : phoneDigits

    // Find or create cliente
    const cleanCnpj = clienteCnpj?.replace(/\D/g, '') || null

    let clienteId: string

    let clienteLookup = supabase
      .from('clientes')
      .select('id')
      .eq('telefone', formattedPhone)
    if (orgId) clienteLookup = clienteLookup.eq('organizacao_id', orgId)
    const { data: existingCliente } = await clienteLookup.maybeSingle()

    if (existingCliente) {
      clienteId = existingCliente.id
      await supabase
        .from('clientes')
        .update({
          CNPJ: cleanCnpj || undefined,
          Registro: clienteRegistro || undefined,
          nome: clienteNome,
        })
        .eq('id', clienteId)
    } else {
      const clienteInsert: Record<string, unknown> = {
        nome: clienteNome,
        telefone: formattedPhone,
        CNPJ: cleanCnpj,
        Registro: clienteRegistro || null,
      }
      if (orgId) clienteInsert.organizacao_id = orgId
      const { data: newCliente, error: clienteError } = await supabase
        .from('clientes')
        .insert(clienteInsert)
        .select('id')
        .single()

      if (clienteError || !newCliente) {
        console.error('[Evolution Dispatch] Error creating cliente:', JSON.stringify(clienteError))
        return NextResponse.json(
          { error: 'Erro ao criar cliente', details: clienteError?.message || clienteError },
          { status: 500 },
        )
      }
      clienteId = newCliente.id
    }

    // Check for existing open ticket for this client in this setor
    let ticketLookup = supabase
      .from('tickets')
      .select('id, numero, colaborador_id, colaboradores(nome)')
      .eq('cliente_id', clienteId)
      .eq('setor_id', setorId)
      .in('status', ['aberto', 'em_atendimento'])
    if (orgId) ticketLookup = ticketLookup.eq('organizacao_id', orgId)
    const { data: existingTicket } = await ticketLookup.maybeSingle()

    let ticketId: string
    let ticketNumero: number | null = null

    if (existingTicket) {
      const atendenteName = (existingTicket as any)?.colaboradores?.nome || null
      return NextResponse.json({
        success: false,
        warning: 'Ja existe um ticket aberto para este cliente',
        ticketId: existingTicket.id,
        ticketNumero: existingTicket.numero,
        atendente: atendenteName,
      })
    } else {
      // Create ticket — no is_disparo flag (agent can reply immediately, no lock)
      const ticketInsert: Record<string, unknown> = {
        cliente_id: clienteId,
        colaborador_id: colaborador.id,
        setor_id: setorId,
        status: 'em_atendimento',
        prioridade: 'normal',
        canal: 'whatsapp',
      }
      if (orgId) ticketInsert.organizacao_id = orgId
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert(ticketInsert)
        .select('id, numero')
        .single()

      if (ticketError || !ticket) {
        console.error('[Evolution Dispatch] Error creating ticket:', JSON.stringify(ticketError))
        return NextResponse.json(
          { error: 'Erro ao criar ticket', details: ticketError?.message || ticketError },
          { status: 500 },
        )
      }
      ticketId = ticket.id
      ticketNumero = ticket.numero
    }

    // Send message via EvolutionAPI
    const baseUrl = evolutionBaseUrl.replace(/\/+$/, '')
    const evolutionUrl = `${baseUrl}/message/sendText/${instanceName}`
    const evolutionBody = {
      number: formattedPhone,
      text: mensagem,
      delay: 1000,
    }

    const evolutionResponse = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: evolutionApiKey,
      },
      body: JSON.stringify(evolutionBody),
    })

    const evolutionData = await evolutionResponse.json()

    if (!evolutionResponse.ok) {
      console.error('[Evolution Dispatch] API error:', evolutionData)
      return NextResponse.json(
        { error: 'Erro ao enviar mensagem via EvolutionAPI', details: evolutionData },
        { status: evolutionResponse.status },
      )
    }

    const evolutionMessageId =
      evolutionData?.key?.id ||
      evolutionData?.message?.key?.id ||
      null

    // Extract canonical phone from remoteJid returned by Evolution API
    // Apenas aceita o formato "@s.whatsapp.net" — ignora "@lid" e outros formatos
    // internos do WhatsApp que não representam um número de telefone real.
    // Exemplo válido:   "558399399202@s.whatsapp.net" → "558399399202"
    // Exemplo inválido: "230571745747156@lid"         → ignorado
    const remoteJid: string | undefined =
      evolutionData?.key?.remoteJid ||
      evolutionData?.message?.key?.remoteJid

    if (remoteJid && remoteJid.endsWith('@s.whatsapp.net')) {
      const canonicalPhone = remoteJid.replace('@s.whatsapp.net', '')
      if (canonicalPhone && canonicalPhone !== formattedPhone) {
        await supabase
          .from('clientes')
          .update({ telefone: canonicalPhone })
          .eq('id', clienteId)
        console.log(`[Evolution Dispatch] Updated client phone: ${formattedPhone} → ${canonicalPhone}`)
      }
      // Se já é igual, nenhuma atualização necessária
    } else if (remoteJid) {
      console.log(`[Evolution Dispatch] remoteJid ignorado (formato não é @s.whatsapp.net): ${remoteJid}`)
    }

    // Save message in DB as bot message (initial dispatch message)
    const msgInsert: Record<string, unknown> = {
      ticket_id: ticketId,
      remetente: 'bot',
      conteudo: mensagem,
      tipo: 'texto',
      phone_number_id: instanceName,
      canal_envio: 'evolutionapi',
      whatsapp_message_id: evolutionMessageId,
      enviado_em: new Date().toISOString(),
    }
    if (orgId) msgInsert.organizacao_id = orgId
    const { error: msgError } = await supabase.from('mensagens').insert(msgInsert)

    if (msgError) {
      console.error('[Evolution Dispatch] Error saving message:', JSON.stringify(msgError))
    }

    // Save dispatch log
    const logInsert: Record<string, unknown> = {
      setor_id: setorId,
      colaborador_id: colaborador.id,
      ticket_id: ticketId,
      cliente_nome: clienteNome,
      cliente_telefone: formattedPhone,
      template_usado: `[Evolution] ${mensagem.slice(0, 60)}${mensagem.length > 60 ? '...' : ''}`,
      status: 'enviado',
    }
    if (orgId) logInsert.organizacao_id = orgId
    const { error: logError } = await supabase.from('disparo_logs').insert(logInsert)

    if (logError) {
      console.error('[Evolution Dispatch] Error saving disparo_log:', JSON.stringify(logError))
    }

    return NextResponse.json({
      success: true,
      ticketId,
      ticketNumero,
      clienteId,
    })
  } catch (error) {
    console.error('[Evolution Dispatch] Error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
