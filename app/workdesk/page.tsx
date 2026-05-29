'use client'

import React from "react"

import { useEffect, useState, useCallback, useRef, useMemo, startTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { parseMessageContent } from '@/lib/whatsapp-message-parser'
import { SpecialMessageContent } from '@/components/chat/special-message-content'
import {
  MessageCircle,
  Clock,
  AlertTriangle,
  CheckCircle,
  X,
  Filter,
  Search,
  Send,
  ImageIcon,
  Mic,
  FileText,
  Video,
  Menu,
  User,
  Check,
  CheckCheck,
  ArrowRightLeft,
  XCircle,
  Smile,
  Phone,
  Loader2,
  History,
  PanelRightOpen,
  PanelRightClose,
  PanelLeft,
  Copy,
  Megaphone,
  Lock,
  Timer,
  ChevronRight,
  ChevronLeft,
  Zap,
  Hash,
  Download,
  Music,
  Play,
  FileIcon,
  Layers,
  ChevronDown,
  FileArchive,
  FileCode,
  FileSpreadsheet,
  ShieldCheck,
  Pencil,
  Save,
  Info,
  UserCircle,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { useAudioAlert } from '@/hooks/use-audio-alert'

interface Cliente {
  id: string
  nome: string
  telefone: string | null
  email: string | null
  documento?: string | null
  CNPJ?: string | null
  Registro?: string | null
  PDV?: string | null
  created_at?: string
}

interface Setor {
  id: string
  nome: string
  cor: string | null
  canal?: string
  tempo_espera_minutos?: number
  }
  
interface Subsetor {
  id: string
  nome: string
  setor_id?: string
}

interface Ticket {
  id: string
  numero: number
  cliente_id: string
  colaborador_id: string | null
  setor_id: string
  subsetor_id: string | null
  organizacao_id: string | null
  status: 'aberto' | 'em_atendimento' | 'encerrado'
  prioridade: 'normal' | 'urgente'
  canal: string
  primeira_resposta_em: string | null
  criado_em: string
  encerrado_em: string | null
  clientes: Cliente
  setores?: Setor
  subsetores?: Subsetor
  ultima_mensagem?: string
  ultima_mensagem_em?: string
  ultima_mensagem_remetente?: 'cliente' | 'colaborador' | 'bot'
  mensagens_nao_lidas?: number
  is_disparo?: boolean
  disparo_em?: string | null
}

interface Mensagem {
  id: string
  ticket_id: string | null
  cliente_id: string | null
  remetente: 'cliente' | 'colaborador' | 'bot' | 'sistema'
  conteudo: string
  tipo: 'texto' | 'imagem' | 'audio' | 'video' | 'documento'
  enviado_em: string
  phone_number_id?: string
  whatsapp_message_id?: string
  url_imagem?: string | null
  media_type?: string | null
  // For history display
  tickets?: {
    id: string
    status: string
    criado_em: string
    encerrado_em: string | null
  }
}

// Helper to check if message is from the support side (colaborador or bot)
const isOutgoingMessage = (remetente: string) => {
  const r = remetente?.toLowerCase?.()?.trim?.() || ''
  return r === 'colaborador' || r === 'bot'
}

interface ColaboradorSetor {
  setor_id: string
  setores: Setor
}

interface Colaborador {
  id: string
  nome: string
  email: string
  setor_id: string | null
  permissao_id: string | null
  is_online: boolean
  organizacao_id: string | null
  permissoes?: {
    can_see_all_tickets: boolean
  }
  setores_vinculados?: ColaboradorSetor[]
}

// Format phone number
const formatPhone = (phone: string) => {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 13) {
    // Format: +55 (83) 99999-9999
    return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`
  }
  if (cleaned.length === 11) {
    // Format: (83) 99999-9999
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`
  }
  return phone
}

// Format CNPJ
const formatCNPJ = (cnpj: string) => {
  const cleaned = cnpj.replace(/\D/g, '')
  if (cleaned.length === 14) {
    return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12)}`
  }
  return cnpj
}

// ─── ContactCard Component ────────────────────────────────────────────────────
// Renderiza contato compartilhado via WhatsApp (media_type === 'contact')
// Suporta 2 formatos:
//   1) API oficial (array): [{"name":{"formatted_name":"X"},"phones":[{"phone":"+55..."}]}]
//   2) Evolution (vcard):   {"displayName":"X","vcard":"BEGIN:VCARD\n...END:VCARD"}

// Extrai nome e telefone de um vCard string
function parseVCard(vcard: string): { name: string; phone: string } {
  const fnMatch = vcard.match(/FN[;:](.+)/i)
  const name = fnMatch ? fnMatch[1].trim() : 'Sem nome'
  // TEL com waid: "+55 85 8184-0618" ou TEL:+5585...
  const telMatch = vcard.match(/TEL[^:]*:([^\n]+)/i)
  const phone = telMatch ? telMatch[1].trim() : ''
  return { name, phone }
}

function ContactCard({ conteudo, isOutgoing }: { conteudo: string; isOutgoing: boolean }) {
  const [copied, setCopied] = React.useState(false)

  // Normaliza para lista de { name, phone }
  let contactList: { name: string; phone: string }[] = []
  try {
    const parsed = JSON.parse(conteudo)
    const items = Array.isArray(parsed) ? parsed : [parsed]
    for (const item of items) {
      if (item.vcard) {
        // Formato Evolution: { displayName, vcard }
        const vc = parseVCard(item.vcard)
        contactList.push({
          name: item.displayName || vc.name,
          phone: vc.phone,
        })
      } else if (item.name) {
        // Formato API oficial: { name: { formatted_name }, phones: [{ phone }] }
        const name = item.name?.formatted_name || item.name?.first_name || 'Sem nome'
        const phones = item.phones || []
        const firstPhone = phones[0]?.phone || phones[0]?.wa_id || ''
        contactList.push({ name, phone: firstPhone })
      }
    }
  } catch {
    return <p className="text-sm whitespace-pre-wrap">{conteudo}</p>
  }

  if (contactList.length === 0) return null

  return (
    <div className="space-y-2">
      {contactList.map((contact, idx) => {
        const formattedPhone = contact.phone.startsWith('+') ? contact.phone : `+${contact.phone}`

        return (
          <div
            key={idx}
            className={cn(
              'flex items-center gap-3 rounded-xl p-3 border',
              isOutgoing
                ? 'bg-white/15 border-white/20'
                : 'bg-foreground/[0.04] border-foreground/8'
            )}
          >
            <div className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              isOutgoing ? 'bg-white/20' : 'bg-emerald-500/10'
            )}>
              <User className={cn('h-5 w-5', isOutgoing ? 'text-white' : 'text-emerald-400')} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm font-semibold truncate', isOutgoing ? 'text-white' : 'text-foreground/90')}>
                {contact.name}
              </p>
              <p className={cn('text-xs truncate', isOutgoing ? 'text-foreground/70' : 'text-muted-foreground/80')}>
                {formattedPhone}
              </p>
            </div>
            <button
              onClick={() => {
                const text = formattedPhone.replace(/\s/g, '')
                if (navigator.clipboard?.writeText) {
                  navigator.clipboard.writeText(text).catch(() => {
                    // Fallback: textarea oculto
                    const ta = document.createElement('textarea')
                    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
                    document.body.appendChild(ta); ta.select(); document.execCommand('copy')
                    document.body.removeChild(ta)
                  })
                } else {
                  const ta = document.createElement('textarea')
                  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
                  document.body.appendChild(ta); ta.select(); document.execCommand('copy')
                  document.body.removeChild(ta)
                }
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
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
          </div>
        )
      })}
    </div>
  )
}

// ─── MessageMedia Component ───────────────────────────────────────────────────
// Renderiza mídia de mensagem baseado no media_type (MIME) com fallback no tipo
interface MessageMediaProps {
  url: string
  mediaType?: string | null
  tipo?: string
  conteudo?: string
  isOutgoing: boolean
}

// Retorna ícone, label e cores para cada tipo de arquivo
function getFileInfo(ext: string, mediaType?: string | null) {
  const e = ext.toLowerCase()
  if (e === 'pdf' || mediaType === 'application/pdf')
    return { icon: FileText, label: 'PDF', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' }
  if (['doc', 'docx'].includes(e) || mediaType?.includes('word'))
    return { icon: FileText, label: 'Word', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' }
  if (['xls', 'xlsx', 'csv'].includes(e) || mediaType?.includes('spreadsheet') || mediaType?.includes('excel'))
    return { icon: FileSpreadsheet, label: 'Planilha', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e))
    return { icon: FileArchive, label: e.toUpperCase(), color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' }
  if (['xml', 'json', 'html', 'htm', 'css', 'js', 'ts', 'txt', 'csv'].includes(e) || mediaType?.startsWith('text/'))
    return { icon: FileCode, label: e.toUpperCase() || 'Texto', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' }
  if (['cer', 'crt', 'pem', 'p12', 'pfx', 'key'].includes(e))
    return { icon: ShieldCheck, label: 'Certificado', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' }
  return { icon: FileIcon, label: e.toUpperCase() || 'Arquivo', color: 'text-muted-foreground/80', bg: 'bg-foreground/[0.03]', border: 'border-foreground/8' }
}

function MessageMedia({ url, mediaType, tipo, conteudo, isOutgoing }: MessageMediaProps) {
  const urlLower = url.toLowerCase().split('?')[0]
  const ext = urlLower.split('.').pop() || ''

  // Determina o tipo real pela ordem: media_type MIME > tipo do banco > extensão da URL
  const isImage = mediaType?.startsWith('image/') || (tipo === 'imagem' && !mediaType)
    || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)
  const isVideo = mediaType?.startsWith('video/') || tipo === 'video'
    || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)
  const isAudio = mediaType?.startsWith('audio/') || tipo === 'audio'
    || ['mp3', 'ogg', 'wav', 'aac', 'm4a', 'opus'].includes(ext)

  const fileName = conteudo || url.split('/').pop()?.split('?')[0] || 'arquivo'

  if (isVideo) {
    return (
      <div className="mb-2 space-y-1.5">
        <video
          controls
          className="max-w-full rounded-lg max-h-64 w-full bg-black"
          preload="metadata"
        >
          <source src={url} type={mediaType || 'video/mp4'} />
          Seu navegador não suporta vídeo.
        </video>
        <a
          href={url}
          download={fileName}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'inline-flex items-center gap-1.5 text-[11px] rounded-md px-2 py-1 transition-colors',
            isOutgoing
              ? 'bg-white/20 hover:bg-foreground/30 text-white'
              : 'bg-foreground/5 hover:bg-foreground/8 text-foreground/70'
          )}
        >
          <Download className="h-3 w-3" />
          Baixar vídeo
        </a>
      </div>
    )
  }

  if (isAudio) {
    return (
      <div className={cn(
        'mb-2 flex items-center gap-2 rounded-xl px-3 py-2',
        isOutgoing ? 'bg-white/15' : 'bg-foreground/[0.04]'
      )}>
        <Music className="h-4 w-4 shrink-0 opacity-70" />
        <audio controls className="flex-1 h-8 min-w-0" preload="metadata" style={{ height: '32px' }}>
          <source src={url} type={mediaType || 'audio/ogg'} />
        </audio>
        <a
          href={url}
          download={fileName}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'shrink-0 rounded p-1 transition-colors',
            isOutgoing ? 'hover:bg-white/20 text-white' : 'hover:bg-foreground/8 text-foreground/60'
          )}
          title="Baixar áudio"
        >
          <Download className="h-3.5 w-3.5" />
        </a>
      </div>
    )
  }

  if (isImage) {
    return (
      <div className="mb-2">
        <img
          src={url}
          alt="Imagem"
          className="max-w-full rounded-lg max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => window.open(url, '_blank')}
        />
      </div>
    )
  }

  // Qualquer outro arquivo com URL → card de download
  const { icon: Icon, label, color, bg, border } = getFileInfo(ext, mediaType)
  return (
    <a
      href={url}
      download={fileName}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'mb-2 flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors hover:opacity-80',
        bg, border
      )}
    >
      <Icon className={cn('h-6 w-6 shrink-0', color)} />
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm font-medium text-foreground/80 truncate">{fileName}</span>
        <span className="text-[10px] text-muted-foreground/80">{label} · Clique para baixar</span>
      </div>
      <Download className="h-4 w-4 text-muted-foreground/80 shrink-0" />
    </a>
  )
}
// ──────────────────────────────────────────────────────────────────────────────

// Disparo Timer Component
function renderTextWithLinks(text: string, isOutgoing: boolean) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g)
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'underline break-all hover:opacity-80',
          isOutgoing ? 'text-white' : 'text-cyan-400'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {part}
      </a>
    ) : (
      part
    )
  )
}

function DisparoTimer({ dispatchTime }: { dispatchTime: string }) {
  const [timeLeft, setTimeLeft] = React.useState<string>('')

  React.useEffect(() => {
    const updateTimer = () => {
      const dispatchDate = new Date(dispatchTime).getTime()
      const now = Date.now()
      const twelveMin = 12 * 60 * 1000
      const elapsed = now - dispatchDate
      const remaining = twelveMin - elapsed

      if (remaining <= 0) {
        setTimeLeft('Desbloqueado')
      } else {
        const minutes = Math.floor(remaining / 60000)
        const seconds = Math.floor((remaining % 60000) / 1000)
        setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`)
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [dispatchTime])

  return (
    <div className="flex items-center gap-2 mt-2 text-xs text-blue-400">
      <Timer className="h-3 w-3" />
      <span>Tempo para encerrar: {timeLeft}</span>
    </div>
  )
}

export default function WorkdeskPage() {
  const supabase = useMemo(() => createClient(), [])
  const { playAlert, initAudioContext } = useAudioAlert()

  const [colaborador, setColaborador] = useState<Colaborador | null>(null)
  // Always-current ref so intervals/closures read the latest colaborador
  const colaboradorCurrentRef = useRef<Colaborador | null>(null)
  useEffect(() => { colaboradorCurrentRef.current = colaborador }, [colaborador])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const selectedTicketIdRef = useRef<string | null>(null)
  const previousTicketIdsRef = useRef<Set<string>>(new Set())
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMensagens, setLoadingMensagens] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false) // Declared sendingMessage variable
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const [prioridadeFilter, setPrioridadeFilter] = useState<string>('todos')
  const [subsetorFilter, setSubsetorFilter] = useState<string>('todos')
  const [searchTerm, setSearchTerm] = useState('')
  const [subsetoresDisponiveis, setSubsetoresDisponiveis] = useState<Subsetor[]>([])
  
  // Mobile
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  
  // Dialog
  const [encerrarDialogOpen, setEncerrarDialogOpen] = useState(false)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showClientPanel, setShowClientPanel] = useState(true)
  
  // Transfer data
  const [setores, setSetores] = useState<any[]>([])
  const [atendentesDisponiveis, setAtendentesDisponiveis] = useState<any[]>([])
  const [selectedSetorTransfer, setSelectedSetorTransfer] = useState<string>('all') // Updated default value
  const [selectedAtendenteTransfer, setSelectedAtendenteTransfer] = useState<string>('all') // Updated default value
  const [transferLoading, setTransferLoading] = useState(false)
  const [transferDataLoading, setTransferDataLoading] = useState(false)
  const transferringTicketIdsRef = useRef<Set<string>>(new Set())

  // Helper: verifica se atendente está online (confia no is_online do banco)
  const isAtendenteOnline = useCallback((atendente: any): boolean => {
    return !!(atendente?.is_online && atendente?.ativo)
  }, [])
  
  // Message input
  const [messageInput, setMessageInput] = useState('')
  const [pendingMessages, setPendingMessages] = useState<Map<string, 'sending' | 'sent' | 'error'>>(new Map())
  
  // File upload (images and PDFs)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  
  // Templates
  const [templates, setTemplates] = useState<any[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [filteredTemplates, setFilteredTemplates] = useState<any[]>([])
  
  // 24h window check
  const [isWindowExpired, setIsWindowExpired] = useState(false)
  const [lastMessageTime, setLastMessageTime] = useState<Date | null>(null)
  
  // Disparo state
  const [disparoDialogOpen, setDisparoDialogOpen] = useState(false)
  const [disparoCnpj, setDisparoCnpj] = useState('')
  const [disparoTelefone, setDisparoTelefone] = useState('')
  const [disparoCliente, setDisparoCliente] = useState<any>(null)
  const [disparoLoading, setDisparoLoading] = useState(false)
  const [disparoSending, setDisparoSending] = useState(false)
  const [disparoStep, setDisparoStep] = useState<'cnpj' | 'telefone' | 'telefone_lookup' | 'mensagem_evolution'>('cnpj')
  const [disparoLimitBlocked, setDisparoLimitBlocked] = useState(false)
  const [disparoLimitInfo, setDisparoLimitInfo] = useState('')
  const [disparoCanalChoice, setDisparoCanalChoice] = useState<'whatsapp' | 'evolution_api'>('whatsapp')
  const [disparoMensagemEvolution, setDisparoMensagemEvolution] = useState('')
  const [disparoNomeManual, setDisparoNomeManual] = useState('')
  const [disparoTelefoneNaoEncontrado, setDisparoTelefoneNaoEncontrado] = useState(false)
  const [setorCanalConfig, setSetorCanalConfig] = useState<'whatsapp' | 'evolution_api'>('whatsapp')
  const [setorCanaisAtivos, setSetorCanaisAtivos] = useState<string[]>([])
  const [novoDisparoEnabled, setNovoDisparoEnabled] = useState(true)
  
  // Unread messages tracking
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map())

  // Selecionar cliente dialog
  const [selecionarClienteDialogOpen, setSelecionarClienteDialogOpen] = useState(false)
  const [selecionarClienteCnpj, setSelecionarClienteCnpj] = useState('')
  const [selecionarClienteData, setSelecionarClienteData] = useState<any>(null)
  const [selecionarClienteLoading, setSelecionarClienteLoading] = useState(false)
  const [clienteNaoInformadoDialogOpen, setClienteNaoInformadoDialogOpen] = useState(false)

  // Editar dados do cliente
  const [editarClienteDialogOpen, setEditarClienteDialogOpen] = useState(false)
  const [editarClienteForm, setEditarClienteForm] = useState({ nome: '', telefone: '', CNPJ: '', Registro: '', email: '' })
  const [editarClienteLoading, setEditarClienteLoading] = useState(false)

  // Meus subsetores ativos (seleção do próprio atendente)
  const [meusSubsetorIds, setMeusSubsetorIds] = useState<string[]>([])
  const [subsetorPickerOpen, setSubsetorPickerOpen] = useState(false)
  const [togglingSubsetor, setTogglingSubsetor] = useState(false)

  // Fetch colaborador atual
  const fetchColaborador = useCallback(async () => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      // If session is invalid, redirect to login
      if (authError || !user) {
        // Clear any stale session and redirect
        await supabase.auth.signOut()
        window.location.href = '/login'
        return null
      }

      const { data: colab } = await supabase
        .from('colaboradores')
        .select(
          '*, permissoes(can_see_all_tickets), setores_vinculados:colaboradores_setores(setor_id, setores(id, nome, cor))'
        )
        .eq('email', user.email)
        .single()

  if (colab) {
  setColaborador(colab)
  // Salvar info do colaborador para o error logger
  try { localStorage.setItem('colaborador_info', JSON.stringify({ id: colab.id, nome: colab.nome })) } catch {}
  // Fetch setor canal config
  const sId = colab.setor_id || colab.setores_vinculados?.[0]?.setor_id
  // Fetch workdesk config flags do setor (ex: Novo Disparo enabled)
  try {
    const cfgUrl = sId ? `/api/organizacao/workdesk-config?setorId=${sId}` : '/api/organizacao/workdesk-config'
    const cfgRes = await fetch(cfgUrl)
    if (cfgRes.ok) {
      const cfg = await cfgRes.json()
      setNovoDisparoEnabled(cfg.workdesk_novo_disparo_enabled ?? true)
    }
  } catch {}
  if (sId) {
    const { data: setorInfo } = await supabase.from('setores').select('canal, workdesk_novo_disparo_enabled').eq('id', sId).single()
    if (setorInfo?.canal) setSetorCanalConfig(setorInfo.canal)
    if (setorInfo && typeof setorInfo.workdesk_novo_disparo_enabled === 'boolean') {
      setNovoDisparoEnabled(setorInfo.workdesk_novo_disparo_enabled)
    }
    // Fetch active channels for this setor (for disparo multi-canal)
    const { data: canaisAtivos } = await supabase
      .from('setor_canais')
      .select('tipo')
      .eq('setor_id', sId)
      .eq('ativo', true)
    if (canaisAtivos && canaisAtivos.length > 0) {
      setSetorCanaisAtivos(canaisAtivos.map((c: any) => c.tipo))
    }
  }
  return colab
  }
      return null
    } catch (error) {
      console.error('Error fetching colaborador:', error)
      // On any auth error, redirect to login
      window.location.href = '/login'
      return null
    }
  }, [supabase])

