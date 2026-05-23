'use client'

import React from "react"

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { parseMessageContent } from '@/lib/whatsapp-message-parser'
import { SpecialMessageContent } from '@/components/chat/special-message-content'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Ticket,
  Plus,
  Eye,
  Filter,
  Search,
  Loader2,
  Clock,
  User,
  MessageSquare,
  ArrowRight,
  FileText,
  Building2,
  ChevronDown,
  ChevronUp,
  Phone,
  Hash,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useColaborador, useSetores } from '@/lib/hooks/use-data'

interface Cliente {
  id: string
  nome: string
  telefone: string
  email: string | null
}

interface Setor {
  id: string
  nome: string
  canal?: string
}

interface Colaborador {
  id: string
  nome: string
  is_online?: boolean
  last_heartbeat?: string
}

const HEARTBEAT_STALE_THRESHOLD = 3 * 60 * 1000
function isColabOnline(c: Colaborador | null | undefined): boolean {
  if (!c?.is_online) return false
  if (!c.last_heartbeat) return false
  return (Date.now() - new Date(c.last_heartbeat).getTime()) < HEARTBEAT_STALE_THRESHOLD
}

interface Subsetor {
  id: string
  nome: string
}

interface TicketData {
  id: string
  cliente_id: string
  colaborador_id: string | null
  setor_id: string | null
  subsetor_id: string | null
  status: 'aberto' | 'em_atendimento' | 'encerrado'
  prioridade: 'baixa' | 'media' | 'alta'
  canal: string
  assunto: string | null
  created_at: string
  updated_at: string
  criado_em: string
  primeira_resposta_em: string | null
  cliente?: Cliente | null
  colaborador?: Colaborador | null
  setor?: Setor | null
  subsetor?: Subsetor | null
}

interface TicketLog {
  id: string
  ticket_id: string
  colaborador_id: string | null
  tipo: string
  descricao: string
  created_at: string
  colaborador?: Colaborador | null
}

interface Mensagem {
  id: string
  ticket_id: string
  remetente: 'cliente' | 'colaborador'
  conteudo: string
  tipo: string
  created_at: string
  url_imagem?: string | null
  media_type?: string | null
}

const statusColors = {
  aberto: 'glass-badge bg-blue-500/15 text-blue-400 border-blue-500/20',
  em_atendimento: 'glass-badge bg-amber-500/15 text-amber-400 border-amber-500/20',
  encerrado: 'glass-badge bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
}

const statusLabels = {
  aberto: 'Aberto',
  em_atendimento: 'Em Atendimento',
  encerrado: 'Encerrado',
}

const prioridadeColors = {
  baixa: 'glass-badge bg-foreground/5 text-foreground/60 border-foreground/10',
  media: 'glass-badge bg-orange-500/15 text-orange-400 border-orange-500/20',
  alta: 'glass-badge bg-red-500/15 text-red-400 border-red-500/20',
}

const prioridadeLabels = {
  baixa: 'Baixa',
  media: 'Media',
  alta: 'Alta',
}

