/**
 * Parser para mensagens vindas de integrações WhatsApp (n8n, Evolution/Baileys).
 *
 * Bots upstream às vezes serializam o objeto `message.message` do Baileys
 * diretamente no `conteudo`, opcionalmente prefixando com o nome do contato:
 *
 *   *Luany Acerta Express 🚛✈* - {"messageContextInfo":{...},"reactionMessage":{...}}
 *
 * Esse parser detecta esse padrão (e variações) e retorna uma união discriminada
 * que os componentes de chat conseguem renderizar de forma útil.
 *
 * Mantém TUDO puro (sem React/DOM) pra poder ser usado em SSR e em testes.
 */

export type ParsedMessage =
  | { kind: 'text'; text: string }
  | { kind: 'reaction'; emoji: string; senderName?: string; targetMessageId?: string }
  | { kind: 'contact'; contacts: ParsedContact[]; senderName?: string }
  | { kind: 'location'; latitude?: number; longitude?: number; name?: string; address?: string; isLive?: boolean; senderName?: string }
  | { kind: 'poll'; question: string; options: string[]; senderName?: string }
  | { kind: 'sticker'; senderName?: string }
  | { kind: 'ephemeral'; inner?: ParsedMessage; senderName?: string }
  | { kind: 'protocol'; action?: string; senderName?: string }
  | { kind: 'unknown'; rawType?: string; raw: string; senderName?: string }

export interface ParsedContact {
  name: string
  phone?: string
}

// Tenta extrair "*Nome* - " do início do conteúdo
const PREFIX_RE = /^\*([^*]{1,80})\*\s*[-–:]\s*/

// Tipos Baileys que nos interessam (e suas variantes versionadas)
const REACTION_KEYS = ['reactionMessage']
const CONTACT_KEYS = ['contactMessage', 'contactsArrayMessage']
const LOCATION_KEYS = ['locationMessage', 'liveLocationMessage']
const POLL_KEYS = ['pollCreationMessage', 'pollCreationMessageV2', 'pollCreationMessageV3']
const STICKER_KEYS = ['stickerMessage']
const EPHEMERAL_KEYS = ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension']
const PROTOCOL_KEYS = ['protocolMessage', 'editedMessage', 'messageContextInfo']
// Tipos que carregam texto puro dentro do payload Baileys
const TEXT_KEYS = ['conversation', 'extendedTextMessage', 'imageMessage', 'videoMessage', 'documentMessage']

/**
 * Detecta se uma string parece um payload Baileys serializado.
 * Retorna o nome do contato (se houver prefixo) e a string JSON candidata.
 */
function detectBaileysPayload(content: string): { jsonStr: string; senderName?: string } | null {
  if (!content) return null
  const trimmed = content.trim()
  if (!trimmed) return null

  let rest = trimmed
  let senderName: string | undefined

  const prefixMatch = rest.match(PREFIX_RE)
  if (prefixMatch) {
    senderName = prefixMatch[1].trim()
    rest = rest.slice(prefixMatch[0].length).trim()
  }

  // Tem que começar com { ou [ pra ser JSON
  if (!rest.startsWith('{') && !rest.startsWith('[')) return null

  // Heurística: pra ser Baileys precisa conter pelo menos uma das chaves conhecidas
  const knownKeys = [
    ...REACTION_KEYS, ...CONTACT_KEYS, ...LOCATION_KEYS, ...POLL_KEYS,
    ...STICKER_KEYS, ...EPHEMERAL_KEYS, ...PROTOCOL_KEYS, ...TEXT_KEYS,
    'vcard', 'displayName', 'phones', 'formatted_name',
  ]
  const looksLikeBaileys = knownKeys.some((k) => rest.includes(`"${k}"`))
  if (!looksLikeBaileys) return null

  return { jsonStr: rest, senderName }
}

/** Parse de vCard simples — extrai nome (FN) e primeiro telefone (TEL) */
function parseVCard(vcard: string): { name?: string; phone?: string } {
  const out: { name?: string; phone?: string } = {}
  const lines = vcard.split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trim()
    if (line.startsWith('FN:')) out.name = line.slice(3).trim()
    else if (line.startsWith('TEL') && line.includes(':')) {
      // TEL;TYPE=CELL;waid=553389127816:+55 33 8912-7816
      const value = line.split(':').slice(1).join(':').trim()
      // Tenta extrair waid antes; senão pega o valor depois do ":"
      const waidMatch = line.match(/waid=(\d+)/i)
      out.phone = waidMatch ? waidMatch[1] : value
    }
  }
  return out
}