// Fetch tickets - colaborador only sees tickets assigned to them
  const fetchTickets = useCallback(async (colab: Colaborador) => {
    let query = supabase
      .from('tickets')
      .select('*, numero, clientes(*), setores(id, nome, cor, canal, tempo_espera_minutos)')
      .in('status', ['aberto', 'em_atendimento'])
      .order('criado_em', { ascending: false })

    // ALWAYS filter by colaborador_id - each atendente only sees their own tickets
    // Even users with can_see_all_tickets should use the dashboard for viewing all
    query = query.eq('colaborador_id', colab.id)

    const { data } = await query

    if (data) {
      // Filter out tickets that are currently being transferred
      const filteredData = data.filter((t) => !transferringTicketIdsRef.current.has(t.id))
      // Fetch last message for each ticket
      const ticketsWithMessages = await Promise.all(
        filteredData.map(async (ticket) => {
          const { data: lastMsg } = await supabase
            .from('mensagens')
            .select('conteudo, enviado_em, remetente')
            .eq('ticket_id', ticket.id)
            .order('enviado_em', { ascending: false })
            .limit(1)
            .single()

          return {
            ...ticket,
            ultima_mensagem: lastMsg?.conteudo || 'Sem mensagens',
            ultima_mensagem_em: lastMsg?.enviado_em || ticket.criado_em,
            ultima_mensagem_remetente: lastMsg?.remetente || null,
          }
        })
      )
      // Sort by ultima_mensagem_em descending (most recent first, like WhatsApp)
      const sortedTickets = ticketsWithMessages.sort((a, b) => 
        new Date(b.ultima_mensagem_em || b.criado_em).getTime() - 
        new Date(a.ultima_mensagem_em || a.criado_em).getTime()
      )
      setTickets(sortedTickets)

      // Keep selectedTicket data in sync without losing focus
      // Mas NÃO sobrescreve se acabamos de trocar o cliente (clienteSwapTicketIdRef)
      if (selectedTicketIdRef.current) {
        const updatedSelected = sortedTickets.find((t) => t.id === selectedTicketIdRef.current)
        if (updatedSelected) {
          if (clienteSwapTicketIdRef.current === updatedSelected.id) {
            // Preserva os dados do cliente que acabamos de trocar manualmente
            setSelectedTicket((prev) => prev ? {
              ...updatedSelected,
              cliente_id: prev.cliente_id,
              clientes: prev.clientes,
            } : updatedSelected)
            // Também preserva na lista
            setTickets((prev) => prev.map((t) =>
              t.id === updatedSelected.id
                ? { ...updatedSelected, cliente_id: t.cliente_id, clientes: t.clientes }
                : t
            ))
          } else {
            setSelectedTicket(updatedSelected)
          }
        }
      }
    }
  }, [supabase])

  // Subsetores desativados por enquanto
  const fetchSubsetoresDisponiveis = useCallback(async (_colab: Colaborador) => {
    setSubsetoresDisponiveis([])
  }, [])

  const fetchMeusSubsetores = useCallback(async (_colab: Colaborador) => {
    setMeusSubsetorIds([])
  }, [])

