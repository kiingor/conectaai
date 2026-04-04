'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { useColaborador, useSetores } from '@/lib/hooks/use-data'
// Card imports kept for potential future use
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
// Table imports kept for potential future use
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Activity,
  RefreshCw,
  Search,
  Clock,
  User,
  AlertCircle,
  MessageCircle,
  X,
  ArrowRightLeft,
  Megaphone,
  Loader2,
  History,
  Check,
  XCircle,
  Inbox,
  Headphones,
  Timer,
  Zap,
  BarChart3,
  Tag,
  Users,
  Building2,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

function formatMs(ms: number) {
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((ms % (1000 * 60)) / 1000)
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function formatDuration(startDate: string | null, endDate: string | Date | null) {
  if (!startDate) return '00:00:00'
  const start = new Date(startDate).getTime()
  const end = endDate ? new Date(endDate).getTime() : Date.now()
  const diffMs = Math.max(0, end - start)
  return formatMs(diffMs)
}

function formatPhone(phone: string | null) {
  if (!phone) return '—'
  // Remove country code 55 from the start
  let num = phone.replace(/\D/g, '')
  if (num.startsWith('55') && num.length > 11) {
    num = num.slice(2)
  }
  // Format as (XX) XXXXX-XXXX or (XX) XXXX-XXXX
  if (num.length === 11) {
    return `(${num.slice(0, 2)}) ${num.slice(2, 7)}-${num.slice(7)}`
  }
  if (num.length === 10) {
    return `(${num.slice(0, 2)}) ${num.slice(2, 6)}-${num.slice(6)}`
  }
  return num
}

export default function MonitoramentoPage() {
  const supabase = createClient()
  const { data: colaborador } = useColaborador()
  const { data: setoresAcessiveis = [] } = useSetores(colaborador?.id, colaborador?.is_master, colaborador?.organizacao_id)
  const setorIdsAcessiveis = setoresAcessiveis.map((s: any) => s.id)

  const [tagFilter, setTagFilter] = useState<string>('all')

  // Extrair tags únicas dos setores acessíveis
  const tagsDisponiveis = useMemo(() => {
    const tagMap = new Map<string, { id: string; nome: string; cor: string }>()
    setoresAcessiveis.forEach((s: any) => {
      if (s.tags) {
        tagMap.set(s.tags.id, { id: s.tags.id, nome: s.tags.nome, cor: s.tags.cor })
      }
    })
    return Array.from(tagMap.values()).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [setoresAcessiveis])

  // Setores filtrados por tag
  const setoresFiltradosPorTag = useMemo(() => {
    if (tagFilter === 'all') return setoresAcessiveis
    return setoresAcessiveis.filter((s: any) => s.tags?.id === tagFilter)
  }, [setoresAcessiveis, tagFilter])

  const setorIdsFiltrados = useMemo(() => {
    return setoresFiltradosPorTag.map((s: any) => s.id)
  }, [setoresFiltradosPorTag])
  const [setorFilter, setSetorFilter] = useState<string>('all')
  const [subsetorFilter, setSubsetorFilter] = useState<string>('all')
  const [subsetoresDisponiveis, setSubsetoresDisponiveis] = useState<{id: string, nome: string}[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [atendenteFilter, setAtendenteFilter] = useState<string>('all')
  const [filtrosAtendenteOpen, setFiltrosAtendenteOpen] = useState(false)
  const [filtroAtendenteSearch, setFiltroAtendenteSearch] = useState('')
  const [activeTab, setActiveTab] = useState('em-andamento')
  const [searchAtendente, setSearchAtendente] = useState('')
  const [, setTick] = useState(0)

  // Helper: verifica se atendente está online (confia no is_online do banco)
  const isAtendenteOnline = useCallback((atendente: any): boolean => {
    return !!(atendente?.is_online && atendente?.ativo)
  }, [])

  // Conversation panel state
  const [selectedTicket, setSelectedTicket] = useState<any>(null)
  const [conversationMessages, setConversationMessages] = useState<any[]>([])
  const [ticketHistory, setTicketHistory] = useState<any[]>([])
  const [historyMessages, setHistoryMessages] = useState<Record<string, any[]>>({})
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [conversationTab, setConversationTab] = useState<'conversa' | 'historico'>('conversa')

  // Transfer & finalize state
  const [encerrarDialogOpen, setEncerrarDialogOpen] = useState(false)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [transferLoading, setTransferLoading] = useState(false)
  const [atendentesDisponiveis, setAtendentesDisponiveis] = useState<any[]>([])
  const [setoresTransfer, setSetoresTransfer] = useState<any[]>([])
  const [selectedSetorTransfer, setSelectedSetorTransfer] = useState<string>('all')
  const [selectedAtendenteTransfer, setSelectedAtendenteTransfer] = useState<string>('all')

  // Tick every second for live times
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  // Fetch subsetores when setor filter changes
  useEffect(() => {
    async function fetchSubsetores() {
      const targetSetorIds = setorFilter !== 'all' ? [setorFilter] : setorIdsFiltrados
      if (targetSetorIds.length === 0) {
        setSubsetoresDisponiveis([])
        return
      }
      const { data } = await supabase
        .from('subsetores')
        .select('id, nome')
        .in('setor_id', targetSetorIds)
        .eq('ativo', true)
        .order('nome')
      setSubsetoresDisponiveis(data || [])
      setSubsetorFilter('all') // Reset subsetor filter when setor changes
    }
    if (colaborador && setorIdsFiltrados.length > 0) {
      fetchSubsetores()
    }
  }, [setorFilter, tagFilter, colaborador, setorIdsFiltrados.length, supabase])

  // Fetch monitoring data
  const { data, isLoading, mutate } = useSWR(
    colaborador && setorIdsFiltrados.length > 0
      ? ['dashboard-monitoramento', setorIdsFiltrados.join(','), setorFilter, tagFilter]
      : null,
    async () => {
      const targetSetorIds = setorFilter !== 'all' ? [setorFilter] : setorIdsFiltrados

      // Fetch active tickets (aberto + em_atendimento) across all accessible setores
      let ticketsQuery = supabase
        .from('tickets')
        .select('*, clientes(nome, telefone), colaboradores(id, nome, is_online, pausa_atual_id), setores(id, nome), subsetores(id, nome)')
        .in('setor_id', targetSetorIds)
        .in('status', ['aberto', 'em_atendimento'])
      const { data: ticketsAtivos } = await ticketsQuery

      // Fetch today's tickets (for stats)
      const now = new Date()
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const { data: ticketsHoje } = await supabase
        .from('tickets')
        .select('id, status, criado_em, primeira_resposta_em, encerrado_em')
        .in('setor_id', targetSetorIds)
        .gte('criado_em', startOfDay)

      // Separate count queries to avoid Supabase 1000-row default limit
      const { count: countRecebidos } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .in('setor_id', targetSetorIds)
        .gte('criado_em', startOfDay)

      const { count: countResolvidos } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'encerrado')
        .in('setor_id', targetSetorIds)
        .gte('criado_em', startOfDay)

      // Fetch atendentes across all accessible setores
      let atendentesQuery = supabase
        .from('colaboradores_setores')
        .select('colaborador_id, colaboradores(id, nome, is_online, ativo, pausa_atual_id, last_heartbeat)')
        .in('setor_id', targetSetorIds)
      const { data: atendentesData } = await atendentesQuery

      // Deduplicate atendentes (same person can be in multiple setores)
      const atendentesMap = new Map()
      for (const a of atendentesData || []) {
        const colab = (a as any).colaboradores
        if (colab && !atendentesMap.has(colab.id)) {
          atendentesMap.set(colab.id, colab)
        }
      }
      const atendentes = Array.from(atendentesMap.values())

      const tickets = ticketsAtivos || []
      const todayTickets = ticketsHoje || []

      // Calculate stats
      const ticketsNaFila = tickets.filter((t: any) => t.status === 'aberto')
      const ticketsEmAtendimento = tickets.filter((t: any) => t.status === 'em_atendimento')
      const ticketsFinalizados = todayTickets.filter((t: any) => t.status === 'encerrado')

      // Max times
      const nowMs = Date.now()

      // Online = is_online true, ativo, e sem pausa
      const atendentesOnline = atendentes.filter((c: any) => c.is_online && c.ativo && !c.pausa_atual_id)
      const atendentesEmPausa = atendentes.filter((c: any) => c.pausa_atual_id && c.ativo)
      let maxTempoFila = 0
      let maxTempoResposta = 0

      for (const ticket of ticketsNaFila) {
        if (ticket.criado_em) {
          const tempoFila = nowMs - new Date(ticket.criado_em).getTime()
          if (tempoFila > maxTempoFila) maxTempoFila = tempoFila
        }
      }

      for (const ticket of ticketsEmAtendimento) {
        if (ticket.criado_em && !ticket.primeira_resposta_em) {
          const tempoResposta = nowMs - new Date(ticket.criado_em).getTime()
          if (tempoResposta > maxTempoResposta) maxTempoResposta = tempoResposta
        }
      }

      // Average first response time
      const withFirstResp = todayTickets.filter((t: any) => t.primeira_resposta_em)
      let avgFirstResp = 0
      if (withFirstResp.length > 0) {
        const total = withFirstResp.reduce((sum: number, t: any) => {
          return sum + (new Date(t.primeira_resposta_em).getTime() - new Date(t.criado_em).getTime())
        }, 0)
        avgFirstResp = total / withFirstResp.length
      }

      // Average resolution time
      const resolved = todayTickets.filter((t: any) => t.encerrado_em)
      let avgResolution = 0
      if (resolved.length > 0) {
        const total = resolved.reduce((sum: number, t: any) => {
          return sum + (new Date(t.encerrado_em).getTime() - new Date(t.criado_em).getTime())
        }, 0)
        avgResolution = total / resolved.length
      }

      return {
        tickets,
        atendentes,
        stats: {
          total: tickets.length,
          naFila: ticketsNaFila.length,
          emAtendimento: ticketsEmAtendimento.length,
          finalizados: ticketsFinalizados.length,
          tempoMaximoFila: formatMs(maxTempoFila),
          tempoMaximoResposta: formatMs(maxTempoResposta),
        },
        atendentesStats: {
          online: atendentesOnline.length,
          pausa: atendentesEmPausa.length,
          offline: atendentes.filter((c: any) => !c.is_online && c.ativo && !c.pausa_atual_id).length,
        },
        temposHoje: {
          tempoMedioPrimeiraResposta: formatMs(avgFirstResp),
          tempoMedioResolucao: formatMs(avgResolution),
          totalRecebidos: countRecebidos || 0,
          totalResolvidos: countResolvidos || 0,
        },
      }
    },
    { revalidateOnFocus: false, refreshInterval: 5000 },
  )

  const stats = data?.stats || { total: 0, naFila: 0, emAtendimento: 0, finalizados: 0, tempoMaximoFila: '00:00:00', tempoMaximoResposta: '00:00:00' }
  const atendentesStats = data?.atendentesStats || { online: 0, pausa: 0, offline: 0 }
  const temposHoje = data?.temposHoje || { tempoMedioPrimeiraResposta: '00:00:00', tempoMedioResolucao: '00:00:00', totalRecebidos: 0, totalResolvidos: 0 }
  const tickets = data?.tickets || []
  const atendentesRaw: any[] = data?.atendentes || []

  // Tickets em andamento
  // Lista de atendentes únicos para o filtro
  const atendentesUnicos = useMemo(() => {
    const map = new Map<string, string>()
    tickets.forEach((t: any) => {
      if (t.colaborador_id && t.colaboradores?.nome) {
        map.set(t.colaborador_id, t.colaboradores.nome)
      }
    })
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [tickets])

  const ticketsEmAndamento = useMemo(() => {
    return tickets
      .filter((t: any) => t.status === 'em_atendimento' || (t.status === 'aberto' && t.colaborador_id))
      .filter((t: any) => {
        // Filtro por atendente
        if (atendenteFilter !== 'all' && t.colaborador_id !== atendenteFilter) return false
        // Filtro de subsetor
        if (subsetorFilter !== 'all') {
          if (subsetorFilter === 'sem_subsetor') {
            if (t.subsetor_id) return false
          } else {
            if (t.subsetor_id !== subsetorFilter) return false
          }
        }
        if (!searchTerm) return true
        const contato = t.clientes?.nome || t.clientes?.telefone || ''
        const numero = String(t.numero ?? t.id?.slice(0, 8) ?? '')
        return contato.toLowerCase().includes(searchTerm.toLowerCase()) || numero.includes(searchTerm)
      })
      .map((t: any) => ({
        id: t.id,
        cliente_id: t.cliente_id,
        setor_id: t.setor_id,
        colaborador_id: t.colaborador_id,
        setores: t.setores,
        colaboradores: t.colaboradores,
        numero: t.numero ?? null,
        // Tempo na fila = criado_em → atribuido_em (tempo sem atendente)
        // Se atribuido_em não foi registrado mas já tem colaborador, o dado não está disponível
        tempoNaFila: t.atribuido_em
          ? formatDuration(t.criado_em, t.atribuido_em)
          : t.colaborador_id
            ? '—'
            : formatDuration(t.criado_em, null),
        tempoPrimeiraResposta: t.primeira_resposta_em ? formatDuration(t.criado_em, t.primeira_resposta_em) : null,
        // Tempo de atendimento = atribuido_em (ou criado_em como fallback) → agora
        tempoAtendimento: t.colaborador_id ? formatDuration(t.atribuido_em || t.criado_em, null) : '00:00:00',
        contato: t.clientes?.nome || t.clientes?.telefone || 'Desconhecido',
        telefone: t.clientes?.telefone || null,
        canal: t.canal || 'whatsapp',
        setor: t.setores?.nome || '-',
        subsetor: t.subsetores?.nome || null,
        atendente: t.colaboradores?.nome || null,
        status: t.status,
        primeira_resposta_em: t.primeira_resposta_em,
      }))
  }, [tickets, searchTerm, subsetorFilter, atendenteFilter])

  // Tickets aguardando
  const ticketsAguardando = useMemo(() => {
    return tickets
      .filter((t: any) => t.status === 'aberto' && !t.colaborador_id)
      .filter((t: any) => {
        // Filtro de subsetor
        if (subsetorFilter !== 'all') {
          if (subsetorFilter === 'sem_subsetor') {
            if (t.subsetor_id) return false
          } else {
            if (t.subsetor_id !== subsetorFilter) return false
          }
        }
        if (!searchTerm) return true
        const contato = t.clientes?.nome || t.clientes?.telefone || ''
        return contato.toLowerCase().includes(searchTerm.toLowerCase())
      })
      // Aguardando não tem colaborador, então "Meus" mostra vazio (sem atribuição ainda)
      .map((t: any) => ({
        id: t.id,
        cliente_id: t.cliente_id,
        numero: t.numero ?? null,
        contato: t.clientes?.nome || t.clientes?.telefone || 'Desconhecido',
        telefone: t.clientes?.telefone || null,
        canal: t.canal || 'whatsapp',
        setor: t.setores?.nome || '-',
        subsetor: t.subsetores?.nome || null,
        tempoEspera: formatDuration(t.criado_em, null),
        criado_em: t.criado_em,
      }))
  }, [tickets, searchTerm, subsetorFilter])

  // Atendentes list for the Atendentes tab
  const atendentesLista = useMemo(() => {
    const ticketCountPorAtendente = new Map<string, number>()
    tickets.forEach((t: any) => {
      if (t.colaborador_id && (t.status === 'em_atendimento' || t.status === 'aberto')) {
        ticketCountPorAtendente.set(t.colaborador_id, (ticketCountPorAtendente.get(t.colaborador_id) || 0) + 1)
      }
    })
    return atendentesRaw
      .filter((a: any) => {
        if (!searchAtendente) return true
        return a.nome?.toLowerCase().includes(searchAtendente.toLowerCase())
      })
      .map((a: any) => ({
        ...a,
        ticketsAtivos: ticketCountPorAtendente.get(a.id) || 0,
      }))
      .sort((a: any, b: any) => {
        // Ordem: Online primeiro → Pausa → Offline, e dentro de cada grupo por nome
        const order = (x: any) => {
          if (x.is_online && !x.pausa_atual_id) return 0 // Online
          if (x.pausa_atual_id) return 1                  // Em pausa
          return 2                                         // Offline
        }
        return order(a) - order(b) || a.nome?.localeCompare(b.nome)
      })
  }, [atendentesRaw, tickets, searchAtendente])

  // Open conversation panel
  const openConversation = async (ticket: any) => {
    setSelectedTicket(ticket)
    setConversationTab('conversa')
    setLoadingMessages(true)
    setLoadingHistory(true)

    try {
      // Fetch messages for this ticket
      const { data: messages } = await supabase
        .from('mensagens')
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('enviado_em', { ascending: true })

      setConversationMessages(messages || [])
    } catch {
      setConversationMessages([])
    } finally {
      setLoadingMessages(false)
    }

    // Fetch ticket history for same client
    try {
      const { data: history } = await supabase
        .from('tickets')
        .select('*, colaboradores(nome), setores(nome)')
        .eq('cliente_id', ticket.cliente_id)
        .neq('id', ticket.id)
        .order('criado_em', { ascending: false })
        .limit(20)

      setTicketHistory(history || [])
    } catch {
      setTicketHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const closeConversation = () => {
    setSelectedTicket(null)
    setConversationMessages([])
    setTicketHistory([])
    setHistoryMessages({})
    setExpandedHistory(null)
  }

  const loadHistoryMessages = async (ticketId: string) => {
    if (historyMessages[ticketId]) {
      setExpandedHistory(expandedHistory === ticketId ? null : ticketId)
      return
    }
    setExpandedHistory(ticketId)
    const { data: msgs } = await supabase
      .from('mensagens')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('enviado_em', { ascending: true })
    setHistoryMessages(prev => ({ ...prev, [ticketId]: msgs || [] }))
  }

  // Encerrar ticket
  const handleEncerrarTicket = async () => {
    if (!selectedTicket) return
    try {
      // Fetch setor config for closing message
      const { data: setor } = await supabase
        .from('setores')
        .select('mensagem_finalizacao')
        .eq('id', selectedTicket.setor_id)
        .single()

      // Send closing message if configured
      if (setor?.mensagem_finalizacao) {
        // Fetch client data for template variables
        const { data: cliente } = await supabase
          .from('clientes')
          .select('nome, telefone, CNPJ')
          .eq('id', selectedTicket.cliente_id)
          .single()

        // Process template variables
        const now = new Date()
        const processedMessage = setor.mensagem_finalizacao
          .replace(/\{\{cliente_nome\}\}/g, cliente?.nome || '')
          .replace(/\{\{cliente_telefone\}\}/g, cliente?.telefone || '')
          .replace(/\{\{cliente_cnpj\}\}/g, cliente?.CNPJ || '')
          .replace(/\{\{atendente_nome\}\}/g, selectedTicket.atendente || '')
          .replace(/\{\{setor_nome\}\}/g, selectedTicket.setores?.nome || '')
          .replace(/\{\{ticket_id\}\}/g, selectedTicket.numero ? `#${selectedTicket.numero}` : '')
          .replace(/\{\{data_atual\}\}/g, now.toLocaleDateString('pt-BR'))
          .replace(/\{\{hora_atual\}\}/g, now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))

        // Detect channel from last message
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

        // Send closing message via the appropriate channel
        try {
          if (setorCanal === 'evolution_api' && phoneNumberId && cliente?.telefone) {
            await fetch('/api/evolution/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ticketId: selectedTicket.id, message: processedMessage, instanceName: phoneNumberId }),
            })
          } else if (setorCanal === 'whatsapp' && phoneNumberId && cliente?.telefone) {
            await fetch('/api/whatsapp/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ recipientPhone: cliente.telefone, message: processedMessage, ticketId: selectedTicket.id, phoneNumberId }),
            })
          }
        } catch (err) {
          console.error('[Encerrar] Erro ao enviar mensagem de finalização:', err)
        }
      }

      await supabase
        .from('tickets')
        .update({ status: 'encerrado', encerrado_em: new Date().toISOString() })
        .eq('id', selectedTicket.id)

      try {
        await fetch('/api/webhooks/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticketId: selectedTicket.id, evento: 'ticket_encerrado' }),
        })
      } catch (err) {
        console.error('[Webhook] dispatch error:', err)
      }

      toast.success('Ticket encerrado')
      setEncerrarDialogOpen(false)
      closeConversation()
      mutate()
    } catch {
      toast.error('Erro ao encerrar ticket')
    }
  }

  // Open transfer dialog and fetch data
  const openTransferDialog = async () => {
    setTransferDialogOpen(true)
    setSelectedSetorTransfer('all')
    setSelectedAtendenteTransfer('all')
    setAtendentesDisponiveis([])
    setSetoresTransfer([])

    const currentSetorId = selectedTicket?.setor_id
    if (!currentSetorId) return

    // Fetch destination setores configured for this setor
    const { data: destinosData } = await supabase
      .from('setor_destinos_transferencia')
      .select('setor_destino_id, setores:setor_destino_id(id, nome)')
      .eq('setor_origem_id', currentSetorId)

    if (destinosData && destinosData.length > 0) {
      const destinos = destinosData.map((d: any) => d.setores).filter(Boolean).sort((a: any, b: any) => a.nome.localeCompare(b.nome))
      setSetoresTransfer(destinos)
    }

    // Fetch atendentes from same setor
    const { data: csData } = await supabase
      .from('colaboradores_setores')
      .select('colaborador_id')
      .eq('setor_id', currentSetorId)

    if (csData && csData.length > 0) {
      const ids = csData.map((cs: any) => cs.colaborador_id)
      const { data: colabData } = await supabase
        .from('colaboradores')
        .select('id, nome, is_online, ativo, last_heartbeat')
        .in('id', ids)
        .eq('ativo', true)
        .neq('id', selectedTicket?.colaborador_id || '')

      setAtendentesDisponiveis(colabData || [])
    }
  }

  // Fetch atendentes when destination setor changes
  const handleSetorTransferChange = async (setorId: string) => {
    setSelectedSetorTransfer(setorId)
    setSelectedAtendenteTransfer('all')

    const { data: csData } = await supabase
      .from('colaboradores_setores')
      .select('colaborador_id')
      .eq('setor_id', setorId)

    if (csData && csData.length > 0) {
      const ids = csData.map((cs: any) => cs.colaborador_id)
      const { data: colabData } = await supabase
        .from('colaboradores')
        .select('id, nome, is_online, ativo, last_heartbeat')
        .in('id', ids)
        .eq('ativo', true)
      setAtendentesDisponiveis(colabData || [])
    } else {
      setAtendentesDisponiveis([])
    }
  }

  // Execute transfer
  const handleTransferTicket = async () => {
    if (!selectedTicket) return
    setTransferLoading(true)

    const res = await fetch('/api/tickets/transferir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticket_id: selectedTicket.id,
        setor_id: selectedSetorTransfer !== 'all' ? selectedSetorTransfer : undefined,
        colaborador_id: selectedAtendenteTransfer !== 'all' ? selectedAtendenteTransfer : null,
        from_colaborador_nome: selectedTicket.colaboradores?.nome || 'Desconhecido',
        from_setor_nome: selectedTicket.setores?.nome || 'Desconhecido',
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      toast.error(result.error || 'Erro ao transferir ticket')
      setTransferLoading(false)
      return
    }

    if (result.queued) {
      toast.info('Atendente no limite de tickets — ticket adicionado à fila de espera')
    } else {
      toast.success('Ticket transferido com sucesso')
    }

    setTransferDialogOpen(false)
    setTransferLoading(false)

    // Se o ticket foi para a fila (sem atendente), acionar distribuição imediata
    if (selectedAtendenteTransfer === 'all') {
      fetch('/api/tickets/auto-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }).catch(() => {})
    }

    closeConversation()
    mutate()
  }


  return (
    <>
      {/* ===== 3-PANEL LAYOUT ===== */}
      <div className="flex h-[calc(100vh-theme(spacing.14))] gap-3 lg:gap-4">

        {/* ========== LEFT PANEL — Stats ========== */}
        <aside className="hidden lg:flex w-[270px] shrink-0 flex-col gap-3 overflow-y-auto pr-1 pb-4">
          {/* Header mini */}
          <div className="flex items-center gap-2 px-1 pt-1 pb-0.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center border border-white/10">
              <Activity className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-bold text-white leading-tight truncate">Monitoramento</h1>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 border border-emerald-500/20">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[10px] font-medium text-emerald-400">Ao vivo</span>
            </div>
          </div>

          {/* Tickets Ativos — hero stat */}
          <div className="glass-card-elevated rounded-xl p-3 border-l-2 border-l-emerald-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-medium text-white/50">Tickets Ativos</span>
              </div>
              <span className="text-2xl font-bold brand-gradient-text tabular-nums">{stats.total}</span>
            </div>
          </div>

          {/* Na Fila */}
          <div className="glass-card-elevated rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Inbox className="h-4 w-4 text-orange-400" />
                <span className="text-xs font-medium text-white/50">Na Fila</span>
              </div>
              <span className="text-xl font-bold text-orange-400 tabular-nums">{stats.naFila}</span>
            </div>
          </div>

          {/* Em Atendimento */}
          <div className="glass-card-elevated rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Headphones className="h-4 w-4 text-cyan-400" />
                <span className="text-xs font-medium text-white/50">Em Atendimento</span>
              </div>
              <span className="text-xl font-bold text-cyan-400 tabular-nums">{stats.emAtendimento}</span>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/5 mx-2" />

          {/* Atendentes Online */}
          <div className="glass-card-elevated rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-xs font-medium text-white/50">Atendentes Online</span>
              </div>
              <span className="text-xl font-bold text-emerald-400 tabular-nums">{atendentesStats.online}</span>
            </div>
          </div>

          {/* Atendentes em Pausa */}
          <div className="glass-card-elevated rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <span className="text-xs font-medium text-white/50">Atendentes em Pausa</span>
              </div>
              <span className="text-xl font-bold text-amber-400 tabular-nums">{atendentesStats.pausa}</span>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/5 mx-2" />

          {/* Tempo Max Fila */}
          <div className="glass-card-elevated rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-white/40" />
                <span className="text-xs font-medium text-white/50">Tempo Max. Fila</span>
              </div>
              <span className="text-sm font-bold text-white/80 tabular-nums">{stats.tempoMaximoFila}</span>
            </div>
          </div>

          {/* Tempo Max Resposta */}
          <div className="glass-card-elevated rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-white/40" />
                <span className="text-xs font-medium text-white/50">Tempo Max. Resposta</span>
              </div>
              <span className="text-sm font-bold text-white/80 tabular-nums">{stats.tempoMaximoResposta}</span>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/5 mx-2" />

          {/* Stats do Dia section */}
          <div className="glass-card-elevated rounded-xl p-3 space-y-2.5">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-3.5 w-3.5 text-white/40" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Stats do Dia</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Recebidos</span>
              <span className="text-sm font-bold brand-gradient-text tabular-nums">{temposHoje.totalRecebidos}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Resolvidos</span>
              <span className="text-sm font-bold text-emerald-400 tabular-nums">{temposHoje.totalResolvidos}</span>
            </div>
            <div className="h-px bg-white/5" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Med. 1a Resposta</span>
              <span className="text-xs font-semibold text-white/70 tabular-nums">{temposHoje.tempoMedioPrimeiraResposta}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Med. Resolucao</span>
              <span className="text-xs font-semibold text-white/70 tabular-nums">{temposHoje.tempoMedioResolucao}</span>
            </div>
          </div>

          {/* Refresh button */}
          <Button variant="ghost" size="sm" onClick={() => mutate()} className="gap-2 text-white/40 hover:text-white/70 mx-1">
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="text-xs">Atualizar</span>
          </Button>
        </aside>

        {/* ========== CENTER PANEL — Filters + Tickets ========== */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Mobile-only header */}
          <div className="flex lg:hidden items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center border border-white/10">
              <Activity className="h-4 w-4 text-emerald-400" />
            </div>
            <h1 className="text-lg font-bold text-white">Monitoramento</h1>
            <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 border border-emerald-500/20">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[10px] font-medium text-emerald-400">Ao vivo</span>
            </div>
          </div>

          {/* Mobile stats summary (horizontal scroll) */}
          <div className="flex lg:hidden gap-2 overflow-x-auto pb-2 mb-2 scrollbar-none">
            <div className="glass-card-elevated rounded-lg px-3 py-2 flex items-center gap-2 shrink-0">
              <Activity className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs text-white/50">Ativos</span>
              <span className="text-sm font-bold brand-gradient-text tabular-nums">{stats.total}</span>
            </div>
            <div className="glass-card-elevated rounded-lg px-3 py-2 flex items-center gap-2 shrink-0">
              <Inbox className="h-3.5 w-3.5 text-orange-400" />
              <span className="text-xs text-white/50">Fila</span>
              <span className="text-sm font-bold text-orange-400 tabular-nums">{stats.naFila}</span>
            </div>
            <div className="glass-card-elevated rounded-lg px-3 py-2 flex items-center gap-2 shrink-0">
              <Headphones className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-xs text-white/50">Atend.</span>
              <span className="text-sm font-bold text-cyan-400 tabular-nums">{stats.emAtendimento}</span>
            </div>
            <div className="glass-card-elevated rounded-lg px-3 py-2 flex items-center gap-2 shrink-0">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-white/50">Online</span>
              <span className="text-sm font-bold text-emerald-400 tabular-nums">{atendentesStats.online}</span>
            </div>
            <div className="glass-card-elevated rounded-lg px-3 py-2 flex items-center gap-2 shrink-0">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-xs text-white/50">Pausa</span>
              <span className="text-sm font-bold text-amber-400 tabular-nums">{atendentesStats.pausa}</span>
            </div>
          </div>

          {/* Compact filter bar */}
          <div className="glass-card rounded-xl px-3 py-2.5 mb-3 shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar ticket ou contato..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 pl-8 text-xs rounded-lg glass-input"
                />
              </div>

              {/* Status tab pills */}
              <div className="flex items-center rounded-lg bg-white/5 p-0.5 gap-0.5">
                <button
                  onClick={() => setActiveTab('em-andamento')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                    activeTab === 'em-andamento'
                      ? "bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-white border border-white/10 shadow-sm"
                      : "text-white/40 hover:text-white/70"
                  )}
                >
                  Em andamento
                  {ticketsEmAndamento.length > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-white/10 text-[10px] tabular-nums">
                      {ticketsEmAndamento.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('aguardando')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                    activeTab === 'aguardando'
                      ? "bg-gradient-to-r from-orange-500/20 to-amber-500/20 text-white border border-white/10 shadow-sm"
                      : "text-white/40 hover:text-white/70"
                  )}
                >
                  Aguardando
                  {ticketsAguardando.length > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-orange-500/20 text-[10px] tabular-nums text-orange-300">
                      {ticketsAguardando.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('atendentes')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                    activeTab === 'atendentes'
                      ? "bg-white/10 text-white border border-white/10 shadow-sm"
                      : "text-white/40 hover:text-white/70"
                  )}
                >
                  Atendentes
                </button>
              </div>

              {/* Filter dropdowns */}
              <div className="flex items-center gap-1.5">
                {tagsDisponiveis.length > 0 && (
                  <Select value={tagFilter} onValueChange={(val) => {
                    setTagFilter(val)
                    setSetorFilter('all')
                    setSubsetorFilter('all')
                  }}>
                    <SelectTrigger className="h-8 w-auto min-w-[110px] text-xs bg-transparent border-white/10">
                      <Tag className="h-3 w-3 mr-1 text-white/40" />
                      <SelectValue placeholder="Tags" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as tags</SelectItem>
                      {tagsDisponiveis.map((tag) => (
                        <SelectItem key={tag.id} value={tag.id}>
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: tag.cor || '#888' }} />
                            {tag.nome}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Select value={setorFilter} onValueChange={setSetorFilter}>
                  <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs bg-transparent border-white/10">
                    <Building2 className="h-3 w-3 mr-1 text-white/40" />
                    <SelectValue placeholder="Setor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os setores</SelectItem>
                    {setoresFiltradosPorTag.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {subsetoresDisponiveis.length > 0 && (
                  <Select value={subsetorFilter} onValueChange={setSubsetorFilter}>
                    <SelectTrigger className="h-8 w-auto min-w-[110px] text-xs bg-transparent border-white/10">
                      <SelectValue placeholder="Subsetor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos subsetores</SelectItem>
                      <SelectItem value="sem_subsetor">Sem subsetor</SelectItem>
                      {subsetoresDisponiveis.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Popover open={filtrosAtendenteOpen} onOpenChange={setFiltrosAtendenteOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-8 gap-1.5 text-xs bg-transparent border-white/10",
                        atendenteFilter !== 'all' && "border-emerald-500/50 text-emerald-400"
                      )}
                    >
                      <Users className="h-3 w-3" />
                      {atendenteFilter !== 'all'
                        ? (atendentesUnicos.find(a => a.id === atendenteFilter)?.nome || 'Atendente')
                        : 'Atendente'
                      }
                      {atendenteFilter !== 'all' && (
                        <span className="h-4 min-w-[16px] px-1 rounded-full bg-emerald-500/20 text-[10px] text-emerald-400 flex items-center justify-center">1</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3" align="end" onCloseAutoFocus={() => setFiltroAtendenteSearch('')}>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filtrar por atendente</p>
                      <input
                        type="text"
                        placeholder="Buscar atendente..."
                        value={filtroAtendenteSearch}
                        onChange={(e) => setFiltroAtendenteSearch(e.target.value)}
                        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        autoFocus
                      />
                      <div className="space-y-1 max-h-[280px] overflow-y-auto">
                        {!filtroAtendenteSearch && (
                          <button
                            onClick={() => { setAtendenteFilter('all'); setFiltrosAtendenteOpen(false) }}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
                              atendenteFilter === 'all' && "font-medium text-primary"
                            )}
                          >
                            <Check className={cn("h-3.5 w-3.5", atendenteFilter !== 'all' && "invisible")} />
                            Todos os atendentes
                          </button>
                        )}
                        {atendentesUnicos
                          .filter(a => !filtroAtendenteSearch || a.nome.toLowerCase().includes(filtroAtendenteSearch.toLowerCase()))
                          .map((a) => (
                          <button
                            key={a.id}
                            onClick={() => { setAtendenteFilter(a.id); setFiltrosAtendenteOpen(false) }}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
                              atendenteFilter === a.id && "font-medium text-primary"
                            )}
                          >
                            <Check className={cn("h-3.5 w-3.5", atendenteFilter !== a.id && "invisible")} />
                            {a.nome}
                          </button>
                        ))}
                        {atendentesUnicos.length === 0 && (
                          <p className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum atendente ativo</p>
                        )}
                        {filtroAtendenteSearch && atendentesUnicos.filter(a => a.nome.toLowerCase().includes(filtroAtendenteSearch.toLowerCase())).length === 0 && (
                          <p className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum resultado para &quot;{filtroAtendenteSearch}&quot;</p>
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                <Button variant="ghost" size="icon" onClick={() => mutate()} className="h-8 w-8 text-white/40 hover:text-white/70 lg:hidden">
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* ---- Ticket list (scrollable) ---- */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 pb-4">
            {/* Em Andamento Tab */}
            {activeTab === 'em-andamento' && (
              <>
                {isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="glass-card rounded-xl p-3">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-32 flex-1" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : ticketsEmAndamento.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <AlertCircle className="mb-3 h-10 w-10 text-white/20" />
                    <p className="text-sm">Nenhum atendimento em andamento</p>
                  </div>
                ) : (
                  ticketsEmAndamento.map((ticket: any) => {
                    const aguardandoResposta = ticket.status === 'em_atendimento' && !ticket.primeira_resposta_em
                    const isSelected = selectedTicket?.id === ticket.id
                    return (
                      <button
                        key={ticket.id}
                        onClick={() => openConversation(ticket)}
                        className={cn(
                          "w-full text-left glass-card rounded-xl p-3 transition-all hover:bg-white/[0.04] group cursor-pointer",
                          aguardandoResposta && "border-l-2 border-l-yellow-500/60",
                          isSelected && "ring-1 ring-emerald-500/50 bg-emerald-500/[0.03]"
                        )}
                      >
                        {/* Row 1: ticket #, client, status, time */}
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-mono font-semibold text-white/70 tabular-nums shrink-0">
                            {ticket.numero ? `#${ticket.numero}` : '--'}
                          </span>
                          <span className="h-1 w-1 rounded-full bg-white/20 shrink-0" />
                          <span className="text-sm font-medium text-white truncate">{ticket.contato}</span>
                          {ticket.telefone && (
                            <span className="text-[11px] text-white/30 hidden sm:inline shrink-0">{formatPhone(ticket.telefone)}</span>
                          )}
                          <div className="ml-auto flex items-center gap-1.5 shrink-0">
                            {aguardandoResposta ? (
                              <Badge variant="outline" className="bg-yellow-900/40 text-yellow-300 border-yellow-700/50 text-[10px] px-1.5 py-0 h-5">
                                <Clock className="mr-1 h-2.5 w-2.5" />
                                Sem resposta
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-white/30">1a: {ticket.tempoPrimeiraResposta || '--'}</span>
                            )}
                          </div>
                        </div>

                        {/* Row 2: setor, agent, duration */}
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-white/40 truncate">
                            {ticket.setor}
                            {ticket.subsetor && <span className="text-white/20"> / {ticket.subsetor}</span>}
                          </span>
                          <span className="h-1 w-1 rounded-full bg-white/10 shrink-0" />
                          {ticket.atendente ? (
                            <span className="flex items-center gap-1 text-white/50 shrink-0">
                              <span className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                ticket.colaboradores?.is_online && !ticket.colaboradores?.pausa_atual_id
                                  ? 'bg-emerald-500'
                                  : ticket.colaboradores?.pausa_atual_id
                                    ? 'bg-amber-500'
                                    : 'bg-white/30'
                              )} />
                              {ticket.atendente}
                            </span>
                          ) : (
                            <span className="text-white/30">Sem atendente</span>
                          )}
                          <div className="ml-auto flex items-center gap-1 shrink-0">
                            <Clock className="h-3 w-3 text-white/20" />
                            <span className="text-[11px] font-mono font-medium text-white/60 tabular-nums">{ticket.tempoAtendimento}</span>
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </>
            )}

            {/* Aguardando Tab */}
            {activeTab === 'aguardando' && (
              <>
                {isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="glass-card rounded-xl p-3">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-32 flex-1" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : ticketsAguardando.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <AlertCircle className="mb-3 h-10 w-10 text-white/20" />
                    <p className="text-sm">Nenhum ticket aguardando</p>
                  </div>
                ) : (
                  ticketsAguardando.map((ticket: any) => {
                    const isSelected = selectedTicket?.id === ticket.id
                    return (
                      <button
                        key={ticket.id}
                        onClick={() => openConversation(ticket)}
                        className={cn(
                          "w-full text-left glass-card rounded-xl p-3 transition-all hover:bg-white/[0.04] border-l-2 border-l-orange-500/40 cursor-pointer",
                          isSelected && "ring-1 ring-orange-500/50 bg-orange-500/[0.03]"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-mono font-semibold text-white/70 tabular-nums shrink-0">
                            {ticket.numero ? `#${ticket.numero}` : '--'}
                          </span>
                          <span className="h-1 w-1 rounded-full bg-white/20 shrink-0" />
                          <span className="text-sm font-medium text-white truncate">{ticket.contato}</span>
                          {ticket.telefone && (
                            <span className="text-[11px] text-white/30 hidden sm:inline shrink-0">{formatPhone(ticket.telefone)}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-white/40 truncate">
                            {ticket.setor}
                            {ticket.subsetor && <span className="text-white/20"> / {ticket.subsetor}</span>}
                          </span>
                          <div className="ml-auto flex items-center gap-1 shrink-0">
                            <Clock className="h-3 w-3 text-orange-400/60" />
                            <span className="text-[11px] font-mono font-medium text-orange-400 tabular-nums">{ticket.tempoEspera}</span>
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </>
            )}

            {/* Atendentes Tab */}
            {activeTab === 'atendentes' && (
              <div className="space-y-3">
                <div className="relative max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar atendente..."
                    value={searchAtendente}
                    onChange={(e) => setSearchAtendente(e.target.value)}
                    className="pl-8 h-8 text-xs rounded-lg glass-input"
                  />
                </div>
                {isLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 rounded-xl" />
                    ))}
                  </div>
                ) : atendentesLista.length === 0 ? (
                  <div className="flex h-32 flex-col items-center justify-center text-muted-foreground">
                    <AlertCircle className="mb-2 h-8 w-8 text-white/20" />
                    <p className="text-sm">{searchAtendente ? 'Nenhum atendente encontrado' : 'Nenhum atendente neste setor'}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                    {atendentesLista.map((atendente: any) => {
                      const isOnline = isAtendenteOnline(atendente) && !atendente.pausa_atual_id
                      const isPausa = !!atendente.pausa_atual_id
                      return (
                        <div
                          key={atendente.id}
                          className="flex items-center gap-3 glass-card rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.03]"
                        >
                          <span
                            className={cn(
                              'h-2.5 w-2.5 shrink-0 rounded-full',
                              isOnline ? 'bg-emerald-500' : isPausa ? 'bg-amber-500' : 'bg-white/20'
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-white">{atendente.nome}</p>
                            <p className={cn(
                              'text-[11px]',
                              isOnline ? 'text-emerald-400' : isPausa ? 'text-amber-400' : 'text-white/30'
                            )}>
                              {isOnline ? 'Online' : isPausa ? 'Em pausa' : 'Offline'}
                            </p>
                          </div>
                          {atendente.ticketsAtivos > 0 && (
                            <Badge variant="secondary" className="shrink-0 text-[10px] bg-white/5 border-white/10 text-white/60">
                              {atendente.ticketsAtivos} {atendente.ticketsAtivos === 1 ? 'ticket' : 'tickets'}
                            </Badge>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* ========== RIGHT PANEL — Conversation ========== */}
        {/* Desktop: inline panel */}
        <aside className={cn(
          "hidden shrink-0 overflow-y-auto flex-col border-l border-white/5 bg-[#080b14]/60",
          selectedTicket ? "lg:flex w-[380px]" : "lg:hidden"
        )}>
          {selectedTicket ? (
            <>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 shrink-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">Ticket #{selectedTicket.numero}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 h-5 border-white/10 text-white/50">
                      {selectedTicket.status === 'em_atendimento' ? 'Em atendimento' : selectedTicket.status === 'aberto' ? 'Aberto' : selectedTicket.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-white/40 truncate mt-0.5">
                    {selectedTicket.contato} {selectedTicket.telefone ? `- ${formatPhone(selectedTicket.telefone)}` : ''} - {selectedTicket.setor}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={closeConversation} className="h-7 w-7 text-white/40 hover:text-white/70 shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Tabs */}
              <div className="border-b border-white/5 shrink-0">
                <div className="flex">
                  <button
                    onClick={() => setConversationTab('conversa')}
                    className={cn(
                      "flex-1 px-4 py-2 text-xs font-medium border-b-2 transition-colors",
                      conversationTab === 'conversa'
                        ? "border-emerald-500 text-emerald-400"
                        : "border-transparent text-white/40 hover:text-white/60"
                    )}
                  >
                    <MessageCircle className="inline h-3 w-3 mr-1" />
                    Conversa
                  </button>
                  <button
                    onClick={() => setConversationTab('historico')}
                    className={cn(
                      "flex-1 px-4 py-2 text-xs font-medium border-b-2 transition-colors",
                      conversationTab === 'historico'
                        ? "border-emerald-500 text-emerald-400"
                        : "border-transparent text-white/40 hover:text-white/60"
                    )}
                  >
                    <History className="inline h-3 w-3 mr-1" />
                    Historico ({ticketHistory.length})
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              {(selectedTicket.status === 'em_atendimento' || selectedTicket.status === 'aberto') && (
                <div className="flex gap-2 border-b border-white/5 px-3 py-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openTransferDialog}
                    className="flex-1 gap-1 h-7 text-xs bg-transparent border-white/10 text-white/60 hover:text-white"
                  >
                    <ArrowRightLeft className="h-3 w-3" />
                    Transferir
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setEncerrarDialogOpen(true)}
                    className="flex-1 gap-1 h-7 text-xs"
                  >
                    <XCircle className="h-3 w-3" />
                    Encerrar
                  </Button>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto">
                {conversationTab === 'conversa' && (
                  <div className="p-3 space-y-2.5">
                    {loadingMessages ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-white/20" />
                      </div>
                    ) : conversationMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center text-white/30">
                        <MessageCircle className="mb-2 h-8 w-8" />
                        <p className="text-xs">Nenhuma mensagem ainda</p>
                      </div>
                    ) : (
                      conversationMessages.map((msg: any) => (
                        msg.remetente === 'sistema' ? (
                          <div key={msg.id} className="flex justify-center">
                            <div className={cn(
                              "flex items-center gap-2 px-2.5 py-1 rounded-lg border text-[10px] max-w-[90%]",
                              msg.conteudo.startsWith('Transferido')
                                ? "bg-blue-950/30 border-blue-800/50 text-blue-300"
                                : "bg-white/5 border-white/5 text-white/40"
                            )}>
                              {msg.conteudo.startsWith('Transferido') ? (
                                <ArrowRightLeft className="h-3 w-3 shrink-0 text-blue-400" />
                              ) : (
                                <Megaphone className="h-3 w-3 shrink-0 text-white/30" />
                              )}
                              <span>{msg.conteudo}</span>
                              <span className="shrink-0 ml-1 opacity-60">
                                {new Date(msg.enviado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex",
                              msg.remetente === 'cliente' ? "justify-start" : "justify-end"
                            )}
                          >
                            <div
                              className={cn(
                                "max-w-[80%] rounded-lg px-3 py-2 text-[13px]",
                                msg.remetente === 'cliente'
                                  ? "bg-white/5 text-white/80"
                                  : msg.remetente === 'bot'
                                  ? "bg-blue-900/30 text-blue-200"
                                  : "bg-emerald-600/20 text-emerald-100 border border-emerald-500/10"
                              )}
                            >
                              {msg.url_imagem && (msg.tipo === 'imagem' || msg.media_type?.startsWith('image/')) && (
                                <img src={msg.url_imagem} alt="" className="max-w-full rounded mb-1" />
                              )}
                              <p className="break-words">{msg.conteudo}</p>
                              <p className="text-[10px] mt-1 opacity-50">
                                {new Date(msg.enviado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        )
                      ))
                    )}
                  </div>
                )}

                {conversationTab === 'historico' && (
                  <div className="p-3 space-y-2">
                    {loadingHistory ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-white/20" />
                      </div>
                    ) : ticketHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center text-white/30">
                        <History className="mb-2 h-8 w-8" />
                        <p className="text-xs">Nenhum atendimento anterior</p>
                      </div>
                    ) : (
                      ticketHistory.map((ticket: any) => (
                        <div key={ticket.id} className="border border-white/5 rounded-lg overflow-hidden">
                          <button
                            onClick={() => loadHistoryMessages(ticket.id)}
                            className="w-full px-3 py-2 text-left hover:bg-white/[0.03] transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={ticket.status === 'encerrado' ? 'secondary' : 'default'}
                                  className="text-[10px] px-1.5 h-5"
                                >
                                  {ticket.status === 'encerrado' ? 'Encerrado' : ticket.status === 'em_atendimento' ? 'Em atendimento' : 'Aberto'}
                                </Badge>
                                <span className="text-xs font-mono font-medium text-white/60">#{ticket.numero}</span>
                              </div>
                              <span className="text-[10px] text-white/30">
                                {new Date(ticket.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                {' '}
                                {new Date(ticket.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-white/30">
                              <span>{ticket.setores?.nome || '-'}</span>
                              <span>-</span>
                              <span>{ticket.colaboradores?.nome || 'Sem atendente'}</span>
                            </div>
                          </button>

                          {expandedHistory === ticket.id && (
                            <div className="border-t border-white/5 bg-white/[0.02] px-3 py-2 space-y-2 max-h-64 overflow-y-auto">
                              {!historyMessages[ticket.id] ? (
                                <div className="flex justify-center py-2">
                                  <Loader2 className="h-4 w-4 animate-spin text-white/20" />
                                </div>
                              ) : historyMessages[ticket.id].length === 0 ? (
                                <p className="text-xs text-white/30 text-center py-2">Sem mensagens</p>
                              ) : (
                                historyMessages[ticket.id].map((msg: any) => (
                                  msg.remetente === 'sistema' ? (
                                    <div key={msg.id} className="flex justify-center">
                                      <div className={cn(
                                        "flex items-center gap-1.5 px-2 py-1 rounded text-[10px]",
                                        msg.conteudo.startsWith('Transferido')
                                          ? "bg-blue-950/30 text-blue-300"
                                          : "bg-white/5 text-white/30"
                                      )}>
                                        {msg.conteudo.startsWith('Transferido') ? (
                                          <ArrowRightLeft className="h-2.5 w-2.5 shrink-0" />
                                        ) : (
                                          <Megaphone className="h-2.5 w-2.5 shrink-0" />
                                        )}
                                        <span>{msg.conteudo}</span>
                                        <span className="opacity-60">
                                          {new Date(msg.enviado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div
                                      key={msg.id}
                                      className={cn(
                                        "flex",
                                        msg.remetente === 'cliente' ? "justify-start" : "justify-end"
                                      )}
                                    >
                                      <div
                                        className={cn(
                                          "max-w-[80%] rounded px-2 py-1 text-[11px]",
                                          msg.remetente === 'cliente'
                                            ? "bg-white/5 border border-white/5 text-white/70"
                                            : "bg-emerald-600/20 text-emerald-200"
                                        )}
                                      >
                                        <p className="break-words">{msg.conteudo}</p>
                                        <p className="text-[9px] mt-0.5 opacity-50">
                                          {new Date(msg.enviado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                      </div>
                                    </div>
                                  )
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-white/20 px-6">
              <MessageCircle className="h-12 w-12 mb-3" />
              <p className="text-sm font-medium">Selecione um ticket</p>
              <p className="text-xs text-white/10 mt-1 text-center">Clique em um ticket na lista para visualizar a conversa</p>
            </div>
          )}
        </aside>

        {/* Mobile: conversation overlay */}
        {selectedTicket && (
          <div className="fixed inset-0 z-50 flex flex-col bg-[#06080f] lg:hidden">
            {/* Mobile Header */}
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 shrink-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">Ticket #{selectedTicket.numero}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 h-5 border-white/10 text-white/50">
                    {selectedTicket.status === 'em_atendimento' ? 'Em atendimento' : selectedTicket.status === 'aberto' ? 'Aberto' : selectedTicket.status}
                  </Badge>
                </div>
                <p className="text-xs text-white/40 truncate mt-0.5">
                  {selectedTicket.contato} - {selectedTicket.setor}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={closeConversation} className="h-8 w-8 text-white/40 shrink-0">
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Mobile Tabs */}
            <div className="border-b border-white/5 shrink-0">
              <div className="flex">
                <button
                  onClick={() => setConversationTab('conversa')}
                  className={cn(
                    "flex-1 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors",
                    conversationTab === 'conversa'
                      ? "border-emerald-500 text-emerald-400"
                      : "border-transparent text-white/40 hover:text-white/60"
                  )}
                >
                  <MessageCircle className="inline h-3.5 w-3.5 mr-1" />
                  Conversa
                </button>
                <button
                  onClick={() => setConversationTab('historico')}
                  className={cn(
                    "flex-1 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors",
                    conversationTab === 'historico'
                      ? "border-emerald-500 text-emerald-400"
                      : "border-transparent text-white/40 hover:text-white/60"
                  )}
                >
                  <History className="inline h-3.5 w-3.5 mr-1" />
                  Historico ({ticketHistory.length})
                </button>
              </div>
            </div>

            {/* Mobile Action Buttons */}
            {(selectedTicket.status === 'em_atendimento' || selectedTicket.status === 'aberto') && (
              <div className="flex gap-2 border-b border-white/5 px-4 py-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openTransferDialog}
                  className="flex-1 gap-1 bg-transparent border-white/10 text-white/60"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  Transferir
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setEncerrarDialogOpen(true)}
                  className="flex-1 gap-1"
                >
                  <XCircle className="h-4 w-4" />
                  Encerrar
                </Button>
              </div>
            )}

            {/* Mobile Messages */}
            <div className="flex-1 overflow-y-auto">
              {conversationTab === 'conversa' && (
                <div className="p-4 space-y-3">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-white/20" />
                    </div>
                  ) : conversationMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-white/30">
                      <MessageCircle className="mb-2 h-8 w-8" />
                      <p>Nenhuma mensagem ainda</p>
                    </div>
                  ) : (
                    conversationMessages.map((msg: any) => (
                      msg.remetente === 'sistema' ? (
                        <div key={msg.id} className="flex justify-center">
                          <div className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] max-w-[90%]",
                            msg.conteudo.startsWith('Transferido')
                              ? "bg-blue-950/30 border-blue-800/50 text-blue-300"
                              : "bg-white/5 border-white/5 text-white/40"
                          )}>
                            {msg.conteudo.startsWith('Transferido') ? (
                              <ArrowRightLeft className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                            ) : (
                              <Megaphone className="h-3.5 w-3.5 shrink-0 text-white/30" />
                            )}
                            <span>{msg.conteudo}</span>
                            <span className="shrink-0 ml-1 opacity-60">
                              {new Date(msg.enviado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex",
                            msg.remetente === 'cliente' ? "justify-start" : "justify-end"
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                              msg.remetente === 'cliente'
                                ? "bg-white/5 text-white/80"
                                : msg.remetente === 'bot'
                                ? "bg-blue-900/30 text-blue-200"
                                : "bg-emerald-600/20 text-emerald-100 border border-emerald-500/10"
                            )}
                          >
                            {msg.url_imagem && (msg.tipo === 'imagem' || msg.media_type?.startsWith('image/')) && (
                              <img src={msg.url_imagem} alt="" className="max-w-full rounded mb-1" />
                            )}
                            <p className="break-words">{msg.conteudo}</p>
                            <p className="text-[10px] mt-1 opacity-50">
                              {new Date(msg.enviado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      )
                    ))
                  )}
                </div>
              )}

              {conversationTab === 'historico' && (
                <div className="p-4 space-y-3">
                  {loadingHistory ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-white/20" />
                    </div>
                  ) : ticketHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-white/30">
                      <History className="mb-2 h-8 w-8" />
                      <p>Nenhum atendimento anterior</p>
                    </div>
                  ) : (
                    ticketHistory.map((ticket: any) => (
                      <div key={ticket.id} className="border border-white/5 rounded-lg overflow-hidden">
                        <button
                          onClick={() => loadHistoryMessages(ticket.id)}
                          className="w-full px-3 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={ticket.status === 'encerrado' ? 'secondary' : 'default'}
                                className="text-[10px] px-1.5 h-5"
                              >
                                {ticket.status === 'encerrado' ? 'Encerrado' : ticket.status === 'em_atendimento' ? 'Em atendimento' : 'Aberto'}
                              </Badge>
                              <span className="text-xs font-mono font-medium text-white/60">#{ticket.numero}</span>
                            </div>
                            <span className="text-[10px] text-white/30">
                              {new Date(ticket.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                              {' '}
                              {new Date(ticket.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-white/30">
                            <span>{ticket.setores?.nome || '-'}</span>
                            <span>-</span>
                            <span>{ticket.colaboradores?.nome || 'Sem atendente'}</span>
                          </div>
                        </button>

                        {expandedHistory === ticket.id && (
                          <div className="border-t border-white/5 bg-white/[0.02] px-3 py-2 space-y-2 max-h-64 overflow-y-auto">
                            {!historyMessages[ticket.id] ? (
                              <div className="flex justify-center py-2">
                                <Loader2 className="h-4 w-4 animate-spin text-white/20" />
                              </div>
                            ) : historyMessages[ticket.id].length === 0 ? (
                              <p className="text-xs text-white/30 text-center py-2">Sem mensagens</p>
                            ) : (
                              historyMessages[ticket.id].map((msg: any) => (
                                msg.remetente === 'sistema' ? (
                                  <div key={msg.id} className="flex justify-center">
                                    <div className={cn(
                                      "flex items-center gap-1.5 px-2 py-1 rounded text-[10px]",
                                      msg.conteudo.startsWith('Transferido')
                                        ? "bg-blue-950/30 text-blue-300"
                                        : "bg-white/5 text-white/30"
                                    )}>
                                      {msg.conteudo.startsWith('Transferido') ? (
                                        <ArrowRightLeft className="h-2.5 w-2.5 shrink-0" />
                                      ) : (
                                        <Megaphone className="h-2.5 w-2.5 shrink-0" />
                                      )}
                                      <span>{msg.conteudo}</span>
                                      <span className="opacity-60">
                                        {new Date(msg.enviado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    key={msg.id}
                                    className={cn(
                                      "flex",
                                      msg.remetente === 'cliente' ? "justify-start" : "justify-end"
                                    )}
                                  >
                                    <div
                                      className={cn(
                                        "max-w-[80%] rounded px-2 py-1 text-[11px]",
                                        msg.remetente === 'cliente'
                                          ? "bg-white/5 border border-white/5 text-white/70"
                                          : "bg-emerald-600/20 text-emerald-200"
                                      )}
                                    >
                                      <p className="break-words">{msg.conteudo}</p>
                                      <p className="text-[9px] mt-0.5 opacity-50">
                                        {new Date(msg.enviado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                      </p>
                                    </div>
                                  </div>
                                )
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===== DIALOGS (kept intact) ===== */}

      {/* Encerrar Dialog */}
      <AlertDialog open={encerrarDialogOpen} onOpenChange={setEncerrarDialogOpen}>
        <AlertDialogContent className="bg-[#0e1019] border border-white/8 rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja encerrar este ticket? O ticket sera movido para o historico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEncerrarTicket}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar Encerramento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="sm:max-w-md bg-[#0e1019] border border-white/8 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Transferir Ticket
            </DialogTitle>
            <DialogDescription>
              Transfira este ticket para outro setor ou atendente.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="atendente" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="atendente">Atendente</TabsTrigger>
              <TabsTrigger value="setor">Setor</TabsTrigger>
            </TabsList>

            <TabsContent value="atendente" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Selecione um atendente do setor atual</Label>
                <Select value={selectedAtendenteTransfer} onValueChange={setSelectedAtendenteTransfer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um atendente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {atendentesDisponiveis.map((atendente) => {
                      const online = isAtendenteOnline(atendente)
                      return (
                        <SelectItem key={atendente.id} value={atendente.id} disabled={!online}>
                          <div className="flex items-center gap-2">
                            <span className={cn('h-2 w-2 rounded-full', online ? 'bg-green-500' : 'bg-gray-400')} />
                            <span className={!online ? 'text-muted-foreground' : ''}>{atendente.nome}</span>
                            {!online && <span className="text-xs text-muted-foreground">(Offline)</span>}
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                {atendentesDisponiveis.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum outro atendente neste setor.</p>
                )}
                {atendentesDisponiveis.length > 0 && !atendentesDisponiveis.some((a) => isAtendenteOnline(a)) && (
                  <p className="text-sm text-amber-600">Todos os atendentes estao offline.</p>
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
                <p className="text-sm text-destructive">Este atendente esta offline. Selecione um atendente online.</p>
              )}
            </TabsContent>

            <TabsContent value="setor" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Selecione o setor de destino</Label>
                <Select value={selectedSetorTransfer} onValueChange={handleSetorTransferChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um setor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {setoresTransfer.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground text-center">
                        Nenhum setor habilitado para transferencia. Configure em Configuracoes do Setor.
                      </div>
                    ) : (
                      setoresTransfer.map((setor) => (
                        <SelectItem key={setor.id} value={setor.id}>{setor.nome}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedSetorTransfer !== 'all' && (
                <div className="space-y-2">
                  <Label>Atribuir a um atendente (opcional)</Label>
                  <Select value={selectedAtendenteTransfer} onValueChange={setSelectedAtendenteTransfer}>
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
                          <SelectItem key={atendente.id} value={atendente.id} disabled={!online}>
                            <div className="flex items-center gap-2">
                              <span className={cn('h-2 w-2 rounded-full', online ? 'bg-green-500' : 'bg-gray-400')} />
                              <span className={!online ? 'text-muted-foreground' : ''}>{atendente.nome}</span>
                              {!online && <span className="text-xs text-muted-foreground">(Offline)</span>}
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedSetorTransfer !== 'all' && atendentesDisponiveis.length > 0 && !atendentesDisponiveis.some((a) => isAtendenteOnline(a)) && (
                <p className="text-sm text-blue-400 bg-blue-950/30 p-2 rounded-md border border-blue-800/30">
                  Nenhum atendente online neste setor. O ticket ira para a fila e sera atribuido automaticamente quando alguem ficar online.
                </p>
              )}

              <Button
                onClick={handleTransferTicket}
                disabled={!selectedSetorTransfer || selectedSetorTransfer === 'all' || transferLoading}
                className="w-full"
              >
                {transferLoading ? 'Transferindo...' : 'Transferir para Setor'}
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  )
}