function extractContacts(payload: any): ParsedContact[] {
  const out: ParsedContact[] = []

  const candidates: any[] = []
  if (payload?.contactMessage) candidates.push(payload.contactMessage)
  if (Array.isArray(payload?.contactsArrayMessage?.contacts)) {
    candidates.push(...payload.contactsArrayMessage.contacts)
  }
  // Formato Evolution direto: { displayName, vcard }
  if (payload?.displayName || payload?.vcard) candidates.push(payload)
  // Formato WhatsApp Cloud API: { name, phones }
  if (payload?.name && (payload?.phones || payload?.wa_id)) candidates.push(payload)
  // Array direto
  if (Array.isArray(payload)) candidates.push(...payload)

  for (const c of candidates) {
    if (!c) continue
    // Evolution / Baileys
    if (c.vcard) {
      const vc = parseVCard(c.vcard)
      out.push({ name: c.displayName || vc.name || 'Contato', phone: vc.phone })
      continue
    }
    // WhatsApp Cloud API
    if (c.name) {
      const name =
        c.name?.formatted_name ||
        [c.name?.first_name, c.name?.last_name].filter(Boolean).join(' ') ||
        c.displayName ||
        'Contato'
      const phones = c.phones || []
      const phone = phones[0]?.phone || phones[0]?.wa_id || c.wa_id
      out.push({ name, phone })
      continue
    }
  }

  return out
}

function fromPayload(payload: any, senderName: string | undefined, rawStr: string): ParsedMessage {
  if (!payload || typeof payload !== 'object') {
    return { kind: 'unknown', raw: rawStr, senderName }
  }

  // Reaction
  for (const k of REACTION_KEYS) {
    if (payload[k]) {
      return {
        kind: 'reaction',
        emoji: String(payload[k].text || ''),
        targetMessageId: payload[k].key?.id,
        senderName,
      }
    }
  }

  // Contact
  for (const k of CONTACT_KEYS) {
    if (payload[k]) {
      const contacts = extractContacts(payload[k])
      return { kind: 'contact', contacts, senderName }
    }
  }
  // Contato direto (sem chave contactMessage)
  if (payload.vcard || payload.displayName || (payload.name && (payload.phones || payload.wa_id))) {
    const contacts = extractContacts(payload)
    if (contacts.length > 0) return { kind: 'contact', contacts, senderName }
  }

  // Location
  for (const k of LOCATION_KEYS) {
    if (payload[k]) {
      return {
        kind: 'location',
        latitude: payload[k].degreesLatitude,
        longitude: payload[k].degreesLongitude,
        name: payload[k].name,
        address: payload[k].address,
        isLive: k === 'liveLocationMessage',
        senderName,
      }
    }
  }

  // Poll
  for (const k of POLL_KEYS) {
    if (payload[k]) {
      const opts = Array.isArray(payload[k].options)
        ? payload[k].options.map((o: any) => o?.optionName || String(o)).filter(Boolean)
        : []
      return {
        kind: 'poll',
        question: payload[k].name || payload[k].question || 'Enquete',
        options: opts,
        senderName,
      }
    }
  }

  // Sticker
  for (const k of STICKER_KEYS) {
    if (payload[k]) return { kind: 'sticker', senderName }
  }

  // Ephemeral / view-once — desembrulha e tenta de novo
  for (const k of EPHEMERAL_KEYS) {
    if (payload[k]?.message) {
      const inner = fromPayload(payload[k].message, senderName, rawStr)
      return { kind: 'ephemeral', inner, senderName }
    }
  }

  // Protocol (eventos do sistema — editar, deletar, ack)
  for (const k of PROTOCOL_KEYS) {
    if (payload[k]) {
      let action: string | undefined
      if (k === 'editedMessage') action = 'edit'
      else if (payload[k].type !== undefined) action = `protocol:${payload[k].type}`
      else action = k
      return { kind: 'protocol', action, senderName }
    }
  }

  // Texto puro embrulhado
  if (typeof payload.conversation === 'string') return { kind: 'text', text: payload.conversation }
  if (typeof payload.extendedTextMessage?.text === 'string') {
    return { kind: 'text', text: payload.extendedTextMessage.text }
  }
  if (typeof payload.text === 'string') return { kind: 'text', text: payload.text }

  // Fallback: pega a primeira chave conhecida só pra logar
  const rawType = Object.keys(payload).find((k) => k !== 'messageContextInfo' && k !== 'key')
  return { kind: 'unknown', rawType, raw: rawStr, senderName }
}

/**
 * Parse principal — recebe o conteúdo cru e devolve a representação tipada.
 * Se não detectar payload Baileys, devolve `{ kind: 'text', text }` original.
 */
export function parseMessageContent(conteudo: string | null | undefined): ParsedMessage {
  const text = (conteudo ?? '').toString()
  if (!text) return { kind: 'text', text: '' }

  const detected = detectBaileysPayload(text)
  if (!detected) return { kind: 'text', text }

  try {
    const payload = JSON.parse(detected.jsonStr)
    return fromPayload(payload, detected.senderName, text)
  } catch {
    // Não conseguiu parsear — mantém como texto normal
    return { kind: 'text', text }
  }
}

/** Label legível por tipo, pra placeholders */
export function labelForKind(kind: ParsedMessage['kind']): string {
  switch (kind) {
    case 'reaction': return 'Reação'
    case 'contact': return 'Contato compartilhado'
    case 'location': return 'Localização compartilhada'
    case 'poll': return 'Enquete'
    case 'sticker': return 'Figurinha'
    case 'ephemeral': return 'Mensagem efêmera'
    case 'protocol': return 'Evento do sistema'
    case 'unknown': return 'Mensagem não suportada'
    case 'text': return 'Texto'
  }
}