// Fetch messages for selected ticket (including client history from last 7 days)
  const fetchMensagens = useCallback(
    async (ticketId: string, clienteId: string, options?: { silent?: boolean }) => {
      if (!options?.silent) setLoadingMensagens(true)

      // Calculate date 30 days ago
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 30)

      // Resolve all cliente_ids with the same phone number (handles duplicate records)
      let allClienteIds = [clienteId]
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('telefone')
        .eq('id', clienteId)
        .single()

      if (clienteData?.telefone) {
        const { data: allClientes } = await supabase
          .from('clientes')
          .select('id')
          .eq('telefone', clienteData.telefone)

        if (allClientes && allClientes.length > 0) {
          allClienteIds = [...new Set(allClientes.map(c => c.id))]
        }
      }

      // Query 1: All messages from current ticket (always reliable)
      const { data: ticketMsgs, error: err1 } = await supabase
        .from('mensagens')
        .select('*, tickets(id, status, criado_em, encerrado_em)')
        .eq('ticket_id', ticketId)
        .order('enviado_em', { ascending: true, nullsFirst: false })

      // Query 2: Messages from OTHER tickets of the same client (last 7 days)
      const { data: otherTicketMsgs, error: err2 } = await supabase
        .from('mensagens')
        .select('*, tickets(id, status, criado_em, encerrado_em)')
        .in('cliente_id', allClienteIds)
        .neq('ticket_id', ticketId)
        .not('ticket_id', 'is', null)
        .gte('enviado_em', sevenDaysAgo.toISOString())
        .order('enviado_em', { ascending: true, nullsFirst: false })

      // Query 3: Orphan messages (ticket_id IS NULL) — bot conversations before ticket creation
      const { data: orphanMsgs, error: err3 } = await supabase
        .from('mensagens')
        .select('*')
        .in('cliente_id', allClienteIds)
        .is('ticket_id', null)
        .gte('enviado_em', sevenDaysAgo.toISOString())
        .order('enviado_em', { ascending: true, nullsFirst: false })

      console.log('[fetchMensagens] Q1 ticketMsgs:', ticketMsgs?.length, err1 ? `ERR: ${JSON.stringify(err1)}` : 'OK')
      console.log('[fetchMensagens] Q2 otherTicketMsgs:', otherTicketMsgs?.length, err2 ? `ERR: ${JSON.stringify(err2)}` : 'OK')
      console.log('[fetchMensagens] Q3 orphanMsgs:', orphanMsgs?.length, err3 ? `ERR: ${JSON.stringify(err3)}` : 'OK')
      console.log('[fetchMensagens] allClienteIds:', allClienteIds)

      // Merge all 3 queries, deduplicate by id, and sort chronologically
      const allMsgs = [...(ticketMsgs || []), ...(otherTicketMsgs || []), ...(orphanMsgs || [])]
      const seen = new Set<string>()
      const merged = allMsgs.filter(m => {
        if (seen.has(m.id)) return false
        seen.add(m.id)
        return true
      })
      merged.sort((a, b) => {
        if (!a.enviado_em) return -1
        if (!b.enviado_em) return 1
        return new Date(a.enviado_em).getTime() - new Date(b.enviado_em).getTime()
      })

      const data = merged.length > 0 ? merged : null

      if (data) {
        setMensagens(data)

        // Check 24h window - only applies to WhatsApp channel
if (setorCanalConfig === 'evolution_api') {
  setIsWindowExpired(false)
  setLastMessageTime(null)
  } else {
        // WhatsApp 24h window starts from the last message the CLIENT sent, not bot/colaborador
        const currentTicketClientMessages = data.filter(
          (m) => m.ticket_id === ticketId && m.remetente === 'cliente'
        )
        if (currentTicketClientMessages.length > 0) {
          const lastClientMsg = currentTicketClientMessages[currentTicketClientMessages.length - 1]
          const lastTime = new Date(lastClientMsg.enviado_em)
          setLastMessageTime(lastTime)

          const now = new Date()
          const hoursDiff = (now.getTime() - lastTime.getTime()) / (1000 * 60 * 60)
          setIsWindowExpired(hoursDiff > 24)
        } else {
          // No client messages yet - for disparo tickets this is expected (locked state)
          // For normal tickets, don't expire the window
          setIsWindowExpired(false)
          setLastMessageTime(null)
        }
        }
      }
      setLoadingMensagens(false)
    },
    [supabase]
  )

  // Fetch templates for the setor
  const fetchTemplates = useCallback(async (setorId: string) => {
    const { data } = await supabase
      .from('templates_mensagem')
      .select('*')
      .eq('setor_id', setorId)
      .order('atalho')

    if (data) setTemplates(data)
  }, [supabase])

  // Initial load
  useEffect(() => {
    const init = async () => {
      const colab = await fetchColaborador()
      if (colab) {
        await fetchTickets(colab)
        await fetchSubsetoresDisponiveis(colab)
        await fetchMeusSubsetores(colab)
      }
      setLoading(false)
    }
    init()
  }, [fetchColaborador, fetchTickets, fetchSubsetoresDisponiveis, fetchMeusSubsetores])

  // Real-time subscription to sync colaborador status across all sessions/browsers
  useEffect(() => {
    if (!colaborador?.id) return

    const channel = supabase
      .channel(`colaborador-sync-${colaborador.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'colaboradores',
          filter: `id=eq.${colaborador.id}`,
        },
        (payload) => {
          const newData = payload.new as any
          // Update local state with the new status from database (single source of truth)
          setColaborador((prev) =>
            prev
              ? {
                  ...prev,
                  is_online: newData.is_online,
                }
              : null
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [colaborador?.id, supabase])

// Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
      }
    }, 100)
  }, [])

  // Load messages only when a DIFFERENT ticket is selected (by ID)
  // This prevents re-fetching when ticket data refreshes but same ticket is open
  const selectedTicketId = selectedTicket?.id || null
  const selectedClienteId = selectedTicket?.cliente_id || null
  useEffect(() => {
  if (selectedTicketId && selectedClienteId) {
  fetchMensagens(selectedTicketId, selectedClienteId)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTicketId])

  // Scroll to bottom when messages change
  useEffect(() => {
    if (mensagens.length > 0 && !loadingMensagens) {
      scrollToBottom()
    }
  }, [mensagens, loadingMensagens, scrollToBottom])

// Real-time subscription for tickets
  // Track known ticket IDs to detect truly new arrivals
  const knownTicketIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    knownTicketIdsRef.current = new Set(tickets.map(t => t.id))
  }, [tickets])

  useEffect(() => {
    if (!colaborador) return

    // Use colaboradorId (primitive) instead of colaborador (object) to prevent
    // subscription teardown/rebuild on every setColaborador call
    const colaboradorId = colaborador.id

    const channel = supabase
      .channel(`tickets-changes-${colaboradorId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tickets',
        },
        (payload) => {
          const newTicket = payload.new as any
          if (newTicket.colaborador_id === colaboradorId) {
            const colab = colaboradorCurrentRef.current
            playAlert('new_ticket')
            toast.info('Novo ticket recebido!')
            if (colab) fetchTickets(colab)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tickets',
        },
        (payload) => {
          const updatedTicket = payload.new as any
          const oldTicket = payload.old as any
          const colab = colaboradorCurrentRef.current

          // Skip realtime updates for tickets we're currently transferring
          if (transferringTicketIdsRef.current.has(updatedTicket.id)) {
            return
          }

          if (updatedTicket.colaborador_id === colaboradorId) {
            // If ticket was closed (encerrado) by another session/tab, close the panel
            if (updatedTicket.status === 'encerrado' && selectedTicketIdRef.current === updatedTicket.id) {
              setSelectedTicket(null)
              selectedTicketIdRef.current = null
              setMobileDrawerOpen(false)
              setMensagens([])
            }
            // Ticket was just assigned/transferred TO this colaborador
            const isNew = !knownTicketIdsRef.current.has(updatedTicket.id)
            if (isNew || (oldTicket.colaborador_id && oldTicket.colaborador_id !== colaboradorId)) {
              playAlert('new_ticket')
              toast.info('Novo ticket recebido!')
            }
            if (colab) fetchTickets(colab)
          } else if (oldTicket.colaborador_id === colaboradorId) {
            // Ticket was transferred AWAY from this colaborador
            setTickets((prev) => prev.filter((t) => t.id !== updatedTicket.id))
            if (selectedTicketIdRef.current === updatedTicket.id) {
              setSelectedTicket(null)
              selectedTicketIdRef.current = null
            }
          } else {
            // Other update on a ticket we own (status change, etc)
            if (knownTicketIdsRef.current.has(updatedTicket.id) && colab) {
              fetchTickets(colab)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // Use colaborador?.id (primitive) NOT colaborador (object) — prevents rebuilding
  // the subscription every time any colaborador field changes
  }, [colaborador?.id, fetchTickets, supabase, playAlert])

  // Refresh tickets when tab regains visibility (user switches back to the tab)
  useEffect(() => {
    if (!colaborador?.id) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        const colab = colaboradorCurrentRef.current
        if (colab) fetchTickets(colab)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [colaborador?.id, fetchTickets])

  // ── Heartbeat simples — apenas atualiza last_heartbeat para monitoramento ──
  // O is_online é controlado EXCLUSIVAMENTE por ação do usuário (botão online/offline/pausa/logout).
  // NENHUMA lógica automática altera o status. Sem beforeunload, sem sendBeacon, sem stale checks.
  useEffect(() => {
    if (!colaborador?.id) return

    let isActive = true
    const colaboradorId = colaborador.id

    const sendHeartbeat = () => {
      if (!isActive) return
      fetch('/api/colaborador/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colaboradorId }),
      }).catch(() => {})
    }

    const heartbeatInterval = setInterval(sendHeartbeat, 30000)
    const initialHeartbeatTimeout = setTimeout(sendHeartbeat, 2000)

    return () => {
      isActive = false
      clearInterval(heartbeatInterval)
      clearTimeout(initialHeartbeatTimeout)
    }
  }, [colaborador?.id])

  // Periodic ticket refresh + queue processor
  // Runs whenever colaborador.id is set — NOT gated on is_online.
  // Reason: the page's colaborador.is_online only updates via Realtime (colaboradores-sync).
  // If that Realtime event doesn't fire, is_online stays false and polling never starts,
  // causing tickets to only appear after F5. Using colaboradorCurrentRef ensures we always
  // read the latest status without rebuilding the interval on every status change.
  useEffect(() => {
    if (!colaborador?.id) return

    const colaboradorId = colaborador.id

    // Auto-assign: only trigger when the agent is actually online (reads live ref)
    const triggerAutoAssign = async () => {
      const colab = colaboradorCurrentRef.current
      if (!colab?.is_online) return
      try {
        await fetch('/api/tickets/auto-assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ colaboradorId }),
        })
        // Refresh tickets right after assignment
        const fresh = colaboradorCurrentRef.current
        if (fresh) fetchTickets(fresh)
      } catch (error) {
        console.error('Error triggering auto-assign:', error)
      }
    }

    // Poll tickets every 5 s regardless of online status
    // This guarantees that assignments made by the queue processor appear quickly
    // even if Realtime events are delayed or missed
    const pollTickets = () => {
      const colab = colaboradorCurrentRef.current
      if (colab) fetchTickets(colab)
    }

    // Run immediately
    triggerAutoAssign()
    pollTickets()

    const autoAssignInterval = setInterval(triggerAutoAssign, 30000)
    const pollInterval = setInterval(pollTickets, 5000)

    return () => {
      clearInterval(autoAssignInterval)
      clearInterval(pollInterval)
    }
  // Only depend on colaborador.id — status changes go through colaboradorCurrentRef
  }, [colaborador?.id, fetchTickets])

// Real-time subscription for messages of current ticket
  // Stable refs for realtime subscription
  const selectedTicketIdRef2 = selectedTicket?.id
  const selectedClienteIdRef = selectedTicket?.cliente_id

  useEffect(() => {
    if (!selectedTicketIdRef2 || !selectedClienteIdRef) return

    const handleNewMessage = (payload: any) => {
      const newMessage = payload.new as Mensagem
      setMensagens((prev) => {
        // Avoid duplicates (message might already exist from optimistic update)
        const exists = prev.some((m) => m.id === newMessage.id)
        if (exists) return prev

        // Also remove any temp messages that match this content
        const filtered = prev.filter((m) => {
          if (!m.id.startsWith('temp-')) return true
          return m.conteudo !== newMessage.conteudo
        })

        return [...filtered, newMessage]
      })
    }

    // Subscribe to messages for this specific ticket
    const channel = supabase
      .channel(`mensagens-${selectedTicketIdRef2}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensagens',
          filter: `ticket_id=eq.${selectedTicketIdRef2}`,
        },
        handleNewMessage
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensagens',
          filter: `cliente_id=eq.${selectedClienteIdRef}`,
        },
        handleNewMessage
      )
      .subscribe()

    // Fallback polling every 10s to catch any missed messages
    const pollInterval = setInterval(async () => {
      if (!selectedTicketIdRef2) return
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      // Resolve all cliente_ids with the same phone (handles duplicate client records)
      let pollClienteIds: string[] = selectedClienteIdRef ? [selectedClienteIdRef] : []
      if (selectedClienteIdRef) {
        const { data: cData } = await supabase
          .from('clientes')
          .select('telefone')
          .eq('id', selectedClienteIdRef)
          .single()
        if (cData?.telefone) {
          const { data: allC } = await supabase
            .from('clientes')
            .select('id')
            .eq('telefone', cData.telefone)
          if (allC && allC.length > 0) {
            pollClienteIds = [...new Set(allC.map(c => c.id))]
          }
        }
      }

      // Same 3-query approach as fetchMensagens
      const { data: ticketMsgs } = await supabase
        .from('mensagens')
        .select('*, tickets(id, status, criado_em, encerrado_em)')
        .eq('ticket_id', selectedTicketIdRef2)
        .order('enviado_em', { ascending: true, nullsFirst: false })

      // Messages from OTHER tickets of the same client
      const { data: otherTicketMsgs } = pollClienteIds.length > 0
        ? await supabase
            .from('mensagens')
            .select('*, tickets(id, status, criado_em, encerrado_em)')
            .in('cliente_id', pollClienteIds)
            .neq('ticket_id', selectedTicketIdRef2)
            .not('ticket_id', 'is', null)
            .gte('enviado_em', sevenDaysAgo.toISOString())
            .order('enviado_em', { ascending: true, nullsFirst: false })
        : { data: [] }

      // Orphan messages (ticket_id IS NULL) — bot conversations
      const { data: orphanMsgs } = pollClienteIds.length > 0
        ? await supabase
            .from('mensagens')
            .select('*')
            .in('cliente_id', pollClienteIds)
            .is('ticket_id', null)
            .gte('enviado_em', sevenDaysAgo.toISOString())
            .order('enviado_em', { ascending: true, nullsFirst: false })
        : { data: [] }

      // Merge all 3 queries, deduplicate by id, and sort
      const allPollMsgs = [...(ticketMsgs || []), ...(otherTicketMsgs || []), ...(orphanMsgs || [])]
      const pollSeen = new Set<string>()
      const merged = allPollMsgs.filter((m: any) => {
        if (pollSeen.has(m.id)) return false
        pollSeen.add(m.id)
        return true
      })
      merged.sort((a, b) => {
        if (!a.enviado_em) return -1
        if (!b.enviado_em) return 1
        return new Date(a.enviado_em).getTime() - new Date(b.enviado_em).getTime()
      })

      if (merged.length > 0) {
        setMensagens((prev) => {
          const prevRealIds = prev.filter(m => !m.id.startsWith('temp-')).map(m => m.id)
          const newRealIds = merged.map((m: any) => m.id)
          const hasNewMessages = newRealIds.some((id: string) => !prevRealIds.includes(id))

          // Never reduce: only update if there are genuinely new messages
          if (!hasNewMessages && newRealIds.length >= prevRealIds.length) return prev

          const tempMessages = prev.filter(m => m.id.startsWith('temp-'))
          const remainingTemps = tempMessages.filter(
            t => !merged.some((d: any) => d.conteudo === t.conteudo)
          )
          return [...merged, ...remainingTemps]
        })
      }
    }, 10000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(pollInterval)
    }
  }, [selectedTicketIdRef2, selectedClienteIdRef, supabase])

  // Global subscription for new messages on all tickets (for audio alerts)
  // Use ref for ticketIds to avoid recreating the channel on every ticket list change
  const ticketsRef = useRef<Ticket[]>([])
  useEffect(() => {
    ticketsRef.current = tickets
  }, [tickets])

  useEffect(() => {
    if (!colaborador) return

    const channel = supabase
      .channel('all-messages-alert')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensagens',
        },
        (payload) => {
          const newMessage = payload.new as any
          const currentTickets = ticketsRef.current

          // Only alert for messages in this colaborador's tickets
          if (!currentTickets.some((t) => t.id === newMessage.ticket_id)) return

          // Only alert for client messages (remetente = 'cliente')
          if (newMessage.remetente !== 'cliente') return

          const isViewingThisTicket = selectedTicketIdRef.current === newMessage.ticket_id

          // Increment unread count only if NOT viewing this ticket
          if (!isViewingThisTicket) {
            setUnreadCounts((prev) => {
              const newMap = new Map(prev)
              const current = newMap.get(newMessage.ticket_id) || 0
              newMap.set(newMessage.ticket_id, current + 1)
              return newMap
            })
          }

          // Always play audio alert for client messages
          playAlert('new_message')
          
          // Show toast only for messages from OTHER tickets
          if (!isViewingThisTicket) {
            const ticket = currentTickets.find((t) => t.id === newMessage.ticket_id)
            if (ticket) {
              toast.info(`Nova mensagem de ${ticket.clientes?.nome || 'Cliente'}`)
            }
          }
          
          // Update ticket's last message info and move to top (like WhatsApp)
          // startTransition → baixa prioridade: não interrompe a renderização das mensagens
          startTransition(() => {
            setTickets((prev) => {
              const updated = prev.map((t) =>
                t.id === newMessage.ticket_id
                  ? { ...t, ultima_mensagem: newMessage.conteudo, ultima_mensagem_em: newMessage.enviado_em, ultima_mensagem_remetente: newMessage.remetente }
                  : t
              )
              return updated.sort((a, b) =>
                new Date(b.ultima_mensagem_em || b.criado_em).getTime() -
                new Date(a.ultima_mensagem_em || a.criado_em).getTime()
              )
            })
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [colaborador, supabase, playAlert])

  // Filter tickets — memoized so typing in the message input does NOT re-filter the list
  const filteredTickets = useMemo(() => tickets.filter((ticket) => {
    const matchesStatus = statusFilter === 'todos' || ticket.status === statusFilter
    const matchesPrioridade = prioridadeFilter === 'todos' || ticket.prioridade === prioridadeFilter
    const matchesSubsetor = subsetorFilter === 'todos' || 
      (subsetorFilter === 'sem_subsetor' && !ticket.subsetor_id) ||
      ticket.subsetor_id === subsetorFilter
    const matchesSearch = ticket.clientes.nome.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesStatus && matchesPrioridade && matchesSubsetor && matchesSearch
  }), [tickets, statusFilter, prioridadeFilter, subsetorFilter, searchTerm])

  // Handle ticket selection
  const handleSelectTicket = (ticket: Ticket) => {
    const isSameTicket = selectedTicketIdRef.current === ticket.id

    // Update ref immediately so in-flight sends know the ticket changed
    selectedTicketIdRef.current = ticket.id
    setSelectedTicket(ticket)

    if (!isSameTicket) {
      // Clear messages only when switching to a DIFFERENT ticket — prevents flash of old
      // conversation while new messages load. Re-clicking the same ticket must NOT clear
      // messages because the useEffect won't re-fire (selectedTicketId didn't change).
      setMensagens([])
      // Also clear the typed message so each ticket starts clean
      setMessageInput('')
      setShowTemplates(false)
    }

    setMobileDrawerOpen(false)
    // Update canal config based on ticket's setor
    if (ticket.setores?.canal) {
      setSetorCanalConfig(ticket.setores.canal as 'whatsapp' | 'evolution_api')
    }
    // Initialize audio context on user interaction
    initAudioContext()
    // Fetch templates for this setor
    if (ticket.setor_id) {
      fetchTemplates(ticket.setor_id)
    }
    // Clear unread count for this ticket
    setUnreadCounts((prev) => {
      const newMap = new Map(prev)
      newMap.delete(ticket.id)
      return newMap
    })
  }

  // Mark as em_atendimento
  const handleMarcarEmAtendimento = async () => {
    if (!selectedTicket || !colaborador) return

    const isFirstResponse = selectedTicket.status === 'aberto'

    await supabase
      .from('tickets')
      .update({
        status: 'em_atendimento',
        colaborador_id: colaborador.id,
        ...(isFirstResponse ? { primeira_resposta_em: new Date().toISOString() } : {}),
      })
      .eq('id', selectedTicket.id)

    setSelectedTicket((prev) =>
      prev ? { ...prev, status: 'em_atendimento', colaborador_id: colaborador.id } : null
    )
    
    if (colaborador) {
      fetchTickets(colaborador)
    }
  }

  // Encerrar ticket
const handleEncerrarTicket = async () => {
    if (!selectedTicket || !colaborador) return

    try {
      // Fetch the setor to get finalization message
      const { data: setor } = await supabase
        .from('setores')
        .select('mensagem_finalizacao')
        .eq('id', selectedTicket.setor_id)
        .single()

      // Se há mensagem de finalização, detectar o canal correto e enviar
      if (setor?.mensagem_finalizacao && !isWindowExpired) {
        // Detectar canal pela última mensagem (mesma lógica do handleSendMessage)
        const { data: lastMsgData } = await supabase
          .from('mensagens')
          .select('canal_envio, phone_number_id')
          .eq('ticket_id', selectedTicket.id)
          .neq('remetente', 'sistema')
          .order('enviado_em', { ascending: false })
          .limit(1)

        const lastCanalEnvio = lastMsgData?.[0]?.canal_envio || null
        const lastPhoneNumberId = lastMsgData?.[0]?.phone_number_id || null

        let setorCanal = 'whatsapp'
        let phoneNumberId: string | null = lastPhoneNumberId

        if (lastCanalEnvio === 'evolutionapi' || lastPhoneNumberId) {
          if (lastPhoneNumberId) {
            const { data: evoCanal } = await supabase
              .from('setor_canais')
              .select('instancia')
              .eq('tipo', 'evolution_api')
              .eq('instancia', lastPhoneNumberId)
              .eq('ativo', true)
              .maybeSingle()
            setorCanal = evoCanal ? 'evolution_api' : 'whatsapp'
            phoneNumberId = lastPhoneNumberId
          } else {
            setorCanal = 'evolution_api'
          }
        } else if (selectedTicket.setor_id) {
          // Fallback: buscar canal ativo do setor
          const { data: canalAtivo } = await supabase
            .from('setor_canais')
            .select('tipo, instancia, phone_number_id')
            .eq('setor_id', selectedTicket.setor_id)
            .eq('ativo', true)
            .order('criado_em', { ascending: true })
            .limit(1)
            .maybeSingle()
          if (canalAtivo) {
            setorCanal = canalAtivo.tipo
            phoneNumberId = canalAtivo.tipo === 'evolution_api'
              ? canalAtivo.instancia
              : canalAtivo.phone_number_id
          }
        }

        console.log('[encerrar] Canal de finalização detectado:', setorCanal, 'phoneNumberId:', phoneNumberId)

        const processedMessage = processTemplateVariables(setor.mensagem_finalizacao)

        if (setorCanal === 'evolution_api' && phoneNumberId && selectedTicket.clientes.telefone) {
          await fetch('/api/evolution/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ticketId: selectedTicket.id,
              message: processedMessage,
              instanceName: phoneNumberId,
            }),
          })
        } else if (setorCanal === 'whatsapp' && phoneNumberId && selectedTicket.clientes.telefone) {
          await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipientPhone: selectedTicket.clientes.telefone,
              message: processedMessage,
              ticketId: selectedTicket.id,
              phoneNumberId: phoneNumberId,
            }),
          })
        }
      }

      // Update ticket status
      await supabase
        .from('tickets')
        .update({
          status: 'encerrado',
          encerrado_em: new Date().toISOString(),
        })
.eq('id', selectedTicket.id)

      // Dispatch webhook (await to ensure it completes before UI changes)
      try {
        await fetch('/api/webhooks/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticketId: selectedTicket.id,
            evento: 'ticket_encerrado',
          }),
        })
      } catch (err) {
        console.error('[Webhook] dispatch error:', err)
      }

      setSelectedTicket(null)
      selectedTicketIdRef.current = null
      setEncerrarDialogOpen(false)
      setMobileDrawerOpen(false)
      setMensagens([])

      if (colaborador) {
        fetchTickets(colaborador)
      }
    } catch (error) {
      console.error('Error closing ticket:', error)
    }
  }

  // Helper: cliente tem CNPJ informado
  const clienteTemCNPJ = !!(selectedTicket?.clientes?.CNPJ)

  // Confirmar encerrar — verifica cliente antes
  const handleConfirmarEncerrar = () => {
    setEncerrarDialogOpen(false)
    if (!clienteTemCNPJ) {
      setClienteNaoInformadoDialogOpen(true)
    } else {
      handleEncerrarTicket()
    }
  }

  // Buscar cliente por CNPJ (painel de seleção)
  const handleSelecionarClienteCnpjLookup = async () => {
    if (!selecionarClienteCnpj.trim()) return
    setSelecionarClienteLoading(true)
    setSelecionarClienteData(null)
    try {
      const res = await fetch('/api/clientes/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpj: selecionarClienteCnpj.replace(/\D/g, '') }),
      })
      const data = await res.json()
      if (data.source === 'not_found') {
        toast.error('Cliente não encontrado com este CNPJ')
      } else if (data.cliente) {
        setSelecionarClienteData(data.cliente)
        toast.success(`Cliente encontrado: ${data.cliente.nome}`)
      }
    } catch {
      toast.error('Erro ao buscar cliente')
    } finally {
      setSelecionarClienteLoading(false)
    }
  }

  // Ref para evitar que o real-time sobrescreva a troca de cliente
  const clienteSwapTicketIdRef = useRef<string | null>(null)

  // Confirmar vínculo do cliente ao ticket
  const handleConfirmarSelecionarCliente = async () => {
    if (!selecionarClienteData || !selectedTicket) return
    try {
      // Marca que estamos trocando o cliente deste ticket — o real-time não deve sobrescrever
      clienteSwapTicketIdRef.current = selectedTicket.id

      const { error } = await supabase
        .from('tickets')
        .update({ cliente_id: selecionarClienteData.id })
        .eq('id', selectedTicket.id)
      if (error) throw error

      // Atualiza o estado local com o novo cliente
      // NÃO preserva o telefone antigo — o telefone do ticket é do contato WhatsApp,
      // e o cliente vinculado é a empresa (CNPJ). São dados diferentes.
      setSelectedTicket((prev) =>
        prev ? { ...prev, cliente_id: selecionarClienteData.id, clientes: selecionarClienteData } : null
      )
      setTickets((prev) =>
        prev.map((t) =>
          t.id === selectedTicket.id
            ? { ...t, cliente_id: selecionarClienteData.id, clientes: selecionarClienteData }
            : t
        )
      )

      toast.success('Cliente vinculado ao ticket!')
      setSelecionarClienteDialogOpen(false)
      setSelecionarClienteCnpj('')
      setSelecionarClienteData(null)

      // Libera o bloqueio do real-time após 3s (tempo suficiente para o evento passar)
      setTimeout(() => { clienteSwapTicketIdRef.current = null }, 3000)
    } catch {
      clienteSwapTicketIdRef.current = null
      toast.error('Erro ao vincular cliente')
    }
  }

  // Abrir dialog de edição de cliente
  const handleAbrirEditarCliente = () => {
    if (!selectedTicket?.clientes) return
    const c = selectedTicket.clientes
    setEditarClienteForm({
      nome: c.nome || '',
      telefone: c.telefone || '',
      CNPJ: c.CNPJ || '',
      Registro: c.Registro || '',
      email: c.email || '',
    })
    setEditarClienteDialogOpen(true)
  }

  // Salvar edição do cliente
  const handleSalvarEditarCliente = async () => {
    if (!selectedTicket?.clientes?.id) return
    setEditarClienteLoading(true)
    try {
      const clienteId = selectedTicket.clientes.id
      const updateData: Record<string, string | null> = {
        nome: editarClienteForm.nome || null,
        telefone: editarClienteForm.telefone || null,
        CNPJ: editarClienteForm.CNPJ?.replace(/\D/g, '') || null,
        Registro: editarClienteForm.Registro || null,
        email: editarClienteForm.email || null,
      }

      const { error } = await supabase
        .from('clientes')
        .update(updateData)
        .eq('id', clienteId)
      if (error) throw error

      // Atualiza estado local
      const updatedCliente = { ...selectedTicket.clientes, ...updateData }
      clienteSwapTicketIdRef.current = selectedTicket.id
      setSelectedTicket((prev) =>
        prev ? { ...prev, clientes: updatedCliente } : null
      )
      setTickets((prev) =>
        prev.map((t) =>
          t.id === selectedTicket.id
            ? { ...t, clientes: updatedCliente }
            : t
        )
      )
      setTimeout(() => { clienteSwapTicketIdRef.current = null }, 3000)

      toast.success('Dados do cliente atualizados!')
      setEditarClienteDialogOpen(false)
    } catch {
      toast.error('Erro ao atualizar dados do cliente')
    } finally {
      setEditarClienteLoading(false)
    }
  }

  // Toggle subsetor ativo do colaborador (escreve/remove em colaboradores_subsetores)
  const toggleMeuSubsetor = async (subsetorId: string, setorId: string) => {
    if (!colaborador || togglingSubsetor) return
    setTogglingSubsetor(true)
    const isActive = meusSubsetorIds.includes(subsetorId)
    if (isActive) {
      await supabase
        .from('colaboradores_subsetores')
        .delete()
        .eq('colaborador_id', colaborador.id)
        .eq('subsetor_id', subsetorId)
      setMeusSubsetorIds((prev) => prev.filter((id) => id !== subsetorId))
    } else {
      await supabase
        .from('colaboradores_subsetores')
        .insert({ colaborador_id: colaborador.id, setor_id: setorId, subsetor_id: subsetorId })
      setMeusSubsetorIds((prev) => [...prev, subsetorId])
    }
    setTogglingSubsetor(false)
  }

  // Open transfer dialog and fetch data
  const openTransferDialog = async () => {
    setTransferDialogOpen(true)
    setSelectedSetorTransfer('all')
    setSelectedAtendenteTransfer('all')
    setAtendentesDisponiveis([])
    setSetores([])
    setTransferDataLoading(true)

    try {
      const currentSetorId = selectedTicket?.setor_id
      if (currentSetorId) {
        const res = await fetch(`/api/setor/${currentSetorId}/transferencia-destinos`)
        if (res.ok) {
          const data = await res.json()
          setSetores(data.destinos || [])
        }
      }

      if (selectedTicket?.setor_id) {
        const { data: colaboradoresSetores } = await supabase
          .from('colaboradores_setores')
          .select('colaborador_id')
          .eq('setor_id', selectedTicket.setor_id)

        if (colaboradoresSetores && colaboradoresSetores.length > 0) {
          const colaboradorIds = colaboradoresSetores.map((cs) => cs.colaborador_id)
          const { data: colaboradoresData } = await supabase
            .from('colaboradores')
            .select('id, nome, is_online, ativo, last_heartbeat')
            .in('id', colaboradorIds)
            .eq('ativo', true)
            .neq('id', colaborador?.id || '')

          if (colaboradoresData) {
            setAtendentesDisponiveis(colaboradoresData.map((a: any) => ({ ...a, handlesSubsetor: false })))
          }
        }
      }
    } catch (err) {
      console.error('Error loading transfer data:', err)
    } finally {
      setTransferDataLoading(false)
    }
  }

  // Fetch atendentes when setor changes
  const handleSetorChange = async (setorId: string) => {
    setSelectedSetorTransfer(setorId)
    setSelectedAtendenteTransfer('all')

    // First get all colaborador_ids for this setor
    const { data: colaboradoresSetores } = await supabase
      .from('colaboradores_setores')
      .select('colaborador_id')
      .eq('setor_id', setorId)

    if (colaboradoresSetores && colaboradoresSetores.length > 0) {
      const colaboradorIds = colaboradoresSetores.map((cs) => cs.colaborador_id)

      // Then fetch the actual colaboradores
      const { data: colaboradoresData } = await supabase
        .from('colaboradores')
        .select('id, nome, is_online, ativo, last_heartbeat')
        .in('id', colaboradorIds)
        .eq('ativo', true)

      if (colaboradoresData) {
        setAtendentesDisponiveis(colaboradoresData.map((a: any) => ({ ...a, handlesSubsetor: false })))
      }
    } else {
      setAtendentesDisponiveis([])
    }
  }

  // Transfer ticket
  const handleTransferTicket = async () => {
    if (!selectedTicket) return

    const ticketId = selectedTicket.id
    setTransferLoading(true)

    // Mark as transferring BEFORE the API call to prevent realtime from bringing it back
    transferringTicketIdsRef.current.add(ticketId)

    // Remove ticket from UI immediately for instant feedback
    setTickets((prev) => prev.filter((t) => t.id !== ticketId))
    setSelectedTicket(null)
    selectedTicketIdRef.current = null
    setMobileDrawerOpen(false)
    setMensagens([])
    setTransferDialogOpen(false)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s timeout

      const res = await fetch('/api/tickets/transferir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: ticketId,
          setor_id: selectedSetorTransfer !== 'all' ? selectedSetorTransfer : undefined,
          colaborador_id: selectedAtendenteTransfer !== 'all' ? selectedAtendenteTransfer : null,
          from_colaborador_nome: colaborador?.nome || 'Desconhecido',
          from_setor_nome: selectedTicket.setores?.nome || 'Desconhecido',
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const result = await res.json()

      if (!res.ok) {
        toast.error(result.error || 'Erro ao transferir ticket')
        // Transfer failed — bring ticket back
        transferringTicketIdsRef.current.delete(ticketId)
        if (colaborador) fetchTickets(colaborador)
        return
      }

      if (result.queued) {
        toast.info('Ticket transferido para a fila de espera')
      } else {
        toast.success('Ticket transferido com sucesso')
      }

      // Se o ticket foi para a fila, acionar distribuição automática
      if (selectedAtendenteTransfer === 'all' || result.queued) {
        fetch('/api/tickets/auto-assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            setorId: result.setor_id || selectedSetorTransfer,
            organizacaoId: colaborador?.organizacao_id,
          }),
        }).catch(() => {})
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        toast.error('Transferência demorou demais. O ticket pode ter sido transferido — atualize a página.')
      } else {
        console.error('Error transferring ticket:', err)
        toast.error('Erro ao transferir ticket. Tente novamente.')
      }
      // On error, bring ticket back
      transferringTicketIdsRef.current.delete(ticketId)
      if (colaborador) fetchTickets(colaborador)
    } finally {
      setTransferLoading(false)
      // Clean up after a delay to prevent realtime race condition
      setTimeout(() => {
        transferringTicketIdsRef.current.delete(ticketId)
      }, 5000)
    }
  }

  // Disparo - CNPJ lookup
  const handleCnpjLookup = async () => {
    if (!disparoCnpj.trim()) return
    setDisparoLoading(true)
    setDisparoCliente(null)
    try {
      const res = await fetch('/api/clientes/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpj: disparoCnpj.replace(/\D/g, '') }),
      })
      const data = await res.json()
      if (data.source === 'not_found') {
        toast.error('Cliente nao encontrado com este CNPJ')
      } else if (data.cliente) {
        setDisparoCliente(data.cliente)
        if (data.cliente.telefone) {
          setDisparoTelefone(data.cliente.telefone)
        }
        setDisparoStep('telefone')
        toast.success(`Cliente encontrado: ${data.cliente.nome}`)
      }
    } catch {
      toast.error('Erro ao buscar cliente')
    }
    setDisparoLoading(false)
  }

  // Disparo - Phone lookup (modo "por telefone")
  const handlePhoneLookup = async () => {
    const cleanPhone = disparoTelefone.replace(/\D/g, '')
    if (cleanPhone.length < 10) {
      toast.error('Informe um telefone valido (DDD + numero)')
      return
    }
    if (!colaborador?.organizacao_id) {
      toast.error('Organizacao nao identificada')
      return
    }
    setDisparoLoading(true)
    setDisparoCliente(null)
    setDisparoTelefoneNaoEncontrado(false)
    setDisparoNomeManual('')
    try {
      const { data, error } = await supabase.rpc('buscar_cliente_por_telefone', {
        p_telefone: cleanPhone,
        p_organizacao_id: colaborador.organizacao_id,
      })
      if (error) throw error
      const cliente = Array.isArray(data) && data.length > 0 ? data[0] : null
      if (cliente) {
        setDisparoCliente({
          id: cliente.id,
          nome: cliente.nome,
          cnpj: cliente.CNPJ,
          telefone: cliente.telefone,
          registro: cliente.Registro,
          email: cliente.email,
        })
        toast.success(`Cliente encontrado: ${cliente.nome}`)
      } else {
        setDisparoTelefoneNaoEncontrado(true)
        toast.info('Telefone nao vinculado. Informe o nome para continuar.')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao buscar cliente')
    }
    setDisparoLoading(false)
  }

  // Disparo - Confirma nome manual quando telefone nao achou cliente
  const handleConfirmNomeManual = () => {
    const nome = disparoNomeManual.trim()
    if (!nome) {
      toast.error('Informe o nome do cliente')
      return
    }
    setDisparoCliente({
      id: null,
      nome,
      cnpj: null,
      telefone: disparoTelefone.replace(/\D/g, ''),
      registro: null,
      email: null,
    })
    setDisparoTelefoneNaoEncontrado(false)
  }

  // Disparo - Format phone input
  const handleDisparoTelefoneChange = (value: string) => {
    const digits = value.replace(/\D/g, '')
    if (digits.length <= 2) {
      setDisparoTelefone(digits)
    } else if (digits.length <= 7) {
      setDisparoTelefone(`(${digits.slice(0, 2)}) ${digits.slice(2)}`)
    } else if (digits.length <= 11) {
      setDisparoTelefone(`(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7)}`)
    }
  }

  // Disparo - Send template
  const handleEnviarDisparo = async () => {
    if (!disparoCliente || !disparoTelefone || !colaborador) return
    
    // Get setor_id from colaborador
    const setorId = colaborador.setor_id || colaborador.setores_vinculados?.[0]?.setor_id
    if (!setorId) {
      toast.error('Colaborador sem setor vinculado')
      return
    }
    
    const phoneDigits = disparoTelefone.replace(/\D/g, '')
    // Add country code if not present
    const fullPhone = phoneDigits.length === 11 ? `55${phoneDigits}` : phoneDigits

    setDisparoSending(true)
    try {
      const res = await fetch('/api/whatsapp/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteNome: disparoCliente.nome,
          clienteCnpj: disparoCliente.cnpj,
          clienteRegistro: disparoCliente.registro,
          telefone: fullPhone,
          setorId,
        }),
      })
      const data = await res.json()
      if (data.warning) {
        // Ticket já existe para este cliente
        const atendenteInfo = data.atendente ? ` com o atendente ${data.atendente}` : ''
        toast.error(`Já existe um ticket #${data.ticketNumero || ''}${atendenteInfo} aberto para este cliente.`, { duration: 6000 })
        setDisparoSending(false)
        return
      }
      if (data.success) {
        toast.success(`Disparo enviado! Ticket #${data.ticketNumero || ''} criado.`)
        setDisparoDialogOpen(false)
        resetDisparo()
        // Refresh tickets
        if (colaborador) fetchTickets(colaborador)
      } else {
        toast.error(data.error || 'Erro ao enviar disparo')
      }
    } catch {
      toast.error('Erro ao enviar disparo')
    }
    setDisparoSending(false)
  }

  // Reset disparo modal
  const resetDisparo = () => {
    setDisparoCnpj('')
    setDisparoTelefone('')
    setDisparoCliente(null)
    // Quando fluxo por telefone: primeiro step e 'telefone_lookup'.
    // Caso contrario, 'cnpj' (comportamento legado).
    setDisparoStep(novoDisparoEnabled ? 'telefone_lookup' : 'cnpj')
    setDisparoCanalChoice('whatsapp')
    setDisparoMensagemEvolution('')
    setDisparoNomeManual('')
    setDisparoTelefoneNaoEncontrado(false)
  }

  // Determine next step after phone number is confirmed.
  // Nao ha mais escolha manual de canal: priorizamos Evolution API se
  // estiver ativo no setor (permite mensagem customizada); caso
  // contrario, envia via WhatsApp oficial direto.
  const handleDisparoConfirmPhone = () => {
    const temEvolution = setorCanaisAtivos.includes('evolution_api')

    if (temEvolution) {
      setDisparoCanalChoice('evolution_api')
      const defaultMsg = templates[0]?.conteudo || `Olá ${disparoCliente?.nome || ''}, como posso ajudar?`
      setDisparoMensagemEvolution(defaultMsg)
      setDisparoStep('mensagem_evolution')
    } else {
      setDisparoCanalChoice('whatsapp')
      handleEnviarDisparo()
    }
  }

  // Disparo via Evolution API
  const handleEnviarDisparoEvolution = async () => {
    if (!disparoCliente || !disparoTelefone || !colaborador || !disparoMensagemEvolution.trim()) return

    const setorId = colaborador.setor_id || colaborador.setores_vinculados?.[0]?.setor_id
    if (!setorId) {
      toast.error('Colaborador sem setor vinculado')
      return
    }

    setDisparoSending(true)
    try {
      const res = await fetch('/api/evolution/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteNome: disparoCliente.nome,
          clienteCnpj: disparoCliente.cnpj,
          clienteRegistro: disparoCliente.registro,
          telefone: disparoTelefone,
          setorId,
          mensagem: disparoMensagemEvolution,
        }),
      })
      const data = await res.json()
      if (data.warning) {
        // Ticket já existe para este cliente
        const atendenteInfo = data.atendente ? ` com o atendente ${data.atendente}` : ''
        toast.error(`Já existe um ticket #${data.ticketNumero || ''}${atendenteInfo} aberto para este cliente.`, { duration: 6000 })
        setDisparoSending(false)
        return
      }
      if (data.success) {
        toast.success(`Disparo enviado via Evolution! Ticket #${data.ticketNumero || ''} criado.`)
        setDisparoDialogOpen(false)
        resetDisparo()
        if (colaborador) fetchTickets(colaborador)
      } else {
        toast.error(data.error || 'Erro ao enviar disparo via Evolution')
      }
    } catch {
      toast.error('Erro ao enviar disparo via Evolution')
    }
    setDisparoSending(false)
  }

  // Check if disparo ticket is locked (client hasn't replied after dispatch)
  const isDisparoLocked = (ticket: Ticket) => {
  if (!ticket.is_disparo || !ticket.disparo_em) return false
  const dispatchTime = new Date(ticket.disparo_em).getTime()
  // Check if there's any client message AFTER the dispatch time
  const hasClientReplyAfterDispatch = mensagens.some(
    m => m.remetente === 'cliente' && new Date(m.enviado_em).getTime() > dispatchTime
  )
  return !hasClientReplyAfterDispatch
  }

  // Check if encerrar is allowed for disparo tickets
  // Enabled when: client replied OR 12min timer expired
  const isDisparoEncerrarEnabled = (ticket: Ticket) => {
    if (!ticket.is_disparo || !ticket.disparo_em) return true
    const dispatchTime = new Date(ticket.disparo_em).getTime()
    // If client already replied after dispatch, always allow encerrar
    const hasClientReply = mensagens.some(
      m => m.remetente === 'cliente' && new Date(m.enviado_em).getTime() > dispatchTime
    )
    if (hasClientReply) return true
    // Otherwise, wait for 12min timer
    const now = Date.now()
    const twelveMin = 12 * 60 * 1000
    return (now - dispatchTime) >= twelveMin
  }

  // Copy to clipboard helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} copiado!`)
    }).catch(() => {
      toast.error('Erro ao copiar')
    })
  }

  // Common emojis
  const commonEmojis = ['😊', '👍', '🙏', '✅', '❌', '⏳', '📞', '💬', '🔔', '⚠️', '✨', '🎉']
  