function formatTimeDiff(startDate: string, endDate?: string | null): string {
  const start = new Date(startDate).getTime()
  const end = endDate ? new Date(endDate).getTime() : Date.now()
  const diffMs = Math.max(0, end - start)
  const totalSeconds = Math.floor(diffMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`
  }
  return `${seconds}s`
}

function LiveTimer({ startDate }: { startDate: string }) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <span className="text-amber-400 font-mono text-xs font-medium tabular-nums">
      {formatTimeDiff(startDate)}
    </span>
  )
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketData[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [setores, setSetores] = useState<Setor[]>([])
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [prioridadeFilter, setPrioridadeFilter] = useState<string>('all')
  const [setorFilter, setSetorFilter] = useState<string>('all')
  const [subsetorFilter, setSubsetorFilter] = useState<string>('all')
  const [subsetoresDisponiveis, setSubsetoresDisponiveis] = useState<Subsetor[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  // Expanded card
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null)

  // Create modal
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createFormData, setCreateFormData] = useState({
    cliente_id: '',
    setor_id: '',
    prioridade: 'media' as 'baixa' | 'media' | 'alta',
    canal: 'whatsapp',
    assunto: '',
  })
  const [saving, setSaving] = useState(false)

  // Details modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null)
  const [ticketLogs, setTicketLogs] = useState<TicketLog[]>([])
  const [ticketMessages, setTicketMessages] = useState<Mensagem[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)

  // Transfer modal
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [transferSetorId, setTransferSetorId] = useState('')
  const [transferAtendenteId, setTransferAtendenteId] = useState('')
  const [transferObservacao, setTransferObservacao] = useState('')
  const [transferAtendentes, setTransferAtendentes] = useState<Colaborador[]>([])
  const [loadingAtendentes, setLoadingAtendentes] = useState(false)

  // Observation modal
  const [observationModalOpen, setObservationModalOpen] = useState(false)
  const [newObservation, setNewObservation] = useState('')

  const supabase = createClient()
  const { toast } = useToast()
  const { data: colaborador } = useColaborador()
  const { data: setoresAcessiveis = [] } = useSetores(colaborador?.id, colaborador?.is_master, colaborador?.organizacao_id)
  const setorIdsAcessiveis = setoresAcessiveis.map((s: any) => s.id)

  async function fetchTickets() {
    if (!colaborador?.organizacao_id) return
    const orgId = colaborador.organizacao_id

    if (setorIdsAcessiveis.length === 0 && !colaborador?.is_master) {
      setTickets([])
      setLoading(false)
      return
    }

    setLoading(true)

    let query = supabase
      .from('tickets')
      .select(`
        *,
        cliente:clientes(id, nome, telefone, email),
        colaborador:colaboradores(id, nome),
        setor:setores(id, nome)
      `)
      .eq('organizacao_id', orgId)
      .order('created_at', { ascending: false })

    // Filter by accessible setores (unless master)
    if (!colaborador?.is_master && setorIdsAcessiveis.length > 0) {
      query = query.in('setor_id', setorIdsAcessiveis)
    }

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }
    if (prioridadeFilter !== 'all') {
      query = query.eq('prioridade', prioridadeFilter)
    }
    if (setorFilter !== 'all') {
      query = query.eq('setor_id', setorFilter)
    }

    const { data, error } = await query

    if (!error && data) {
      let filtered = data
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        filtered = data.filter(
          (t) =>
            t.cliente?.nome?.toLowerCase().includes(term) ||
            t.cliente?.telefone?.includes(term) ||
            t.assunto?.toLowerCase().includes(term)
        )
      }
      setTickets(filtered)
    }

    setLoading(false)
  }

  async function fetchDropdownData() {
    if (!colaborador?.organizacao_id) return
    const orgId = colaborador.organizacao_id

    const [clientesRes, colaboradoresRes] = await Promise.all([
      supabase.from('clientes').select('id, nome, telefone, email').eq('organizacao_id', orgId).order('nome'),
      supabase.from('colaboradores').select('id, nome, is_online').eq('organizacao_id', orgId).eq('ativo', true).order('nome'),
    ])

    if (clientesRes.data) setClientes(clientesRes.data)
    if (colaboradoresRes.data) setColaboradores(colaboradoresRes.data)
  }

  // Sync setores from useSetores hook
  useEffect(() => {
    if (setoresAcessiveis.length > 0) {
      setSetores(setoresAcessiveis.map((s: any) => ({ id: s.id, nome: s.nome, canal: s.canal })))
    }
  }, [setoresAcessiveis])

  useEffect(() => {
    if (colaborador?.organizacao_id) {
      fetchDropdownData()
    }
  }, [colaborador?.organizacao_id])

  useEffect(() => {
    if (colaborador?.organizacao_id) {
      fetchTickets()
    }
  }, [statusFilter, prioridadeFilter, setorFilter, searchTerm, colaborador?.organizacao_id, setorIdsAcessiveis.length])

  async function handleCreateTicket() {
    if (!createFormData.cliente_id) {
      toast({ title: 'Erro', description: 'Selecione um cliente', variant: 'destructive' })
      return
    }

    setSaving(true)

    const { data, error } = await supabase
      .from('tickets')
      .insert({
        cliente_id: createFormData.cliente_id,
        setor_id: createFormData.setor_id || null,
        prioridade: createFormData.prioridade,
        canal: createFormData.canal,
        assunto: createFormData.assunto || null,
        status: 'aberto',
      })
      .select()
      .single()

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao criar ticket', variant: 'destructive' })
    } else {
      toast({ title: 'Sucesso', description: 'Ticket criado com sucesso' })

      // Add initial log
      await supabase.from('ticket_logs').insert({
        ticket_id: data.id,
        tipo: 'criacao',
        descricao: 'Ticket criado manualmente pelo dashboard',
      })

      setCreateModalOpen(false)
      setCreateFormData({
        cliente_id: '',
        setor_id: '',
        prioridade: 'media',
        canal: 'whatsapp',
        assunto: '',
      })
      fetchTickets()
    }

    setSaving(false)
  }

  async function openDetailsModal(ticket: TicketData) {
    setSelectedTicket(ticket)
    setDetailsModalOpen(true)
    setLoadingDetails(true)

    // Fetch logs
    const { data: logsData } = await supabase
      .from('ticket_logs')
      .select(`
        *,
        colaborador:colaboradores(id, nome)
      `)
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: false })

    if (logsData) setTicketLogs(logsData)

    // Fetch messages
    const { data: messagesData } = await supabase
      .from('mensagens')
      .select('*')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true })

    if (messagesData) setTicketMessages(messagesData)

    setLoadingDetails(false)
  }

  async function handleTransferSetorChange(setorId: string) {
    setTransferSetorId(setorId)
    setTransferAtendenteId('')
    if (!setorId) {
      setTransferAtendentes([])
      return
    }
    setLoadingAtendentes(true)
    const { data } = await supabase
      .from('colaboradores')
      .select('id, nome, is_online, last_heartbeat')
      .eq('ativo', true)
      .contains('setor_ids', [setorId])
      .order('nome')
    setTransferAtendentes(data || [])
    setLoadingAtendentes(false)
  }

  async function handleTransfer() {
    if (!selectedTicket || !transferSetorId) {
      toast({ title: 'Erro', description: 'Selecione um setor', variant: 'destructive' })
      return
    }

    setSaving(true)

    const oldSetorName = selectedTicket.setor?.nome || 'Nenhum'
    const newSetor = setores.find((s) => s.id === transferSetorId)

    // Update ticket
    const actualAtendenteId = transferAtendenteId && transferAtendenteId !== 'fila' ? transferAtendenteId : null
    const updateData: Record<string, any> = {
      setor_id: transferSetorId,
      colaborador_id: actualAtendenteId,
      status: actualAtendenteId ? 'em_atendimento' : 'aberto',
    }
    const { error: updateError } = await supabase
      .from('tickets')
      .update(updateData)
      .eq('id', selectedTicket.id)

    if (updateError) {
      toast({ title: 'Erro', description: 'Erro ao transferir ticket', variant: 'destructive' })
    } else {
      // Add log
      const atendenteNome = actualAtendenteId ? transferAtendentes.find(a => a.id === actualAtendenteId)?.nome : null
      await supabase.from('ticket_logs').insert({
        ticket_id: selectedTicket.id,
        tipo: 'transferencia',
        descricao: `Ticket transferido de "${oldSetorName}" para "${newSetor?.nome}"${atendenteNome ? ` (atendente: ${atendenteNome})` : ''}${transferObservacao ? `. Obs: ${transferObservacao}` : ''}`,
      })

      // Insert system message in chat for transfer visibility
      const fromColabName = selectedTicket.colaborador?.nome || 'Sem atendente'
      const toColabName = atendenteNome || 'Aguardando atendente'
      const transferContent = `Transferido de ${fromColabName} - ${oldSetorName} >> ${toColabName} - ${newSetor?.nome}`

      const { error: msgError } = await supabase.from('mensagens').insert({
        ticket_id: selectedTicket.id,
        cliente_id: selectedTicket.cliente_id,
        remetente: 'sistema',
        conteudo: transferContent,
        tipo: 'texto',
        enviado_em: new Date().toISOString(),
      })
      if (msgError) {
        console.error('[v0] Erro ao inserir mensagem de transferencia:', msgError)
      }

      toast({ title: 'Sucesso', description: 'Ticket transferido com sucesso' })

      // Se o ticket foi para a fila (sem atendente), acionar distribuição imediata
      if (!actualAtendenteId) {
        fetch('/api/tickets/auto-assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }).catch(() => {})
      }

      setTransferModalOpen(false)
      setTransferSetorId('')
      setTransferAtendenteId('')
      setTransferObservacao('')
      setTransferAtendentes([])
      setDetailsModalOpen(false)
      fetchTickets()
    }

    setSaving(false)
  }

  async function handleAddObservation() {
    if (!selectedTicket || !newObservation.trim()) {
      toast({ title: 'Erro', description: 'Digite uma observacao', variant: 'destructive' })
      return
    }

    setSaving(true)

    const { error } = await supabase.from('ticket_logs').insert({
      ticket_id: selectedTicket.id,
      tipo: 'observacao',
      descricao: newObservation.trim(),
    })

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao adicionar observacao', variant: 'destructive' })
    } else {
      toast({ title: 'Sucesso', description: 'Observacao adicionada' })

      // Refresh logs
      const { data: logsData } = await supabase
        .from('ticket_logs')
        .select(`
          *,
          colaborador:colaboradores(id, nome)
        `)
        .eq('ticket_id', selectedTicket.id)
        .order('created_at', { ascending: false })

      if (logsData) setTicketLogs(logsData)

      setObservationModalOpen(false)
      setNewObservation('')
    }

    setSaving(false)
  }

  async function handleCloseTicket() {
    if (!selectedTicket) return

    setSaving(true)

    const { error } = await supabase
      .from('tickets')
      .update({ status: 'encerrado' })
      .eq('id', selectedTicket.id)

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao encerrar ticket', variant: 'destructive' })
    } else {
      await supabase.from('ticket_logs').insert({
        ticket_id: selectedTicket.id,
        tipo: 'encerramento',
        descricao: 'Ticket encerrado manualmente pelo dashboard',
      })

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

      toast({ title: 'Sucesso', description: 'Ticket encerrado' })
      setDetailsModalOpen(false)
      fetchTickets()
    }

    setSaving(false)
  }

  async function handleReopenTicket() {
    if (!selectedTicket) return

    setSaving(true)

    const { error } = await supabase
      .from('tickets')
      .update({ status: 'aberto' })
      .eq('id', selectedTicket.id)

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao reabrir ticket', variant: 'destructive' })
    } else {
      await supabase.from('ticket_logs').insert({
        ticket_id: selectedTicket.id,
        tipo: 'reabertura',
        descricao: 'Ticket reaberto manualmente pelo dashboard',
      })

      toast({ title: 'Sucesso', description: 'Ticket reaberto' })
      setDetailsModalOpen(false)
      fetchTickets()
    }

    setSaving(false)
  }

  const logTypeIcons: Record<string, React.ReactNode> = {
    criacao: <FileText className="h-4 w-4" />,
    transferencia: <ArrowRight className="h-4 w-4" />,
    observacao: <MessageSquare className="h-4 w-4" />,
    encerramento: <Clock className="h-4 w-4" />,
    reabertura: <Clock className="h-4 w-4" />,
    atendimento: <User className="h-4 w-4" />,
  }

  function toggleExpand(ticketId: string) {
    if (expandedTicketId === ticketId) {
      setExpandedTicketId(null)
    } else {
      setExpandedTicketId(ticketId)
      // Pre-fetch details for expanded ticket
      const ticket = tickets.find((t) => t.id === ticketId)
      if (ticket) {
        openDetailsModal(ticket)
      }
    }
  }

  return (
    <div className="flex flex-col gap-5 h-[calc(100vh-130px)]">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center border border-foreground/10">
            <Ticket className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Tickets</h1>
            <p className="text-sm text-muted-foreground/80">Gerencie todos os tickets de atendimento</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="glass-badge bg-foreground/5 text-muted-foreground border-foreground/10 px-2.5 py-1 rounded-full text-xs">
            {tickets.length} tickets
          </span>
          <Button
            onClick={() => setCreateModalOpen(true)}
            className="btn-glow rounded-xl gap-2 px-5"
          >
            <Plus className="h-4 w-4" />
            Novo Ticket
          </Button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-card rounded-2xl p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              placeholder="Buscar por cliente, telefone ou assunto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 glass-input rounded-xl text-foreground/80 placeholder:text-muted-foreground/50"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="glass-input rounded-xl text-foreground/70">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-page-bg-alt border-foreground/8">
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="aberto">Aberto</SelectItem>
              <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
              <SelectItem value="encerrado">Encerrado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
            <SelectTrigger className="glass-input rounded-xl text-foreground/70">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent className="bg-page-bg-alt border-foreground/8">
              <SelectItem value="all">Todas as Prioridades</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
              <SelectItem value="media">Media</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
            </SelectContent>
          </Select>
          <Select value={setorFilter} onValueChange={setSetorFilter}>
            <SelectTrigger className="glass-input rounded-xl text-foreground/70">
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent className="bg-page-bg-alt border-foreground/8">
              <SelectItem value="all">Todos os Setores</SelectItem>
              {setores.map((setor) => (
                <SelectItem key={setor.id} value={setor.id}>
                  {setor.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Card List */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl p-4 flex items-center gap-4">
              <Skeleton className="h-9 w-16 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/60">
            <Ticket className="mb-3 h-10 w-10" />
            <p className="text-sm">Nenhum ticket encontrado</p>
          </div>
        ) : (
          <AnimatePresence>
            {tickets.map((ticket, index) => {
              const isExpanded = expandedTicketId === ticket.id
              const borderColor = ticket.status === 'aberto'
                ? 'border-l-blue-500/30 hover:border-l-blue-500/60'
                : ticket.status === 'em_atendimento'
                  ? 'border-l-amber-500/30 hover:border-l-amber-500/60'
                  : 'border-l-emerald-500/30 hover:border-l-emerald-500/60'

              return (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ delay: index * 0.03, duration: 0.3 }}
                  className={cn(
                    'glass-card rounded-2xl border-l-2 transition-all duration-200 hover:bg-foreground/[0.03] group',
                    borderColor
                  )}
                >
                  {/* Main row */}
                  <div className="p-4 flex items-center gap-4">
                    {/* Ticket # badge */}
                    <div className="h-9 min-w-[3.5rem] rounded-lg bg-foreground/[0.04] border border-foreground/8 flex items-center justify-center shrink-0">
                      <Hash className="h-3 w-3 text-muted-foreground/60 mr-0.5" />
                      <span className="text-xs font-mono text-muted-foreground">
                        {ticket.id.slice(0, 6)}
                      </span>
                    </div>

                    {/* Client info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground/90 truncate">
                          {ticket.cliente?.nome || 'N/A'}
                        </span>
                        {ticket.assunto && (
                          <span className="hidden lg:block text-xs text-muted-foreground/60 truncate max-w-[200px]">
                            - {ticket.assunto}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Phone className="h-3 w-3 text-muted-foreground/50" />
                        <span className="text-xs text-muted-foreground/70">{ticket.cliente?.telefone || '-'}</span>
                      </div>
                    </div>

                    {/* Status */}
                    <Badge className={cn('shrink-0', statusColors[ticket.status])}>
                      {statusLabels[ticket.status]}
                    </Badge>

                    {/* Priority */}
                    <Badge className={cn('shrink-0', prioridadeColors[ticket.prioridade])}>
                      {prioridadeLabels[ticket.prioridade]}
                    </Badge>

                    {/* Sector */}
                    <div className="hidden md:block text-right shrink-0 min-w-[80px]">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 block">Setor</span>
                      <span className="text-xs text-muted-foreground">{ticket.setor?.nome || '-'}</span>
                    </div>

                    {/* Agent */}
                    <div className="hidden lg:block text-right shrink-0 min-w-[80px]">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 block">Atendente</span>
                      <span className="text-xs text-muted-foreground">{ticket.colaborador?.nome || '-'}</span>
                    </div>

                    {/* 1st response */}
                    <div className="hidden xl:block text-right shrink-0 min-w-[70px]">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 block">1a Resp.</span>
                      {ticket.primeira_resposta_em ? (
                        <span className="text-emerald-400 font-mono text-xs font-medium">
                          {formatTimeDiff(ticket.criado_em, ticket.primeira_resposta_em)}
                        </span>
                      ) : ticket.status === 'encerrado' ? (
                        <span className="text-muted-foreground/50 text-xs">-</span>
                      ) : (
                        <LiveTimer startDate={ticket.criado_em} />
                      )}
                    </div>

                    {/* Date */}
                    <span className="hidden sm:block text-xs text-muted-foreground/70 shrink-0">
                      {format(new Date(ticket.criado_em || ticket.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground/80 hover:text-foreground hover:bg-foreground/5"
                        onClick={() => openDetailsModal(ticket)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5"
                        onClick={() => toggleExpand(ticket.id)}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-0 border-t border-foreground/6 mt-0">
                          <div className="pt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="space-y-1">
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Canal</span>
                              <p className="text-sm text-foreground/60 capitalize">{ticket.canal}</p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Assunto</span>
                              <p className="text-sm text-foreground/60">{ticket.assunto || '-'}</p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Setor</span>
                              <p className="text-sm text-foreground/60">{ticket.setor?.nome || 'Nao atribuido'}</p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Atendente</span>
                              <p className="text-sm text-foreground/60">{ticket.colaborador?.nome || 'Nenhum'}</p>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDetailsModal(ticket)}
                              className="border-foreground/10 text-muted-foreground hover:bg-foreground/5 hover:text-foreground text-xs"
                            >
                              <Eye className="mr-1 h-3 w-3" />
                              Ver detalhes completos
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Create Ticket Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-page-bg-alt border border-foreground/8 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Plus className="h-5 w-5 text-emerald-400" />
              Novo Ticket
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-foreground/70">Cliente *</Label>
              <Select
                value={createFormData.cliente_id}
                onValueChange={(v) => setCreateFormData({ ...createFormData, cliente_id: v })}
              >
                <SelectTrigger className="glass-input rounded-xl text-foreground/80">
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent className="bg-page-bg-alt border-foreground/8">
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome} - {c.telefone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground/70">Setor</Label>
              <Select
                value={createFormData.setor_id}
                onValueChange={(v) => setCreateFormData({ ...createFormData, setor_id: v })}
              >
                <SelectTrigger className="glass-input rounded-xl text-foreground/80">
                  <SelectValue placeholder="Selecione um setor" />
                </SelectTrigger>
                <SelectContent className="bg-page-bg-alt border-foreground/8">
                  {setores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-foreground/70">Prioridade</Label>
                <Select
                  value={createFormData.prioridade}
                  onValueChange={(v) =>
                    setCreateFormData({
                      ...createFormData,
                      prioridade: v as 'baixa' | 'media' | 'alta',
                    })
                  }
                >
                  <SelectTrigger className="glass-input rounded-xl text-foreground/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-page-bg-alt border-foreground/8">
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/70">Canal</Label>
                <Select
                  value={createFormData.canal}
                  onValueChange={(v) => setCreateFormData({ ...createFormData, canal: v })}
                >
                  <SelectTrigger className="glass-input rounded-xl text-foreground/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-page-bg-alt border-foreground/8">
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="telefone">Telefone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground/70">Assunto</Label>
              <Input
                value={createFormData.assunto}
                onChange={(e) => setCreateFormData({ ...createFormData, assunto: e.target.value })}
                placeholder="Descricao breve do ticket"
                className="glass-input rounded-xl text-foreground/80 placeholder:text-muted-foreground/50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateModalOpen(false)} className="border-foreground/10 text-foreground/60 hover:bg-foreground/5">
              Cancelar
            </Button>
            <Button
              onClick={handleCreateTicket}
              disabled={saving}
              className="btn-glow rounded-xl"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Modal */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="sm:max-w-[700px] bg-page-bg-alt border border-foreground/8 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-emerald-400" />
              <span className="text-white">Detalhes do Ticket</span>
            </DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              {/* Ticket Info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        Cliente
                      </div>
                      <p className="font-medium">{selectedTicket.cliente?.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedTicket.cliente?.telefone}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building2 className="h-4 w-4" />
                        Setor / Atendente
                      </div>
                      <p className="font-medium">{selectedTicket.setor?.nome || 'Nao atribuido'}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedTicket.colaborador?.nome || 'Nenhum atendente'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className={statusColors[selectedTicket.status]}>
                  {statusLabels[selectedTicket.status]}
                </Badge>
                <Badge className={prioridadeColors[selectedTicket.prioridade]}>
                  Prioridade: {prioridadeLabels[selectedTicket.prioridade]}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {selectedTicket.canal}
                </Badge>
              </div>
              {selectedTicket.assunto && (
                <div>
                  <p className="text-sm text-muted-foreground">Assunto</p>
                  <p>{selectedTicket.assunto}</p>
                </div>
              )}

              {/* Tabs for Logs and Messages */}
              <Tabs defaultValue="historico" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="historico">Historico Interno</TabsTrigger>
                  <TabsTrigger value="mensagens">Mensagens</TabsTrigger>
                </TabsList>
                <TabsContent value="historico">
                  <Card>
                    <CardContent className="pt-4">
                      {loadingDetails ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : ticketLogs.length === 0 ? (
                        <p className="py-4 text-center text-muted-foreground">
                          Nenhum registro no historico
                        </p>
                      ) : (
                        <ScrollArea className="h-[200px]">
                          <div className="space-y-3">
                            {ticketLogs.map((log) => (
                              <div
                                key={log.id}
                                className="flex items-start gap-3 rounded-lg border p-3"
                              >
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                                  {logTypeIcons[log.tipo] || <FileText className="h-4 w-4" />}
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm">{log.descricao}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", {
                                      locale: ptBR,
                                    })}
                                    {log.colaborador && ` - ${log.colaborador.nome}`}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="mensagens">
                  <Card>
                    <CardContent className="pt-4">
                      {loadingDetails ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : ticketMessages.length === 0 ? (
                        <p className="py-4 text-center text-muted-foreground">
                          Nenhuma mensagem neste ticket
                        </p>
                      ) : (
                        <ScrollArea className="h-[200px]">
                          <div className="space-y-3">
{ticketMessages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`rounded-lg p-3 ${
                              msg.remetente === 'cliente'
                                ? 'bg-muted ml-0 mr-8'
                                : 'bg-primary/10 ml-8 mr-0'
                            }`}
                          >
                            {msg.url_imagem && (msg.tipo === 'imagem' || msg.media_type?.startsWith('image/')) && (
                              <div className="mb-2">
                                <img
                                  src={msg.url_imagem || "/placeholder.svg"}
                                  alt="Imagem anexada"
                                  className="max-w-full rounded-lg max-h-48 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => window.open(msg.url_imagem!, '_blank')}
                                />
                              </div>
                            )}
                            {(() => {
                              if (!msg.conteudo) return null
                              const isOutgoing = msg.remetente !== 'cliente'
                              const parsed = parseMessageContent(msg.conteudo)
                              if (parsed.kind !== 'text' && parsed.kind !== 'protocol') {
                                return <SpecialMessageContent conteudo={msg.conteudo} isOutgoing={isOutgoing} />
                              }
                              return <p className="text-sm whitespace-pre-wrap">{msg.conteudo}</p>
                            })()}
                            <p className="mt-1 text-xs text-muted-foreground">
                              {format(new Date(msg.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                            </p>
                          </div>
                        ))}
                          </div>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => setObservationModalOpen(true)}
                  className="flex-1"
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Adicionar Observacao
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setTransferModalOpen(true)}
                  className="flex-1"
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Transferir
                </Button>
                {selectedTicket.status === 'encerrado' ? (
                  <Button
                    onClick={handleReopenTicket}
                    disabled={saving}
                    className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
                  >
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Reabrir Ticket
                  </Button>
                ) : (
                  <Button
                    onClick={handleCloseTicket}
                    disabled={saving}
                    className="flex-1 bg-green-600 text-white hover:bg-green-700"
                  >
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Encerrar Ticket
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transfer Modal */}
      <Dialog open={transferModalOpen} onOpenChange={(open) => {
        setTransferModalOpen(open)
        if (!open) {
          setTransferSetorId('')
          setTransferAtendenteId('')
          setTransferObservacao('')
          setTransferAtendentes([])
        }
      }}>
        <DialogContent className="sm:max-w-[480px] bg-page-bg-alt border border-foreground/8 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <ArrowRight className="h-5 w-5 text-emerald-400" />
              Transferir Ticket
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Setor selection */}
            <div className="space-y-2">
              <Label>Setor de destino</Label>
              <Select value={transferSetorId} onValueChange={handleTransferSetorChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  {setores
                                        .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2">
                          <span>{s.nome}</span>
                          {s.id === selectedTicket?.setor_id && (
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">(atual)</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {setores.filter((s) => s.canal !== 'discord').length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum setor disponivel para transferencia.
                </p>
              )}
            </div>

            {/* Atendente selection - appears when setor is selected */}
            {transferSetorId && (
              <div className="space-y-2">
                <Label>Atendente</Label>
                {loadingAtendentes ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : (
                  <Select value={transferAtendenteId} onValueChange={setTransferAtendenteId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Deixar na fila do setor..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fila">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                          Deixar na fila (atribuir automaticamente)
                        </div>
                      </SelectItem>
                      {transferAtendentes.map((a) => {
                        const online = isColabOnline(a)
                        return (
                          <SelectItem key={a.id} value={a.id} disabled={!online}>
                            <div className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full ${online ? 'bg-green-500' : 'bg-gray-400'}`} />
                              <span className={!online ? 'text-muted-foreground' : ''}>
                                {a.nome}
                              </span>
                              {!online && (
                                <span className="text-xs text-muted-foreground">(Offline)</span>
                              )}
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                )}
                {!loadingAtendentes && transferAtendentes.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhum atendente neste setor.
                  </p>
                )}
                {!loadingAtendentes && transferAtendentes.length > 0 && !transferAtendentes.some(a => isColabOnline(a)) && (
                  <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md text-xs">
                    Todos os atendentes estao offline. O ticket ira para a fila.
                  </p>
                )}
              </div>
            )}

            {/* Observacao */}
            <div className="space-y-2">
              <Label>Observacao (opcional)</Label>
              <Textarea
                value={transferObservacao}
                onChange={(e) => setTransferObservacao(e.target.value)}
                placeholder="Motivo da transferencia..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="bg-transparent" onClick={() => setTransferModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={saving || !transferSetorId}
              className="bg-primary text-primary-foreground"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Transferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Observation Modal */}
      <Dialog open={observationModalOpen} onOpenChange={setObservationModalOpen}>
        <DialogContent className="sm:max-w-[400px] bg-page-bg-alt border border-foreground/8 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <MessageSquare className="h-5 w-5 text-emerald-400" />
              Adicionar Observacao
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Observacao *</Label>
              <Textarea
                value={newObservation}
                onChange={(e) => setNewObservation(e.target.value)}
                placeholder="Digite sua observacao interna..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setObservationModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAddObservation}
              disabled={saving || !newObservation.trim()}
              className="bg-primary text-primary-foreground"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
