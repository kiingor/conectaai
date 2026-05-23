'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  User,
  Copy,
  Check,
  Heart,
  MapPin,
  BarChart3,
  Sparkles,
  Hourglass,
  Settings as SettingsIcon,
  AlertCircle,
} from 'lucide-react'
import { parseMessageContent, labelForKind, type ParsedMessage } from '@/lib/whatsapp-message-parser'

interface Props {
  conteudo: string | null | undefined
  isOutgoing: boolean
}

/**
 * Renderiza conteúdos especiais (reação, contato, localização, enquete, etc.)
 * detectados a partir de payloads Baileys/Evolution serializados no `conteudo`.
 *
 * - Retorna `null` se for texto puro → o pai mantém a renderização padrão.
 * - Retorna `null` se nada útil puder ser extraído (ex.: protocolMessage interno
 *   sem ação relevante pro atendente).
 *
 * Reusado por Workdesk e Dashboard.
 */
export function SpecialMessageContent({ conteudo, isOutgoing }: Props) {
  const parsed = parseMessageContent(conteudo)

  if (parsed.kind === 'text') return null

  // Protocol messages internos (edição de mensagem ainda não suportada, etc.)
  // não agregam contexto pro atendente → escondemos.
  if (parsed.kind === 'protocol') return null

  if (parsed.kind === 'reaction') return <ReactionContent parsed={parsed} isOutgoing={isOutgoing} />
  if (parsed.kind === 'contact') return <ContactContent parsed={parsed} isOutgoing={isOutgoing} />
  if (parsed.kind === 'location') return <PlaceholderContent icon={<MapPin className="h-3.5 w-3.5" />} label={placeholderLabel(parsed)} isOutgoing={isOutgoing} />
  if (parsed.kind === 'poll') return <PlaceholderContent icon={<BarChart3 className="h-3.5 w-3.5" />} label={placeholderLabel(parsed)} isOutgoing={isOutgoing} />
  if (parsed.kind === 'sticker') return <PlaceholderContent icon={<Sparkles className="h-3.5 w-3.5" />} label={labelForKind('sticker')} isOutgoing={isOutgoing} />
  if (parsed.kind === 'ephemeral') return <PlaceholderContent icon={<Hourglass className="h-3.5 w-3.5" />} label={labelForKind('ephemeral')} isOutgoing={isOutgoing} />
  if (parsed.kind === 'unknown') return <PlaceholderContent icon={<AlertCircle className="h-3.5 w-3.5" />} label={labelForKind('unknown')} isOutgoing={isOutgoing} />

  return null
}

function placeholderLabel(parsed: Extract<ParsedMessage, { kind: 'location' | 'poll' }>): string {
  if (parsed.kind === 'location') {
    if (parsed.name) return `📍 ${parsed.name}`
    if (parsed.address) return `📍 ${parsed.address}`
    return parsed.isLive ? 'Localização ao vivo' : 'Localização compartilhada'
  }
  // kind === 'poll'
  return `Enquete: ${parsed.question}`
}

// ─── Reaction ────────────────────────────────────────────────────────────────
function ReactionContent({
  parsed,
  isOutgoing,
}: {
  parsed: Extract<ParsedMessage, { kind: 'reaction' }>
  isOutgoing: boolean
}) {
  const emoji = parsed.emoji || '❤️'
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs',
        isOutgoing
          ? 'bg-white/15 text-white/90'
          : 'bg-foreground/[0.06] text-foreground/80'
      )}
    >
      <Heart className={cn('h-3 w-3', isOutgoing ? 'text-white/70' : 'text-rose-400')} />
      <span className="text-base leading-none">{emoji}</span>
      <span className="opacity-80">
        {parsed.senderName ? `${parsed.senderName} reagiu` : 'Reagiu'}
      </span>
    </div>
  )
}

// ─── Contact ─────────────────────────────────────────────────────────────────
function ContactContent({
  parsed,
  isOutgoing,
}: {
  parsed: Extract<ParsedMessage, { kind: 'contact' }>
  isOutgoing: boolean
}) {
  if (parsed.contacts.length === 0) {
    return <PlaceholderContent icon={<User className="h-3.5 w-3.5" />} label="Contato compartilhado" isOutgoing={isOutgoing} />
  }
  return (
    <div className="space-y-2">
      {parsed.contacts.map((c, idx) => (
        <ContactRow key={idx} name={c.name} phone={c.phone || ''} isOutgoing={isOutgoing} />
      ))}
    </div>
  )
}

function ContactRow({ name, phone, isOutgoing }: { name: string; phone: string; isOutgoing: boolean }) {
  const [copied, setCopied] = useState(false)
  const formattedPhone = phone ? (phone.startsWith('+') ? phone : `+${phone}`) : ''

  const copyToClipboard = (text: string) => {
    if (!text) return
    const fallback = () => {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(fallback)
    } else {
      fallback()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl p-3 border',
        isOutgoing
          ? 'bg-white/15 border-white/20'
          : 'bg-foreground/[0.04] border-foreground/8'
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          isOutgoing ? 'bg-white/20' : 'bg-emerald-500/10'
        )}
      >
        <User className={cn('h-5 w-5', isOutgoing ? 'text-white' : 'text-emerald-400')} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold truncate', isOutgoing ? 'text-white' : 'text-foreground/90')}>
          {name || 'Contato'}
        </p>
        {formattedPhone && (
          <p className={cn('text-xs truncate', isOutgoing ? 'text-foreground/70' : 'text-muted-foreground/80')}>
            {formattedPhone}
          </p>
        )}
      </div>
      {formattedPhone && (
        <button
          onClick={() => copyToClipboard(formattedPhone.replace(/\s/g, ''))}
          className={cn(
            'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all shrink-0',
            isOutgoing
              ? 'bg-white/20 hover:bg-foreground/30 text-white'
              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
          )}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
      )}
    </div>
  )
}

// ─── Placeholder genérico (location, poll, sticker, ephemeral, unknown) ─────
function PlaceholderContent({
  icon,
  label,
  isOutgoing,
}: {
  icon: React.ReactNode
  label: string
  isOutgoing: boolean
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs italic',
        isOutgoing
          ? 'bg-white/10 text-white/85'
          : 'bg-foreground/[0.04] text-foreground/70'
      )}
    >
      {icon}
      <span>{label}</span>
    </div>
  )
}

/**
 * Helper drop-in: substitui `<p>{msg.conteudo}</p>` em qualquer chat.
 * - Se o `conteudo` for payload Baileys → delega pro SpecialMessageContent
 * - Caso contrário renderiza texto puro com a `className` informada
 */
export function MessageBody({
  conteudo,
  isOutgoing,
  className = 'text-sm whitespace-pre-wrap break-words',
}: {
  conteudo: string | null | undefined
  isOutgoing: boolean
  className?: string
}) {
  const parsed = parseMessageContent(conteudo)
  if (parsed.kind !== 'text' && parsed.kind !== 'protocol') {
    return <SpecialMessageContent conteudo={conteudo} isOutgoing={isOutgoing} />
  }
  if (!conteudo) return null
  return <p className={className}>{conteudo}</p>
}

export default SpecialMessageContent