const insertEmoji = (emoji: string) => {
    setMessageInput((prev) => prev + emoji)
    setShowEmojiPicker(false)
  }

  // Process template variables
  const processTemplateVariables = (message: string) => {
    if (!selectedTicket || !colaborador) return message

    const now = new Date()
    return message
      .replace(/\{\{cliente_nome\}\}/g, selectedTicket.clientes.nome || '')
      .replace(/\{\{cliente_telefone\}\}/g, selectedTicket.clientes.telefone || '')
      .replace(/\{\{cliente_cnpj\}\}/g, selectedTicket.clientes.CNPJ || '')
      .replace(/\{\{atendente_nome\}\}/g, colaborador.nome || '')
      .replace(/\{\{setor_nome\}\}/g, selectedTicket.setores?.nome || '')
      .replace(/\{\{ticket_id\}\}/g, `#${selectedTicket.numero}`)
      .replace(/\{\{data_atual\}\}/g, now.toLocaleDateString('pt-BR'))
      .replace(/\{\{hora_atual\}\}/g, now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
  }

  // Handle input change for template detection
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value
  setMessageInput(value)

  // Only check for template shortcuts when text starts with /
  if (value.startsWith('/') && value.length > 1) {
  const search = value.slice(1).toLowerCase()
  
  // Check for exact match - only replace when user types exactly /atalho
  const exactMatch = templates.find((t) => t.atalho.toLowerCase() === search)
  if (exactMatch) {
  const processedMessage = processTemplateVariables(exactMatch.mensagem)
  setMessageInput(processedMessage)
  setShowTemplates(false)
  return
  }
      
      // Otherwise show partial matches
      const matches = templates.filter((t) => t.atalho.toLowerCase().includes(search))
      setFilteredTemplates(matches)
      setShowTemplates(matches.length > 0)
    } else if (value === '/') {
      setFilteredTemplates(templates)
      setShowTemplates(templates.length > 0)
    } else {
      setShowTemplates(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates])

  // Select a template
  const selectTemplate = (template: any) => {
    const processedMessage = processTemplateVariables(template.mensagem)
    setMessageInput(processedMessage)
    setShowTemplates(false)
  }

  // Handle file selection (images, videos and PDFs)
  const handleFileSelect = (file: File) => {
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    const isAudio = file.type.startsWith('audio/')
    // Size limits: videos 50MB | images/audio 16MB | documents 100MB
    const maxSize = isVideo ? 50 * 1024 * 1024 : isImage || isAudio ? 16 * 1024 * 1024 : 100 * 1024 * 1024
    const maxLabel = isVideo ? '50MB' : isImage || isAudio ? '16MB' : '100MB'
    if (file.size > maxSize) {
      toast.error(`Arquivo muito grande. Máximo ${maxLabel}.`)
      return
    }
    setSelectedFile(file)
    if (isImage) {
      const reader = new FileReader()
      reader.onloadend = () => setFilePreview(reader.result as string)
      reader.readAsDataURL(file)
    } else if (isVideo) {
      setFilePreview(`video:${file.name}`)
    } else {
      // Audio, documents, and any other file — generic preview with filename
      setFilePreview(`file:${file.name}`)
    }
  }



  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  // Handle paste event
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of items) {
      if (item.type.startsWith('image/') || item.type === 'application/pdf') {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) {
          handleFileSelect(file)
        }
        break
      }
    }
  }

  // Clear selected file
  const clearSelectedFile = () => {
    setSelectedFile(null)
    setFilePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }



// Upload file to Vercel Blob (images and PDFs)
  const uploadImage = async (file: File): Promise<string | null> => {
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }))
        throw new Error(errorData.error || 'Upload failed')
      }
      
      const data = await response.json()
      return data.url
    } catch (error: any) {
      console.error('Error uploading file:', error)
      toast.error(error?.message || 'Erro ao enviar arquivo')
      return null
    }
  }

  // Send message via WhatsApp API (optimistic update like WhatsApp)
  const handleSendMessage = async () => {
    if ((!messageInput.trim() && !selectedFile) || !selectedTicket || !colaborador) return

    // Capture ticket context at call-time (before any awaits).
    // This snapshot is used throughout the async flow so that if the user
    // switches to another ticket while the send is in progress, we never
    // corrupt the newly-selected ticket's state.
    const capturedTicketId = selectedTicket.id
    const capturedTicket = selectedTicket
    const capturedColaborador = colaborador
    
const tempId = `temp-${Date.now()}`
    let messageContent = messageInput.trim()
    const fileToUpload = selectedFile
    const hasFile = !!fileToUpload
  const isImage = fileToUpload?.type.startsWith('image/')
  const isVideo = fileToUpload?.type.startsWith('video/')
  const isAudio = fileToUpload?.type.startsWith('audio/')

    // Clear input immediately (optimistic)
    setMessageInput('')
    clearSelectedFile()
    
    // Send in background
    try {
      // Determinar canal de envio pela última mensagem do ticket
      // Prioridade: canal_envio > setor_canais > fallback
      let setorCanal = 'whatsapp'
      let phoneNumberId: string | null = null

      // 1. Busca a última mensagem do ticket (exceto sistema)
      const { data: lastMsgData } = await supabase
        .from('mensagens')
        .select('canal_envio, phone_number_id')
        .eq('ticket_id', capturedTicketId)
        .neq('remetente', 'sistema')
        .order('enviado_em', { ascending: false })
        .limit(1)

      const lastCanalEnvio = lastMsgData?.[0]?.canal_envio || null
      const lastPhoneNumberId = lastMsgData?.[0]?.phone_number_id || null

      console.log('[workdesk] Canal detection — ticket:', capturedTicketId, {
        lastCanalEnvio,
        lastPhoneNumberId,
        setorCanalConfig,
      })

      if (lastCanalEnvio === 'evolutionapi' || lastPhoneNumberId) {
        // Evolution ou WhatsApp — cruzar phone_number_id com setor_canais
        // IMPORTANTE: busca em TODOS os setores (ticket pode ter sido transferido do setor original)
        if (lastPhoneNumberId) {
          const { data: evoCanal } = await supabase
            .from('setor_canais')
            .select('instancia')
            .eq('tipo', 'evolution_api')
            .eq('instancia', lastPhoneNumberId)
            .eq('ativo', true)
            .maybeSingle()

          if (evoCanal) {
            setorCanal = 'evolution_api'
            console.log('[workdesk] Canal detectado: EVOLUTION_API (instancia:', lastPhoneNumberId, ') [busca global de setores]')
          } else {
            setorCanal = 'whatsapp'
            console.log('[workdesk] Canal detectado: WHATSAPP (phone_number_id:', lastPhoneNumberId, ')')
          }
          phoneNumberId = lastPhoneNumberId
        } else {
          setorCanal = 'evolution_api'
          phoneNumberId = lastPhoneNumberId
          console.log('[workdesk] Canal detectado: EVOLUTION_API (sem phone_number_id confirmado)')
        }
      } else if (capturedTicket.setor_id) {
        // Sem indicadores nas mensagens — usar setor_canais
        const { data: canalAtivo } = await supabase
          .from('setor_canais')
          .select('tipo, instancia, phone_number_id')
          .eq('setor_id', capturedTicket.setor_id)
          .eq('ativo', true)
          .order('criado_em', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (canalAtivo) {
          setorCanal = canalAtivo.tipo as typeof setorCanal
          phoneNumberId = canalAtivo.tipo === 'evolution_api'
            ? canalAtivo.instancia
            : canalAtivo.phone_number_id
          console.log('[workdesk] Canal detectado:', setorCanal.toUpperCase(), '(via setor_canais fallback)')
        } else {
          // Legacy fallback: campos diretos da tabela setores
          const { data: setorData } = await supabase
            .from('setores')
            .select('canal, phone_number_id')
            .eq('id', capturedTicket.setor_id)
            .single()
          setorCanal = setorData?.canal || 'whatsapp'
          phoneNumberId = setorData?.phone_number_id || null
          console.log('[workdesk] Canal detectado:', setorCanal.toUpperCase(), '(via setores legacy fallback)')
        }
      }

      // Validate phone_number_id for WhatsApp/Evolution
      if ((setorCanal === 'whatsapp' || setorCanal === 'evolution_api') && !phoneNumberId) {
        console.error('[workdesk] No phone_number_id found for ticket:', capturedTicketId)
        setPendingMessages((prev) => new Map(prev).set(tempId, 'error'))
        toast.error('Nao foi possivel determinar o canal de envio. Nenhum phone_number_id encontrado.')
        return
      }

      // Map canal_envio values for consistent use
      const canalEnvioValue = setorCanal === 'evolution_api' ? 'evolutionapi' : setorCanal

      // Upload file if present
      let fileUrl: string | null = null
      if (hasFile && fileToUpload) {
        setUploadingFile(true)
        fileUrl = await uploadImage(fileToUpload) // uploadImage works for any file
        setUploadingFile(false)

        if (!fileUrl) {
          setPendingMessages((prev) => new Map(prev).set(tempId, 'error'))
          return
        }
      }

      // Prefixo "*Nome do Atendente*:" quando habilitado no setor.
      // Aplica somente se houver texto pra evitar caption vazia em mídia pura.
      if (messageContent && capturedTicket.setor_id) {
        try {
          const { data: setorFlag } = await supabase
            .from('setores')
            .select('prepend_agente_nome')
            .eq('id', capturedTicket.setor_id)
            .maybeSingle()
          if (setorFlag?.prepend_agente_nome && capturedColaborador.nome) {
            messageContent = `*${capturedColaborador.nome}*:\n\n${messageContent}`
          }
        } catch (e) {
          // Coluna pode nao existir em ambientes ainda nao migrados — segue sem prefixo
          console.warn('[workdesk] prepend_agente_nome lookup failed (ignorado):', e)
        }
      }

      // Determine message type
      const messageType = isImage ? 'imagem' : isVideo ? 'video' : isAudio ? 'audio' : hasFile ? 'documento' : 'texto'

      // Add optimistic message to UI
      const optimisticMessage: Mensagem = {
        id: tempId,
        ticket_id: capturedTicketId,
        cliente_id: null,
        remetente: 'colaborador',
  conteudo: messageContent || fileToUpload?.name || '',
  tipo: messageType,
  enviado_em: new Date().toISOString(),
  url_imagem: fileUrl,
  media_type: fileToUpload?.type || null,
  }
  // Only update UI if user is still viewing this ticket
  if (selectedTicketIdRef.current === capturedTicketId) {
    setMensagens((prev) => [...prev, optimisticMessage])
  }
  setPendingMessages((prev) => new Map(prev).set(tempId, 'sending'))

  // Save message to Supabase
  const { data: savedMsg, error: dbError } = await supabase
  .from('mensagens')
  .insert({
  ticket_id: capturedTicketId,
  cliente_id: capturedTicket.cliente_id,
  remetente: 'colaborador',
  conteudo: messageContent || fileToUpload?.name || '',
          tipo: messageType,
          url_imagem: fileUrl,
          media_type: fileToUpload?.type || null,
          phone_number_id: phoneNumberId,
          canal_envio: canalEnvioValue,
          organizacao_id: capturedTicket.organizacao_id || capturedColaborador.organizacao_id,
        })
        .select()
        .single()

      if (dbError || !savedMsg) {
        console.error('[v0] Error saving message to database:', dbError)
        setPendingMessages(prev => new Map(prev).set(tempId, 'error'))
        return
      }
      // Update optimistic message with real ID
      setMensagens(prev => prev.map(m => 
        m.id === tempId ? { ...m, id: savedMsg.id } : m
      ))

      // Send via the appropriate channel API
      try {
        let sendUrl = '/api/whatsapp/send'
        let sendBody: Record<string, any> = {}

        if (setorCanal === 'evolution_api') {
          sendUrl = '/api/evolution/send'
          sendBody = {
            ticketId: capturedTicketId,
            message: messageContent,
            messageId: savedMsg.id,
            instanceName: phoneNumberId,
            fileUrl: fileUrl,
            fileType: fileToUpload?.type || null,
            fileName: fileToUpload?.name || null,
          }
        } else {
          sendBody = {
            recipientPhone: capturedTicket.clientes.telefone,
            message: messageContent,
            ticketId: capturedTicketId,
            phoneNumberId: phoneNumberId,
            fileUrl: fileUrl,
            fileType: fileToUpload?.type || null,
            messageId: savedMsg.id,
          }
        }

        console.log(`[workdesk] Enviando via ${setorCanal.toUpperCase()} → ${sendUrl}`, sendBody)

        const response = await fetch(sendUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sendBody),
        })
        
        const result = await response.json()
        
        console.log(`[workdesk] Resposta ${sendUrl} (status ${response.status}):`, result)

        if (!response.ok) {
          console.error('[workdesk] Send API failed:', result)

          // Aviso especial para dispositivo offline (Evolution API)
          if (result?.deviceOffline) {
            toast.error('📱 Dispositivo desconectado! A mensagem não foi enviada porque o WhatsApp do dispositivo está offline. Verifique a conexão.', {
              duration: 8000,
            })
          } else {
            const errorMsg = result?.details?.message || result?.error || 'Erro ao enviar mensagem'
            toast.error(errorMsg)
          }

          setPendingMessages(prev => new Map(prev).set(tempId, 'error'))
          return
        }
      } catch (sendError) {
        console.error('[v0] Send request failed:', sendError)
        toast.error('Erro de conexao ao enviar mensagem')
        setPendingMessages(prev => new Map(prev).set(tempId, 'error'))
        return
      }
      
// Mark as sent
  setPendingMessages(prev => new Map(prev).set(tempId, 'sent'))
  
  // Update ticket's last message and move to top (like WhatsApp)
  const now = new Date().toISOString()
  setTickets((prev) => {
    const updated = prev.map((t) => 
      t.id === capturedTicketId
        ? { ...t, ultima_mensagem: messageContent || 'Arquivo enviado', ultima_mensagem_em: now, ultima_mensagem_remetente: 'colaborador' as const }
        : t
    )
    // Sort by ultima_mensagem_em descending (most recent first)
    return updated.sort((a, b) => 
      new Date(b.ultima_mensagem_em || b.criado_em).getTime() - 
      new Date(a.ultima_mensagem_em || a.criado_em).getTime()
    )
  })
  
  // Auto start attendance if ticket is open
      if (capturedTicket.status === 'aberto') {
        const { error: updateError } = await supabase
          .from('tickets')
          .update({ 
            status: 'em_atendimento',
            colaborador_id: colaborador.id,
            primeira_resposta_em: new Date().toISOString()
          })
          .eq('id', capturedTicketId)
        
        if (!updateError) {
          const now = new Date().toISOString()
          // Atualiza o selectedTicket localmente sem refetch
          setSelectedTicket(prev =>
            prev?.id === capturedTicketId
              ? { ...prev, status: 'em_atendimento', colaborador_id: colaborador.id, primeira_resposta_em: now }
              : prev
          )
          // Atualiza a lista de tickets localmente sem disparar N+1 queries
          startTransition(() => {
            setTickets(prev =>
              prev.map(t =>
                t.id === capturedTicketId
                  ? { ...t, status: 'em_atendimento', colaborador_id: colaborador.id, primeira_resposta_em: now }
                  : t
              )
            )
          })
        }
      } else if (!capturedTicket.primeira_resposta_em) {
        // Update first response time if not already set
        await supabase
          .from('tickets')
          .update({ primeira_resposta_em: new Date().toISOString() })
          .eq('id', capturedTicketId)
      }
      
      // After 2 seconds, silently refresh to get real message ID (sem loading spinner)
      setTimeout(() => {
        if (selectedTicketIdRef.current === capturedTicketId) {
          fetchMensagens(capturedTicketId, capturedTicket.cliente_id, { silent: true })
        }
        setPendingMessages(prev => {
          const newMap = new Map(prev)
          newMap.delete(tempId)
          return newMap
        })
      }, 2000)
      
    } catch (error: any) {
      setPendingMessages(prev => new Map(prev).set(tempId, 'error'))
    }
  }
  
  // Handle Enter key to send message
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleSendMessage])

  // Get message icon based on type
  const getMessageIcon = (tipo: string) => {
    switch (tipo) {
      case 'imagem':
        return <ImageIcon className="h-4 w-4" />
      case 'audio':
        return <Mic className="h-4 w-4" />
      case 'video':
        return <Video className="h-4 w-4" />
      case 'documento':
        return <FileText className="h-4 w-4" />
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-page-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          <p className="text-muted-foreground/80 text-sm">Carregando tickets...</p>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
    <div className="flex h-full flex-col overflow-hidden">
      {/* Mobile top bar — only shows on small screens */}
      <div className="flex items-center justify-between border-b border-foreground/6 bg-page-bg/90 backdrop-blur-xl px-3 py-2 md:hidden">
        <span className="text-sm font-semibold text-foreground/70">Tickets</span>
        <Badge variant="outline" className="text-[10px] tabular-nums">
          {filteredTickets.length}
        </Badge>
      </div>

      <div className="flex flex-1 overflow-hidden w-full max-w-full">
        {/* ═══════════════════════════════════════════════════════════════════════
            COLUMN 1 — Ticket List (340px)
           ═══════════════════════════════════════════════════════════════════════ */}
        <aside className={cn(
          "w-full md:w-[340px] shrink-0 border-r border-foreground/5 bg-page-bg/60 backdrop-blur-xl h-full overflow-hidden flex flex-col",
          selectedTicket ? "hidden md:flex" : "flex"
        )}>
          {/* Top section: Disparo + Search */}
          <div className="p-3 space-y-2 shrink-0 border-b border-foreground/5">
            {/* Disparo Button - for WhatsApp and/or EvolutionAPI */}
            {novoDisparoEnabled && (setorCanaisAtivos.includes('whatsapp') || setorCanaisAtivos.includes('evolution_api') ||
              setorCanalConfig !== 'evolution_api') && (
              <Button
                onClick={async () => {
                  if (colaborador?.setor_id) {
                    try {
                      const res = await fetch(`/api/whatsapp/dispatch/count?setorId=${colaborador.setor_id}`)
                      const data = await res.json()
                      if (data.blocked) {
                        setDisparoLimitBlocked(true)
                        setDisparoLimitInfo(`Limite diario atingido (${data.used}/${data.limit})`)
                        toast.error(`Limite de disparos atingido (${data.used}/${data.limit}). Tente novamente amanha.`)
                        return
                      }
                      setDisparoLimitBlocked(false)
                      setDisparoLimitInfo(data.limit > 0 ? `${data.used}/${data.limit} hoje` : '')
                    } catch {}
                  }
                  resetDisparo()
                  setDisparoDialogOpen(true)
                }}
                className="w-full gap-2 btn-glow h-9 text-xs rounded-lg"
                size="sm"
              >
                <Megaphone className="h-3.5 w-3.5" />
                Novo Disparo
              </Button>
            )}

            {/* Subsetor Picker */}
            {subsetoresDisponiveis.length > 0 && (
              <Popover open={subsetorPickerOpen} onOpenChange={setSubsetorPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between h-8 text-xs px-2 font-normal hover:bg-foreground/5 text-muted-foreground"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
                      <span className="truncate text-muted-foreground/80">
                        {meusSubsetorIds.length === 0
                          ? 'Nenhum subsetor'
                          : meusSubsetorIds.length === subsetoresDisponiveis.length
                          ? 'Todos subsetores'
                          : `${meusSubsetorIds.length} subsetor${meusSubsetorIds.length > 1 ? 'es' : ''}`}
                      </span>
                    </div>
                    <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground/80" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <p className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider mb-2 px-1">
                    Meus Subsetores
                  </p>
                  <div className="space-y-0.5">
                    {subsetoresDisponiveis.map((subsetor) => {
                      const isActive = meusSubsetorIds.includes(subsetor.id)
                      return (
                        <label
                          key={subsetor.id}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-foreground/[0.05] cursor-pointer"
                        >
                          <Checkbox
                            checked={isActive}
                            disabled={togglingSubsetor}
                            onCheckedChange={() =>
                              toggleMeuSubsetor(subsetor.id, subsetor.setor_id || '')
                            }
                          />
                          <span className="text-sm">{subsetor.nome}</span>
                        </label>
                      )
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Ticket List */}
          <div className="flex-1 overflow-hidden">
            <TicketList
              tickets={filteredTickets}
              selectedTicket={selectedTicket}
              onSelectTicket={handleSelectTicket}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              prioridadeFilter={prioridadeFilter}
              setPrioridadeFilter={setPrioridadeFilter}
              subsetorFilter={subsetorFilter}
              setSubsetorFilter={setSubsetorFilter}
              subsetoresDisponiveis={subsetoresDisponiveis}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              unreadCounts={unreadCounts}
              setorCanal={setorCanalConfig}
            />
          </div>
        </aside>

        {/* ═══════════════════════════════════════════════════════════════════════
            COLUMN 2 — Chat (center, flex-1)
           ═══════════════════════════════════════════════════════════════════════ */}
        <main className={cn(
          "flex-1 flex-col overflow-hidden min-w-0",
          selectedTicket ? "flex" : "hidden md:flex"
        )}>
          {selectedTicket ? (
            <>
              {/* Chat Header — compact */}
              <div className="shrink-0 flex items-center justify-between border-b border-foreground/5 bg-page-bg/80 backdrop-blur-xl px-4 py-2.5 gap-3">
                {/* Left: back button (mobile) + client info */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {/* Mobile back button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 md:hidden h-8 w-8"
                    onClick={() => {
                      setSelectedTicket(null)
                      selectedTicketIdRef.current = null
                    }}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <h2 className="text-sm font-semibold text-foreground/90 truncate">{selectedTicket.clientes.nome}</h2>
                      <Badge
                        variant={selectedTicket.status === 'aberto' ? 'default' : 'secondary'}
                        className={cn(
                          'text-[9px] px-1.5 py-0 shrink-0',
                          selectedTicket.status === 'aberto' && 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                          selectedTicket.status === 'em_atendimento' && 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        )}
                      >
                        {selectedTicket.status === 'aberto' ? 'Aberto' : 'Atendendo'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground/80">
                      <span className="font-mono">#{selectedTicket.numero}</span>
                      {selectedTicket.setores && (
                        <>
                          <span className="text-muted-foreground/30">|</span>
                          <span style={{ color: selectedTicket.setores.cor || '#6b7280' }}>
                            {selectedTicket.setores.nome}
                          </span>
                        </>
                      )}
                      <span className="text-muted-foreground/30">|</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(selectedTicket.criado_em), { locale: ptBR, addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Atender — only when ticket is aberto */}
                  {selectedTicket.status === 'aberto' && (
                    <Button
                      size="sm"
                      onClick={handleMarcarEmAtendimento}
                      className="gap-1.5 btn-glow h-8 text-xs"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Atender
                    </Button>
                  )}

                  {/* Transfer */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={openTransferDialog}
                        className="h-8 w-8 bg-transparent"
                      >
                        <ArrowRightLeft className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p>Transferir</p></TooltipContent>
                  </Tooltip>

                  {/* Encerrar */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => setEncerrarDialogOpen(true)}
                        disabled={selectedTicket?.is_disparo && !isDisparoEncerrarEnabled(selectedTicket)}
                        className="h-8 w-8"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p>Encerrar</p></TooltipContent>
                  </Tooltip>

                  {/* Toggle Client Info Panel (desktop) */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowClientPanel(!showClientPanel)}
                        className="h-8 w-8 hidden md:flex"
                      >
                        {showClientPanel ? (
                          <PanelRightClose className="h-4 w-4" />
                        ) : (
                          <PanelRightOpen className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>{showClientPanel ? 'Ocultar painel' : 'Dados do cliente'}</p>
                    </TooltipContent>
                  </Tooltip>

                  {/* Client info button (mobile) — opens sheet */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMobileDrawerOpen(true)}
                    className="h-8 w-8 md:hidden"
                  >
                    <Info className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-hidden min-w-0">
                <div ref={messagesContainerRef} className="h-full overflow-y-auto overflow-x-hidden">
                  <div className="p-4 min-w-0">
                  {loadingMensagens ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  ) : mensagens.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-muted-foreground/80">
                      <MessageCircle className="mb-2 h-12 w-12 opacity-50" />
                      <p>Nenhuma mensagem ainda</p>
                    </div>
) : (
                    <div className="space-y-4">
                      <AnimatePresence>
                        {(() => {
                          // Garante que mensagens do ticket atual sempre venham por último,
                          // evitando que mensagens recebidas via real-time de outros tickets
                          // apareçam depois do ticket atual e sejam classificadas como "anteriores".
                          const mensagensOrdenadas = selectedTicket
                            ? [
                                ...mensagens.filter((m) => m.ticket_id !== selectedTicket.id),
                                ...mensagens.filter((m) => m.ticket_id === selectedTicket.id),
                              ]
                            : mensagens

                          let lastTicketId: string | null = null
                          return mensagensOrdenadas.map((msg, index) => {
                            const msgStatus = pendingMessages.get(msg.id)
                            const isNewTicket = msg.ticket_id !== lastTicketId
                            const isCurrentTicket = msg.ticket_id === selectedTicket?.id
                            const isPreviousTicket = !isCurrentTicket && isNewTicket
                            lastTicketId = msg.ticket_id

                            return (
                              <React.Fragment key={msg.id}>
                                {/* Ticket separator for history */}
                                {isPreviousTicket && (
                                  <div className="flex items-center gap-3 py-3">
                                    <div className="flex-1 h-px bg-border" />
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-foreground/[0.03] border border-foreground/8 text-xs text-muted-foreground/80">
                                      <History className="h-3 w-3" />
                                      <span>
                                        Atendimento anterior -{' '}
                                        {(msg.tickets?.criado_em || msg.enviado_em)
                                          ? new Date(msg.tickets?.criado_em || msg.enviado_em).toLocaleDateString('pt-BR', {
                                              day: '2-digit',
                                              month: '2-digit',
                                              year: '2-digit',
                                            })
                                          : 'Data desconhecida'}
                                      </span>
                                      {msg.tickets?.status === 'encerrado' && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                          Finalizado
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex-1 h-px bg-border" />
                                  </div>
                                )}
                                {/* Current ticket separator */}
                                {isNewTicket && isCurrentTicket && index > 0 && (
                                  <div className="flex items-center gap-3 py-3">
                                    <div className="flex-1 h-px bg-emerald-500/30" />
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-medium">
                                      <MessageCircle className="h-3 w-3" />
                                      <span>Atendimento atual</span>
                                    </div>
                                    <div className="flex-1 h-px bg-emerald-500/30" />
                                  </div>
                                )}
                                {msg.remetente === 'sistema' ? (
                                  <motion.div
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex justify-center"
                                  >
                                    <div className={cn(
                                      "flex items-center gap-2 px-4 py-2 rounded-lg border text-xs max-w-[90%]",
                                      msg.conteudo.startsWith('Transferido')
                                        ? "bg-blue-500/5 border-blue-500/20 text-blue-400"
                                        : "bg-foreground/[0.03] border-foreground/8 text-muted-foreground/80"
                                    )}>
                                      {msg.conteudo.startsWith('Transferido') ? (
                                        <ArrowRightLeft className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                                      ) : (
                                        <Megaphone className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                                      )}
                                      <span>{msg.conteudo}</span>
                                      {msg.enviado_em && (
                                        <span className="shrink-0 ml-1 opacity-60">
                                          {new Date(msg.enviado_em).toLocaleTimeString('pt-BR', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          })}
                                        </span>
                                      )}
                                    </div>
                                  </motion.div>
                                ) : (
                                <motion.div
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className={cn(
                                    'flex',
                                    isOutgoingMessage(msg.remetente) ? 'justify-end' : 'justify-start',
                                    !isCurrentTicket && 'opacity-60'
                                  )}
                                >
                                  <div
                                    className={cn(
                                      'max-w-[85%] lg:max-w-[75%] rounded-2xl px-3 py-2 lg:px-4 lg:py-2.5 break-all overflow-hidden',
                                      isOutgoingMessage(msg.remetente)
                                        ? 'brand-gradient text-white rounded-br-md shadow-lg shadow-emerald-500/10'
                                        : 'bg-foreground/[0.05] text-foreground/90 rounded-bl-md border border-foreground/6',
                                      msgStatus === 'error' && 'bg-red-500 text-white'
                                    )}
                                  >
                        {msg.url_imagem && (
                          <MessageMedia
                            url={msg.url_imagem}
                            mediaType={msg.media_type}
                            tipo={msg.tipo}
                            conteudo={msg.conteudo}
                            isOutgoing={isOutgoingMessage(msg.remetente)}
                          />
                        )}
                        {msg.tipo !== 'texto' && !msg.url_imagem && msg.media_type !== 'contact' && (
                          <div className="mb-1 flex items-center gap-1 text-xs opacity-70">
                            {getMessageIcon(msg.tipo)}
                            <span className="capitalize">{msg.tipo}</span>
                          </div>
                        )}
                        {(() => {
                          const out = isOutgoingMessage(msg.remetente)
                          // 1) Tenta interpretar payload Baileys/Evolution (reação, contato, localização, enquete, etc.)
                          const parsed = parseMessageContent(msg.conteudo)
                          if (parsed.kind !== 'text' && parsed.kind !== 'protocol') {
                            return <SpecialMessageContent conteudo={msg.conteudo} isOutgoing={out} />
                          }
                          // 2) Legacy: backend já marcou media_type=contact
                          if (msg.media_type === 'contact' && msg.conteudo) {
                            return <ContactCard conteudo={msg.conteudo} isOutgoing={out} />
                          }
                          // 3) Texto puro
                          const isMedia = msg.tipo === 'documento' || msg.tipo === 'audio' || msg.tipo === 'video' || msg.url_imagem?.toLowerCase().endsWith('.pdf')
                          if (msg.conteudo && !isMedia) {
                            return <p className="text-sm whitespace-pre-wrap">{renderTextWithLinks(msg.conteudo, out)}</p>
                          }
                          return null
                        })()}
                                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-60">
                                      <span>
                                        {new Date(msg.enviado_em).toLocaleTimeString('pt-BR', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </span>
                                      {isOutgoingMessage(msg.remetente) && (
                                        <>
                                          {msgStatus === 'sending' && <Clock className="h-3 w-3 animate-pulse" />}
                                          {msgStatus === 'sent' && <Check className="h-3 w-3" />}
                                          {msgStatus === 'error' && <AlertTriangle className="h-3 w-3" />}
                                          {!msgStatus && <CheckCheck className="h-3 w-3" />}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                                )}
                              </React.Fragment>
                            )
                          })
                        })()}
                      </AnimatePresence>
                    </div>
                  )}
                  </div>
                </div>
              </div>

  {/* Input Area */}
  <div className="shrink-0 border-t border-foreground/6 glass-header p-3">
  {/* Disparo locked warning */}
  {selectedTicket?.is_disparo && isDisparoLocked(selectedTicket) && (
  <div className="mb-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
  <div className="flex items-center gap-2 text-blue-400">
  <Lock className="h-4 w-4" />
  <span className="text-sm font-medium">Aguardando resposta do cliente</span>
  </div>
  <p className="text-xs text-blue-400/60 mt-1">
  O template foi enviado. O chat sera liberado quando o cliente responder.
  </p>
  {selectedTicket.disparo_em && (
  <DisparoTimer dispatchTime={selectedTicket.disparo_em} />
  )}
  </div>
  )}
  {/* 24h Window Expired Warning */}
  {isWindowExpired && !(selectedTicket?.is_disparo && isDisparoLocked(selectedTicket)) && (
  <div className="mb-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
  <div className="flex items-center gap-2 text-amber-400">
  <AlertTriangle className="h-4 w-4" />
  <span className="text-sm font-medium">Janela de 24 horas expirada</span>
  </div>
  <p className="text-xs text-amber-400/60 mt-1">
  A ultima mensagem foi ha mais de 24 horas. Encerre este ticket e aguarde um novo contato do cliente.
  </p>
  </div>
  )}

                {/* Template Suggestions */}
                {showTemplates && filteredTemplates.length > 0 && (
                  <div className="mb-2 max-h-48 overflow-y-auto rounded-lg border border-foreground/8 bg-[#0a0d16] shadow-lg shadow-black/40">
                    {filteredTemplates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => selectTemplate(template)}
                        className="w-full px-3 py-2 text-left hover:bg-foreground/[0.05] transition-colors border-b border-foreground/6 last:border-b-0"
                      >
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-semibold text-emerald-400">/{template.atalho}</code>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {template.mensagem}
                        </p>
                      </button>
                    ))}
                  </div>
                )}

{/* Emoji Picker */}
                  {showEmojiPicker && (
                    <div className="mb-2 flex flex-wrap gap-1 rounded-lg border bg-foreground/[0.03] p-2">
                      {commonEmojis.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => insertEmoji(emoji)}
                          className="rounded p-1.5 text-lg hover:bg-foreground/[0.08] transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Hidden file input */}
<input
  type="file"
  ref={fileInputRef}
  onChange={handleFileInputChange}
  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.xml,.json,.csv,.zip,.rar,.7z,.tar,.gz,.cer,.crt,.pem,.p12,.pfx,.key"
  className="hidden"
  />

{/* File Preview */}
                    {filePreview && (
                      <div className="mb-2 p-2 bg-foreground/[0.02] rounded-lg border border-foreground/6">
                        <div className="relative inline-block">
  {filePreview.startsWith('file:') ? (
  (() => { const { icon: FIcon, label, color, bg, border } = getFileInfo(filePreview.replace('file:', '').split('.').pop() || '', selectedFile?.type); return (
  <div className={cn('flex items-center gap-2 px-3 py-2 rounded border', bg, border)}>
    <FIcon className={cn('h-6 w-6', color)} />
    <span className="text-sm text-foreground/80 max-w-[200px] truncate">{filePreview.replace('file:', '')}</span>
  </div>) })()
  ) : filePreview.startsWith('video:') ? (
  <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 rounded border border-blue-500/20">
  <Video className="h-6 w-6 text-blue-400" />
  <span className="text-sm text-foreground/80">{filePreview.replace('video:', '')}</span>
  </div>
  ) : (
  <img
  src={filePreview || '/placeholder.svg'}
  alt="Preview"
  className="max-h-32 rounded object-contain"
  />
  )}
  <Button
                            variant="destructive"
                            size="icon"
                            className="absolute -right-2 -top-2 h-5 w-5"
                            onClick={clearSelectedFile}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}

                  <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="shrink-0"
                      >
                        <Smile className="h-5 w-5 text-muted-foreground/80" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
  onClick={() => fileInputRef.current?.click()}
  className="shrink-0"
  disabled={isWindowExpired || (selectedTicket?.is_disparo === true && isDisparoLocked(selectedTicket))}
                      >
                        <ImageIcon className="h-5 w-5 text-muted-foreground/80" />
                      </Button>
                      <div className="relative flex-1">
                  <Input
                  value={messageInput}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyPress}
                  onPaste={handlePaste}
                  placeholder={(selectedTicket?.is_disparo && isDisparoLocked(selectedTicket)) ? 'Aguardando resposta do cliente...' : isWindowExpired ? 'Janela expirada - Encerre o ticket' : 'Digite / para atalhos...'}
                  className="w-full"
                  disabled={isWindowExpired || (selectedTicket?.is_disparo === true && isDisparoLocked(selectedTicket))}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-gramm="false"
                  data-gramm_editor="false"
                  data-enable-grammarly="false"
                  data-ms-editor="false"
                  />
                      </div>
                      <Button
                        size="icon"
                        onClick={handleSendMessage}
                        disabled={(!messageInput.trim() && !selectedFile) || isWindowExpired || uploadingFile || (selectedTicket?.is_disparo === true && isDisparoLocked(selectedTicket))}
                        className="shrink-0"
                      >
                      {uploadingFile ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                  </div>
                </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground/[0.03] border border-foreground/6 mb-4">
                <MessageCircle className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h2 className="text-lg font-semibold text-muted-foreground">Selecione um ticket</h2>
              <p className="mt-1 text-sm text-muted-foreground/50">Escolha um ticket na lista para iniciar o atendimento</p>
            </div>
          )}
        </main>

        {/* ═══════════════════════════════════════════════════���═══════════════════
            COLUMN 3 — Client Info Panel (right, 280px, collapsible)
           ═════════════════════════════════════════════════���═════════════════════ */}
        {showClientPanel && selectedTicket && (
          <aside className="hidden md:flex w-[280px] shrink-0 border-l border-foreground/5 bg-page-bg/60 backdrop-blur-xl overflow-y-auto flex-col">
            <div className="p-4 space-y-5">
              {/* Client Card */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
                    <UserCircle className="h-6 w-6 text-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground/90 truncate">{selectedTicket.clientes.nome || 'Sem nome'}</p>
                    {selectedTicket.clientes.telefone && (
                      <p className="text-xs text-muted-foreground/80 truncate">{formatPhone(selectedTicket.clientes.telefone)}</p>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-7 text-[10px] gap-1 border-amber-400/30 text-amber-400 hover:bg-amber-500/10"
                    onClick={handleAbrirEditarCliente}
                  >
                    <Pencil className="h-3 w-3" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-7 text-[10px] gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                    onClick={() => {
                      setSelecionarClienteCnpj('')
                      setSelecionarClienteData(null)
                      setSelecionarClienteDialogOpen(true)
                    }}
                  >
                    <Search className="h-3 w-3" />
                    {clienteTemCNPJ ? 'Trocar' : 'Selecionar'}
                  </Button>
                </div>
              </div>

              {/* Client Details */}
              <div>
                <h4 className="text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-wider mb-2">
                  Dados do Cliente
                </h4>
                <div className="rounded-lg border border-foreground/6 bg-foreground/[0.02] divide-y divide-white/6 overflow-hidden text-xs">
                  <div className="flex items-center justify-between px-2.5 py-1.5 gap-2">
                    <span className="text-muted-foreground/80 shrink-0 w-16">CNPJ</span>
                    <span className="font-medium text-foreground/80 flex-1 text-right truncate">
                      {selectedTicket.clientes.CNPJ ? formatCNPJ(selectedTicket.clientes.CNPJ) : '—'}
                    </span>
                    {selectedTicket.clientes.CNPJ && (
                      <button type="button" onClick={() => copyToClipboard(selectedTicket.clientes.CNPJ!.replace(/\D/g, ''), 'CNPJ')} className="shrink-0 text-muted-foreground/60 hover:text-foreground/60 transition-colors">
                        <Copy className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between px-2.5 py-1.5 gap-2">
                    <span className="text-muted-foreground/80 shrink-0 w-16">Registro</span>
                    <span className="font-medium text-foreground/80 flex-1 text-right truncate">
                      {selectedTicket.clientes.Registro || '—'}
                    </span>
                    {selectedTicket.clientes.Registro && (
                      <button type="button" onClick={() => copyToClipboard(selectedTicket.clientes.Registro!, 'Registro')} className="shrink-0 text-muted-foreground/60 hover:text-foreground/60 transition-colors">
                        <Copy className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between px-2.5 py-1.5 gap-2">
                    <span className="text-muted-foreground/80 shrink-0 w-16">Email</span>
                    <span className="font-medium text-foreground/80 flex-1 text-right truncate">
                      {selectedTicket.clientes.email || '—'}
                    </span>
                    {selectedTicket.clientes.email && (
                      <button type="button" onClick={() => copyToClipboard(selectedTicket.clientes.email!, 'Email')} className="shrink-0 text-muted-foreground/60 hover:text-foreground/60 transition-colors">
                        <Copy className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between px-2.5 py-1.5 gap-2">
                    <span className="text-muted-foreground/80 shrink-0 w-16">Telefone</span>
                    <span className="font-medium text-foreground/80 flex-1 text-right truncate">
                      {selectedTicket.clientes.telefone ? formatPhone(selectedTicket.clientes.telefone) : '—'}
                    </span>
                    {selectedTicket.clientes.telefone && (
                      <button type="button" onClick={() => copyToClipboard(selectedTicket.clientes.telefone!, 'Telefone')} className="shrink-0 text-muted-foreground/60 hover:text-foreground/60 transition-colors">
                        <Copy className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  {selectedTicket.clientes.created_at && (
                    <div className="flex items-center justify-between px-2.5 py-1.5 gap-2">
                      <span className="text-muted-foreground/80 shrink-0 w-16">Desde</span>
                      <span className="font-medium text-foreground/80 flex-1 text-right">
                        {format(new Date(selectedTicket.clientes.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Ticket Info */}
              <div>
                <h4 className="text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-wider mb-2">
                  Info do Ticket
                </h4>
                <div className="rounded-lg border border-foreground/6 bg-foreground/[0.02] divide-y divide-white/6 overflow-hidden text-xs">
                  <div className="flex items-center justify-between px-2.5 py-1.5 gap-2">
                    <span className="text-muted-foreground/80 shrink-0 w-16">Ticket</span>
                    <span className="font-bold text-foreground/90 flex-1 text-right select-all">#{selectedTicket.numero}</span>
                  </div>
                  <div className="flex items-center justify-between px-2.5 py-1.5 gap-2">
                    <span className="text-muted-foreground/80 shrink-0 w-16">Prioridade</span>
                    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-4', selectedTicket.prioridade === 'urgente' && 'border-red-500/30 text-red-400')}>
                      {selectedTicket.prioridade === 'urgente' ? 'Urgente' : 'Normal'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between px-2.5 py-1.5 gap-2">
                    <span className="text-muted-foreground/80 shrink-0 w-16">Canal</span>
                    <span className="font-medium text-foreground/80 capitalize">{selectedTicket.canal}</span>
                  </div>
                  <div className="flex items-center justify-between px-2.5 py-1.5 gap-2">
                    <span className="text-muted-foreground/80 shrink-0 w-16">Criado em</span>
                    <span className="font-medium text-foreground/80">
                      {new Date(selectedTicket.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {selectedTicket.primeira_resposta_em && (
                    <div className="flex items-center justify-between px-2.5 py-1.5 gap-2">
                      <span className="text-muted-foreground/80 shrink-0 w-16">1a Resposta</span>
                      <span className="font-medium text-foreground/80">
                        {formatDistanceToNow(new Date(selectedTicket.primeira_resposta_em), { locale: ptBR, addSuffix: true })}
                      </span>
                    </div>
                  )}
                  {selectedTicket.setores && (
                    <div className="flex items-center justify-between px-2.5 py-1.5 gap-2">
                      <span className="text-muted-foreground/80 shrink-0 w-16">Setor</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-medium" style={{ borderColor: selectedTicket.setores.cor || '#6b7280', color: selectedTicket.setores.cor || '#6b7280' }}>
                        {selectedTicket.setores.nome}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Mobile Client Info Sheet — only rendered on mobile via md:hidden trigger in chat header */}
      <Sheet open={!!selectedTicket && mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
        <SheetContent side="right" className="w-[300px] p-0">
          <SheetTitle className="sr-only">Dados do Cliente</SheetTitle>
          {selectedTicket && (
            <div className="p-4 space-y-4 overflow-y-auto h-full">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
                  <UserCircle className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground/90 truncate">{selectedTicket.clientes.nome}</p>
                  {selectedTicket.clientes.telefone && (
                    <p className="text-xs text-muted-foreground/80">{formatPhone(selectedTicket.clientes.telefone)}</p>
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-foreground/6 bg-foreground/[0.02] divide-y divide-white/6 text-xs">
                {selectedTicket.clientes.CNPJ && (
                  <div className="flex items-center justify-between px-2.5 py-1.5 gap-2">
                    <span className="text-muted-foreground/80 w-16">CNPJ</span>
                    <span className="text-foreground/80 truncate">{formatCNPJ(selectedTicket.clientes.CNPJ)}</span>
                  </div>
                )}
                {selectedTicket.clientes.Registro && (
                  <div className="flex items-center justify-between px-2.5 py-1.5 gap-2">
                    <span className="text-muted-foreground/80 w-16">Registro</span>
                    <span className="text-foreground/80 truncate">{selectedTicket.clientes.Registro}</span>
                  </div>
                )}
                {selectedTicket.clientes.email && (
                  <div className="flex items-center justify-between px-2.5 py-1.5 gap-2">
                    <span className="text-muted-foreground/80 w-16">Email</span>
                    <span className="text-foreground/80 truncate">{selectedTicket.clientes.email}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px] gap-1" onClick={handleAbrirEditarCliente}>
                  <Pencil className="h-3 w-3" /> Editar
                </Button>
                <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px] gap-1" onClick={() => { setSelecionarClienteCnpj(''); setSelecionarClienteData(null); setSelecionarClienteDialogOpen(true) }}>
                  <Search className="h-3 w-3" /> {clienteTemCNPJ ? 'Trocar' : 'Selecionar'}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Encerrar Dialog */}
      <AlertDialog open={encerrarDialogOpen} onOpenChange={setEncerrarDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Encerrar ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja encerrar este ticket? O cliente será notificado e o ticket
              será movido para o histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarEncerrar}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              ✅ Confirmar Encerramento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={(open) => { setTransferDialogOpen(open); if (!open) setTransferLoading(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Transferir Ticket
            </DialogTitle>
            <DialogDescription>
              Transfira este ticket para outro setor ou atendente.
            </DialogDescription>
          </DialogHeader>
          
          {transferDataLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
          <Tabs defaultValue="atendente" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="atendente">👤 Atendente</TabsTrigger>
              <TabsTrigger value="setor">🏢 Setor</TabsTrigger>
            </TabsList>

<TabsContent value="atendente" className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Selecione um atendente do setor atual</Label>
                      <Select
                        value={selectedAtendenteTransfer}
                        onValueChange={setSelectedAtendenteTransfer}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Escolha um atendente..." />
                        </SelectTrigger>
                        <SelectContent>
                          {atendentesDisponiveis.map((atendente) => {
                            const online = isAtendenteOnline(atendente)
                            return (
                              <SelectItem
                                key={atendente.id}
                                value={atendente.id}
                                disabled={!online}
                              >
                                <div className="flex items-center gap-2 w-full">
                                  <span
                                    className={cn(
                                      'h-2 w-2 rounded-full shrink-0',
                                      online ? 'bg-green-500' : 'bg-foreground/30'
                                    )}
                                  />
                                  <span className={cn('flex-1', !online ? 'text-muted-foreground/80' : '')}>
                                    {atendente.nome}
                                  </span>
                                  {atendente.handlesSubsetor && selectedTicket?.subsetor_id && (
                                    <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-auto shrink-0">
                                      {selectedTicket.subsetores?.nome}
                                    </Badge>
                                  )}
                                  {!online && (
                                    <span className="text-xs text-muted-foreground/80">(Offline)</span>
                                  )}
                                </div>
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                      {atendentesDisponiveis.length === 0 && (
                        <p className="text-sm text-muted-foreground/80">
                          Nenhum outro atendente neste setor.
                        </p>
                      )}
                      {atendentesDisponiveis.length > 0 &&
                        !atendentesDisponiveis.some((a) => isAtendenteOnline(a)) && (
                          <p className="text-sm text-amber-600">
                            Todos os atendentes estao offline.
                          </p>
                        )}
                    </div>

  <Button
  onClick={handleTransferTicket}
  disabled={
  !selectedAtendenteTransfer ||
  selectedAtendenteTransfer === 'all' ||
  transferLoading ||
  !isAtendenteOnline(atendentesDisponiveis.find((a) => a.id === selectedAtendenteTransfer))
  }
  className="w-full"
  >
  {transferLoading ? 'Transferindo...' : 'Transferir para Atendente'}
  </Button>
  {selectedAtendenteTransfer && selectedAtendenteTransfer !== 'all' && !isAtendenteOnline(atendentesDisponiveis.find((a) => a.id === selectedAtendenteTransfer)) && (
  <p className="text-sm text-destructive">
  Este atendente esta offline. Selecione um atendente online.
  </p>
  )}
  </TabsContent>
  
  <TabsContent value="setor" className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Selecione o setor de destino</Label>
                      <Select value={selectedSetorTransfer} onValueChange={handleSetorChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Escolha um setor..." />
                        </SelectTrigger>
                        <SelectContent>
                          {setores.length === 0 ? (
                            <div className="p-3 text-sm text-muted-foreground/80 text-center">
                              Nenhum setor habilitado para transferência. Configure em Configurações do Setor.
                            </div>
                          ) : (
                            setores.map((setor) => (
                              <SelectItem key={setor.id} value={setor.id}>
                                {setor.nome}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {setores.length === 0 && (
                        <p className="text-sm text-muted-foreground/80">
                          Nenhum setor habilitado. Configure os destinos em Configurações do Setor.
                        </p>
                      )}
                    </div>

                    {selectedSetorTransfer !== 'all' && (
                      <div className="space-y-2">
                        <Label>Atribuir a um atendente (opcional)</Label>
                        <Select
                          value={selectedAtendenteTransfer}
                          onValueChange={setSelectedAtendenteTransfer}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Deixar na fila do setor..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-blue-500" />
                                Deixar na fila (atribuir automaticamente)
                              </div>
                            </SelectItem>
                            {atendentesDisponiveis.map((atendente) => {
                              const online = isAtendenteOnline(atendente)
                              return (
                                <SelectItem
                                  key={atendente.id}
                                  value={atendente.id}
                                  disabled={!online}
                                >
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={cn(
                                        'h-2 w-2 rounded-full',
                                        online ? 'bg-green-500' : 'bg-foreground/30'
                                      )}
                                    />
                                    <span className={!online ? 'text-muted-foreground/80' : ''}>
                                      {atendente.nome}
                                    </span>
                                    {!online && (
                                      <span className="text-xs text-muted-foreground/80">(Offline)</span>
                                    )}
                                  </div>
                                </SelectItem>
                              )
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {selectedSetorTransfer !== 'all' &&
                      atendentesDisponiveis.length > 0 &&
                      !atendentesDisponiveis.some((a) => isAtendenteOnline(a)) && (
                        <p className="text-sm text-blue-400 bg-blue-500/5 p-2 rounded-md border border-blue-500/10">
                          Nenhum atendente online neste setor. O ticket ira para a fila e sera
                          atribuido automaticamente quando alguem ficar online.
                        </p>
                      )}

                    <Button
                      onClick={handleTransferTicket}
                      disabled={
                        !selectedSetorTransfer || selectedSetorTransfer === 'all' || transferLoading
                      }
                      className="w-full"
                    >
                      {transferLoading ? 'Transferindo...' : 'Transferir para Setor'}
                    </Button>
                  </TabsContent>
          </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Disparo Dialog */}
      <Dialog open={disparoDialogOpen} onOpenChange={(open) => { setDisparoDialogOpen(open); if (!open) resetDisparo() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-emerald-400" />
              Novo Disparo
              {disparoLimitInfo && (
                <Badge variant="outline" className="ml-2 text-xs font-normal">
                  {disparoLimitInfo}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {disparoStep === 'mensagem_evolution'
                ? 'Escreva a mensagem de abertura para iniciar o atendimento.'
                : disparoStep === 'telefone_lookup'
                ? 'Informe o telefone do cliente para iniciar um atendimento.'
                : 'Informe o CNPJ do cliente para iniciar um atendimento.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* MODO POR TELEFONE — step unico de busca */}
            {disparoStep === 'telefone_lookup' && (
              <>
                <div className="space-y-2">
                  <Label>Telefone do cliente (com DDD)</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="(83) 9 9999-9999"
                      value={disparoTelefone}
                      onChange={(e) => {
                        handleDisparoTelefoneChange(e.target.value)
                        // Qualquer edicao reseta os resultados anteriores
                        if (disparoCliente) setDisparoCliente(null)
                        if (disparoTelefoneNaoEncontrado) setDisparoTelefoneNaoEncontrado(false)
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && !disparoCliente && handlePhoneLookup()}
                      disabled={disparoLoading || !!disparoCliente}
                    />
                    <Button
                      onClick={handlePhoneLookup}
                      disabled={disparoTelefone.replace(/\D/g, '').length < 10 || disparoLoading || !!disparoCliente}
                      size="sm"
                      className="shrink-0"
                    >
                      {disparoLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Nome manual quando telefone nao vinculado */}
                {disparoTelefoneNaoEncontrado && !disparoCliente && (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3 space-y-2">
                    <p className="text-xs text-amber-400/90">
                      Telefone nao vinculado a um cliente. Informe o nome para continuar.
                    </p>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nome do cliente</Label>
                      <Input
                        placeholder="Nome do cliente"
                        value={disparoNomeManual}
                        onChange={(e) => setDisparoNomeManual(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleConfirmNomeManual()}
                      />
                    </div>
                    <Button size="sm" className="w-full" onClick={handleConfirmNomeManual} disabled={!disparoNomeManual.trim()}>
                      Continuar
                    </Button>
                  </div>
                )}

                {/* Cliente resolvido (encontrado ou via nome manual) */}
                {disparoCliente && (
                  <div className="rounded-lg border border-foreground/8 bg-foreground/[0.03] p-3 space-y-1.5">
                    <p className="text-sm font-medium text-foreground/90">{disparoCliente.nome}</p>
                    {disparoCliente.telefone && (
                      <p className="text-xs text-muted-foreground/80">Telefone: {formatPhone(disparoCliente.telefone)}</p>
                    )}
                    {disparoCliente.cnpj && (
                      <p className="text-xs text-muted-foreground/80">CNPJ: {formatCNPJ(disparoCliente.cnpj)}</p>
                    )}
                    {disparoCliente.registro && (
                      <p className="text-xs text-muted-foreground/80">Registro: {disparoCliente.registro}</p>
                    )}
                    {disparoCliente.email && (
                      <p className="text-xs text-muted-foreground/80">Email: {disparoCliente.email}</p>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => {
                        setDisparoCliente(null)
                        setDisparoTelefoneNaoEncontrado(false)
                        setDisparoNomeManual('')
                      }}
                    >
                      Trocar cliente
                    </Button>
                  </div>
                )}

                {/* Advance button */}
                {disparoCliente && (
                  <Button
                    onClick={handleDisparoConfirmPhone}
                    disabled={disparoSending}
                    className="w-full gap-2"
                  >
                    {disparoSending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (setorCanaisAtivos.includes('whatsapp') && setorCanaisAtivos.includes('evolution_api')) ? (
                      <>
                        Próximo
                        <ChevronRight className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Enviar Disparo
                      </>
                    )}
                  </Button>
                )}
              </>
            )}

            {/* Steps 1 & 2: CNPJ + Phone (hidden after choosing canal) */}
            {(disparoStep === 'cnpj' || disparoStep === 'telefone') && (
              <>
                {/* Step 1: CNPJ */}
                <div className="space-y-2">
                  <Label>CNPJ do Cliente</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="00.000.000/0000-00"
                      value={disparoCnpj}
                      onChange={(e) => setDisparoCnpj(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCnpjLookup()}
                      disabled={disparoLoading || disparoStep === 'telefone'}
                    />
                    <Button
                      onClick={handleCnpjLookup}
                      disabled={!disparoCnpj.trim() || disparoLoading || disparoStep === 'telefone'}
                      size="sm"
                      className="shrink-0"
                    >
                      {disparoLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Client data found */}
                {disparoCliente && (
                  <div className="rounded-lg border border-foreground/8 bg-foreground/[0.03] p-3 space-y-1.5">
                    <p className="text-sm font-medium text-foreground/90">{disparoCliente.nome}</p>
                    {disparoCliente.cnpj && (
                      <p className="text-xs text-muted-foreground/80">CNPJ: {formatCNPJ(disparoCliente.cnpj)}</p>
                    )}
                    {disparoCliente.registro && (
                      <p className="text-xs text-muted-foreground/80">Registro: {disparoCliente.registro}</p>
                    )}
                    {disparoCliente.telefone && (
                      <p className="text-xs text-muted-foreground/80">Telefone: {formatPhone(disparoCliente.telefone)}</p>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => { setDisparoCliente(null); setDisparoStep('cnpj'); setDisparoTelefone('') }}
                    >
                      Trocar cliente
                    </Button>
                  </div>
                )}

                {/* Step 2: Phone number */}
                {disparoStep === 'telefone' && (
                  <div className="space-y-2">
                    <Label>Telefone do cliente (com DDD)</Label>
                    <Input
                      placeholder="(83) 9 9999-9999"
                      value={disparoTelefone}
                      onChange={(e) => handleDisparoTelefoneChange(e.target.value)}
                    />
                  </div>
                )}

                {/* Advance button */}
                {disparoStep === 'telefone' && (
                  <Button
                    onClick={handleDisparoConfirmPhone}
                    disabled={!disparoCliente || disparoTelefone.replace(/\D/g, '').length < 10 || disparoSending}
                    className="w-full gap-2"
                  >
                    {disparoSending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (setorCanaisAtivos.includes('whatsapp') && setorCanaisAtivos.includes('evolution_api')) ? (
                      <>
                        Próximo
                        <ChevronRight className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Enviar Disparo
                      </>
                    )}
                  </Button>
                )}
              </>
            )}

            {/* Step 4: Evolution message editor */}
            {disparoStep === 'mensagem_evolution' && (
              <div className="space-y-3">
                {/* Client summary */}
                <div className="rounded-lg border border-foreground/8 bg-foreground/[0.03] p-3 space-y-0.5">
                  <p className="text-sm font-medium">{disparoCliente?.nome}</p>
                  <p className="text-xs text-muted-foreground/80">{formatPhone(disparoTelefone)}</p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                    <Zap className="h-2.5 w-2.5" />
                    Evolution API
                  </span>
                </div>

                <div className="space-y-1.5">
                  <Label>Mensagem de abertura</Label>
                  <textarea
                    className="w-full min-h-[120px] resize-none rounded-lg border border-foreground/8 bg-foreground/[0.03] px-3 py-2 text-sm text-foreground/90 placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/30"
                    placeholder="Digite a mensagem..."
                    value={disparoMensagemEvolution}
                    onChange={(e) => setDisparoMensagemEvolution(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground/80">
                    O ticket será criado e atribuído a você imediatamente. Você poderá enviar mais mensagens sem aguardar a resposta do cliente.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setDisparoStep(novoDisparoEnabled ? 'telefone_lookup' : 'telefone')}
                  >
                    ← Voltar
                  </Button>
                  <Button
                    onClick={handleEnviarDisparoEvolution}
                    disabled={!disparoMensagemEvolution.trim() || disparoSending}
                    className="flex-1 gap-2"
                  >
                    {disparoSending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Enviar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Cliente Não Informado ao Encerrar */}
      <AlertDialog open={clienteNaoInformadoDialogOpen} onOpenChange={setClienteNaoInformadoDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-amber-500" />
              Cliente não informado
            </AlertDialogTitle>
            <AlertDialogDescription>
              Este ticket não possui um cliente com CNPJ vinculado. Deseja informar o cliente antes de encerrar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setClienteNaoInformadoDialogOpen(false)
                handleEncerrarTicket()
              }}
            >
              Não, encerrar assim
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setClienteNaoInformadoDialogOpen(false)
                setSelecionarClienteCnpj('')
                setSelecionarClienteData(null)
                setSelecionarClienteDialogOpen(true)
              }}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Sim, informar cliente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Selecionar Cliente por CNPJ */}
      <Dialog
        open={selecionarClienteDialogOpen}
        onOpenChange={(open) => {
          setSelecionarClienteDialogOpen(open)
          if (!open) { setSelecionarClienteCnpj(''); setSelecionarClienteData(null) }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-emerald-400" />
              Selecionar Cliente
            </DialogTitle>
            <DialogDescription>
              Informe o CNPJ para buscar e vincular um cliente a este ticket.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* CNPJ Input */}
            <div className="space-y-2">
              <Label>CNPJ do Cliente</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="00.000.000/0000-00"
                  value={selecionarClienteCnpj}
                  onChange={(e) => setSelecionarClienteCnpj(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSelecionarClienteCnpjLookup()}
                  disabled={selecionarClienteLoading || !!selecionarClienteData}
                />
                <Button
                  onClick={handleSelecionarClienteCnpjLookup}
                  disabled={!selecionarClienteCnpj.trim() || selecionarClienteLoading || !!selecionarClienteData}
                  size="sm"
                  className="shrink-0"
                >
                  {selecionarClienteLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Cliente encontrado */}
            {selecionarClienteData && (
              <div className="rounded-lg border border-foreground/8 bg-foreground/[0.03] p-3 space-y-1.5">
                <p className="text-sm font-semibold text-foreground/90">{selecionarClienteData.nome}</p>
                {selecionarClienteData.cnpj && (
                  <p className="text-xs text-muted-foreground/80">CNPJ: {formatCNPJ(selecionarClienteData.cnpj)}</p>
                )}
                {selecionarClienteData.registro && (
                  <p className="text-xs text-muted-foreground/80">Registro: {selecionarClienteData.registro}</p>
                )}
                {selecionarClienteData.telefone && (
                  <p className="text-xs text-muted-foreground/80">Telefone: {formatPhone(selecionarClienteData.telefone)}</p>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] px-2 mt-1"
                  onClick={() => { setSelecionarClienteData(null); setSelecionarClienteCnpj('') }}
                >
                  Trocar cliente
                </Button>
              </div>
            )}

            {/* Ações */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setSelecionarClienteDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                disabled={!selecionarClienteData}
                onClick={handleConfirmarSelecionarCliente}
              >
                Vincular Cliente
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar Dados do Cliente */}
      <Dialog open={editarClienteDialogOpen} onOpenChange={setEditarClienteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-amber-500" />
              Editar Dados do Cliente
            </DialogTitle>
            <DialogDescription>
              Edite os dados do cliente vinculado a este ticket.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input
                value={editarClienteForm.nome}
                onChange={(e) => setEditarClienteForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Nome do cliente"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Telefone</Label>
              <Input
                value={editarClienteForm.telefone}
                onChange={(e) => setEditarClienteForm((f) => ({ ...f, telefone: e.target.value }))}
                placeholder="5511999999999"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">CNPJ</Label>
              <Input
                value={editarClienteForm.CNPJ}
                onChange={(e) => setEditarClienteForm((f) => ({ ...f, CNPJ: e.target.value }))}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Registro</Label>
                <Input
                  value={editarClienteForm.Registro}
                  onChange={(e) => setEditarClienteForm((f) => ({ ...f, Registro: e.target.value }))}
                  placeholder="Registro"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={editarClienteForm.email}
                  onChange={(e) => setEditarClienteForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setEditarClienteDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 gap-1.5"
                disabled={editarClienteLoading || !editarClienteForm.nome.trim()}
                onClick={handleSalvarEditarCliente}
              >
                {editarClienteLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
    </TooltipProvider>
  )
}

// Ticket List Component
function TicketList({
  tickets,
  selectedTicket,
  onSelectTicket,
  statusFilter,
  setStatusFilter,
  prioridadeFilter,
  setPrioridadeFilter,
  subsetorFilter,
  setSubsetorFilter,
  subsetoresDisponiveis,
  searchTerm,
  setSearchTerm,
  unreadCounts,
  setorCanal,
}: {
  tickets: Ticket[]
  selectedTicket: Ticket | null
  onSelectTicket: (ticket: Ticket) => void
  statusFilter: string
  setStatusFilter: (v: string) => void
  prioridadeFilter: string
  setPrioridadeFilter: (v: string) => void
  subsetorFilter: string
  setSubsetorFilter: (v: string) => void
  subsetoresDisponiveis: Subsetor[]
  searchTerm: string
  setSearchTerm: (v: string) => void
  unreadCounts: Map<string, number>
  setorCanal: 'whatsapp' | 'evolution_api'
}) {
  // Tick every 30s to re-evaluate wait times
  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(interval)
  }, [])

  const [filtersOpen, setFiltersOpen] = useState(false)

  // Check if any filter is active (non-default)
  const hasActiveFilter = statusFilter !== 'todos' || prioridadeFilter !== 'todos' || subsetorFilter !== 'todos'

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Search + Filter Toggle */}
      <div className="shrink-0 px-3 pt-3 pb-2 space-y-2">
        {/* Search input with filter icon */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            id="buscar-cliente"
            name="buscar-cliente"
            placeholder="Buscar cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-9 h-9 text-xs bg-foreground/[0.03] border-foreground/8"
          />
          <button
            type="button"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={cn(
              'absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-colors',
              filtersOpen || hasActiveFilter ? 'text-emerald-400' : 'text-muted-foreground/60 hover:text-muted-foreground'
            )}
          >
            <Filter className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Collapsible filters */}
        {filtersOpen && (
          <div className="space-y-1.5 pb-1">
            <div className="flex gap-1.5">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="flex-1 h-7 text-[11px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="aberto">Aberto</SelectItem>
                  <SelectItem value="em_atendimento">Atendendo</SelectItem>
                </SelectContent>
              </Select>
              <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
                <SelectTrigger className="flex-1 h-7 text-[11px]">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {subsetoresDisponiveis.length > 0 && (
              <Select value={subsetorFilter} onValueChange={setSubsetorFilter}>
                <SelectTrigger className="w-full h-7 text-[11px]">
                  <SelectValue placeholder="Subsetor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Subsetores</SelectItem>
                  <SelectItem value="sem_subsetor">Sem Subsetor</SelectItem>
                  {subsetoresDisponiveis.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Quick stats */}
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[11px] text-muted-foreground/60">{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</span>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => { setStatusFilter('todos'); setPrioridadeFilter('todos'); setSubsetorFilter('todos') }}
              className="text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Ticket List */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tickets.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center text-muted-foreground/60 px-4">
            <MessageCircle className="mb-2 h-8 w-8 opacity-30" />
            <p className="text-sm">Nenhum ticket encontrado</p>
          </div>
        ) : (
          <div>
            {tickets.map((ticket) => {
              const unreadCount = unreadCounts.get(ticket.id) || 0
              const isWaitingResponse = ticket.ultima_mensagem_remetente && isOutgoingMessage(ticket.ultima_mensagem_remetente)
              const isSelected = selectedTicket?.id === ticket.id

              // Check if ticket exceeded wait time
              const tempoEspera = ticket.setores?.tempo_espera_minutos || 0
              let isExpiredWait = false
              if (tempoEspera > 0 && isWaitingResponse && ticket.ultima_mensagem_em && ticket.status !== 'encerrado') {
                const lastMsgTime = new Date(ticket.ultima_mensagem_em).getTime()
                const elapsed = Date.now() - lastMsgTime
                isExpiredWait = elapsed > tempoEspera * 60 * 1000
              }

              return (
                <motion.div
                  key={ticket.id}
                  role="button"
                  tabIndex={0}
                  whileHover={{ backgroundColor: isSelected ? undefined : 'rgba(255,255,255,0.025)' }}
                  onClick={() => onSelectTicket(ticket)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectTicket(ticket) }}
                  className={cn(
                    'w-full px-3 py-3 text-left transition-all cursor-pointer border-l-[3px]',
                    isSelected
                      ? 'bg-emerald-500/[0.07] border-l-emerald-500 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]'
                      : isExpiredWait
                      ? 'bg-amber-500/[0.04] border-l-amber-500'
                      : unreadCount > 0
                      ? 'bg-foreground/[0.02] border-l-transparent'
                      : 'border-l-transparent'
                  )}
                >
                  <div className="flex flex-col gap-1.5">
                    {/* Top row: Ticket # badge (left) + time since last msg (right) */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={cn(
                          "text-[11px] font-mono font-semibold shrink-0 px-1.5 py-0.5 rounded bg-foreground/[0.04]",
                          isSelected ? "text-emerald-400 bg-emerald-500/10" : "text-muted-foreground"
                        )}>
                          #{ticket.numero}
                        </span>
                        {ticket.prioridade === 'urgente' && (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500/10">
                            <AlertTriangle className="h-2.5 w-2.5 text-red-400" />
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground/60 shrink-0 tabular-nums">
                        {formatDistanceToNow(new Date(ticket.ultima_mensagem_em || ticket.criado_em), {
                          locale: ptBR,
                          addSuffix: false,
                        })}
                      </span>
                    </div>

                    {/* Middle: Client name (bold) + phone (muted) */}
                    <div className="flex items-center gap-2 min-w-0">
                      <p className={cn(
                        "text-sm font-semibold truncate flex-1 min-w-0",
                        isSelected ? "text-emerald-300" : unreadCount > 0 ? "text-foreground/90" : "text-foreground/75"
                      )}>
                        {ticket.clientes.nome}
                      </p>
                    </div>
                    {ticket.clientes.telefone && (
                      <span className="text-[10px] text-muted-foreground/60 truncate -mt-1">
                        {formatPhone(ticket.clientes.telefone)}
                      </span>
                    )}

                    {/* Bottom row: Status badge + Unread count */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {isExpiredWait ? (
                          <Badge className="text-[9px] px-1.5 py-0 h-[18px] bg-amber-500/15 text-amber-400 border-0 animate-pulse">
                            Sem resposta
                          </Badge>
                        ) : isWaitingResponse && unreadCount === 0 ? (
                          <Badge className="text-[9px] px-1.5 py-0 h-[18px] bg-amber-500/10 text-amber-400/80 border-0">
                            Aguardando
                          </Badge>
                        ) : (
                          <Badge
                            className={cn(
                              'text-[9px] px-1.5 py-0 h-[18px] border-0',
                              ticket.status === 'aberto' && 'bg-blue-500/10 text-blue-400',
                              ticket.status === 'em_atendimento' && 'bg-emerald-500/10 text-emerald-400'
                            )}
                          >
                            {ticket.status === 'aberto' ? 'Aberto' : 'Atendendo'}
                          </Badge>
                        )}
                        {ticket.is_disparo && (
                          <Badge className="text-[9px] px-1 py-0 h-[18px] bg-blue-500/10 text-blue-400 border-0">
                            <Megaphone className="h-2.5 w-2.5" />
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {unreadCount > 0 && (
                          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white shadow-lg shadow-emerald-500/30">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Last message preview */}
                    {ticket.ultima_mensagem && (
                      <p className="text-[11px] text-muted-foreground/50 line-clamp-1 -mt-0.5">
                        {ticket.ultima_mensagem_remetente && isOutgoingMessage(ticket.ultima_mensagem_remetente) && (
                          <span className="text-muted-foreground/70 mr-1">Voce:</span>
                        )}
                        {ticket.ultima_mensagem}
                      </p>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
