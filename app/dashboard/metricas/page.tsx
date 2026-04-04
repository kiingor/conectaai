'use client'

import React, { useState, useMemo } from "react"
import { motion } from 'framer-motion'
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { Clock, CheckCircle, Ticket, Timer, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Bar,
  BarChart,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { useColaborador, useSetores } from '@/lib/hooks/use-data'
import { DateRange } from 'react-day-picker'
import { DatePeriodFilter, getDateCutoffs } from '@/components/date-period-filter'

interface MetricCard {
  title: string
  value: string
  description: string
  icon: React.ElementType
  color: string
}

interface TicketsBySetor {
  setor: string
  count: number
}

interface TicketsByColaborador {
  colaborador: string
  count: number
}

interface DailyVolume {
  date: string
  count: number
}

const COLORS = ['#10b981', '#06b6d4', '#34d399', '#22d3ee', '#6ee7b7', '#67e8f9', '#a7f3d0', '#a5f3fc', '#059669', '#0891b2', '#047857', '#0e7490']

const ITEMS_PER_PAGE = 10

export default function MetricasPage() {
  const supabase = createClient()
  const { data: colaborador } = useColaborador()
  const { data: setoresAcessiveis = [] } = useSetores(colaborador?.id, colaborador?.is_master, colaborador?.organizacao_id)
  const setorIdsAcessiveis = useMemo(() => setoresAcessiveis.map((s: any) => s.id), [setoresAcessiveis])
  const [dateFilter, setDateFilter] = useState('30')
  const [customRange, setCustomRange] = useState<DateRange | undefined>()
  const [setorFilter, setSetorFilter] = useState<string>('all')
  const [metrics, setMetrics] = useState<MetricCard[]>([
    { title: 'Tempo Médio 1ª Resposta', value: '0 min', description: 'Tempo até primeira resposta', icon: Timer, color: 'bg-primary' },
    { title: 'Tempo Médio Resolução', value: '0 min', description: 'Tempo para encerrar ticket', icon: Clock, color: 'bg-accent' },
    { title: 'Tickets Recebidos', value: '0', description: 'Total no mês atual', icon: Ticket, color: 'bg-secondary' },
    { title: 'Tickets Encerrados', value: '0', description: 'Encerrados no mês atual', icon: CheckCircle, color: 'bg-muted' },
  ])
  const [ticketsBySetor, setTicketsBySetor] = useState<TicketsBySetor[]>([])
  const [ticketsByColaborador, setTicketsByColaborador] = useState<TicketsByColaborador[]>([])
  const [dailyVolume, setDailyVolume] = useState<DailyVolume[]>([])
  const [loading, setLoading] = useState(false)

  // Chart pagination state
  const [setorPage, setSetorPage] = useState(0)
  const [colaboradorPage, setColaboradorPage] = useState(0)

  // Chart internal filter state
  const [chartSetorFilter, setChartSetorFilter] = useState<string>('all')
  const [chartColaboradorFilter, setChartColaboradorFilter] = useState<string>('all')

  // Fetch all colaboradores for the filter dropdown
  const [allColaboradores, setAllColaboradores] = useState<{id: string, nome: string}[]>([])

  React.useEffect(() => {
    async function fetchColaboradores() {
      const targetSetorIds = setorFilter !== 'all' ? [setorFilter] : setorIdsAcessiveis
      if (targetSetorIds.length === 0) return
      const { data } = await supabase
        .from('colaboradores_setores')
        .select('colaborador_id, colaboradores(id, nome)')
        .in('setor_id', targetSetorIds)
      if (data) {
        const map = new Map<string, string>()
        data.forEach((d: any) => {
          if (d.colaboradores) map.set(d.colaboradores.id, d.colaboradores.nome)
        })
        setAllColaboradores(Array.from(map.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome)))
      }
    }
    if (colaborador && setorIdsAcessiveis.length > 0) {
      fetchColaboradores()
    }
  }, [setorFilter, colaborador, setorIdsAcessiveis.length, supabase])

  // CRITICAL FIX: Only fetch metrics when setorIdsAcessiveis is loaded (prevents counting ALL tickets)
  React.useEffect(() => {
    if (colaborador?.organizacao_id && setorIdsAcessiveis.length > 0) {
      fetchMetrics()
    }
  }, [dateFilter, customRange, setorFilter, colaborador?.organizacao_id, setorIdsAcessiveis.length])

  // Reset chart pages when data changes
  React.useEffect(() => { setSetorPage(0) }, [ticketsBySetor.length])
  React.useEffect(() => { setColaboradorPage(0) }, [ticketsByColaborador.length])

  async function fetchMetrics() {
    if (!colaborador?.organizacao_id) return
    const orgId = colaborador.organizacao_id

    // Always require setorIdsAcessiveis to be loaded - prevents counting all tickets
    if (setorIdsAcessiveis.length === 0) return

    // Calculate date range for filter
    const { from: filterDate, to: filterDateTo } = getDateCutoffs(dateFilter, customRange)

    // Determine which setor IDs to filter by - ALWAYS filter by accessible setores
    const filterSetorIds = setorFilter !== 'all'
      ? [setorFilter]
      : setorIdsAcessiveis

    // Label dinâmico para as descrições dos KPIs
    const periodLabel =
      dateFilter === 'today' ? 'hoje'
      : dateFilter === 'all' ? 'todo o período'
      : dateFilter === 'custom' ? 'período selecionado'
      : `últimos ${dateFilter} dias`

    // Helper para buscar TODOS os resultados com paginação (Supabase limita a 1000 rows)
    const PAGE_SIZE = 1000
    async function fetchAllPages<T>(buildQuery: (offset: number, limit: number) => any): Promise<T[]> {
      let all: T[] = []
      let offset = 0
      let hasMore = true
      while (hasMore) {
        const { data } = await buildQuery(offset, offset + PAGE_SIZE - 1)
        if (data && data.length > 0) {
          all = all.concat(data)
          offset += PAGE_SIZE
          hasMore = data.length === PAGE_SIZE
        } else {
          hasMore = false
        }
      }
      return all
    }

    try {
      // Fetch average first response time (filtrado pelo período selecionado)
      const firstResponseData = await fetchAllPages<any>((from, to) => {
        let q = supabase
          .from('tickets')
          .select('criado_em, primeira_resposta_em')
          .eq('organizacao_id', orgId)
          .eq('status', 'encerrado')
          .not('primeira_resposta_em', 'is', null)
          .in('setor_id', filterSetorIds)
          .order('criado_em', { ascending: true })
          .range(from, to)
        if (filterDate) q = q.gte('criado_em', filterDate)
        if (filterDateTo) q = q.lte('criado_em', filterDateTo)
        return q
      })

      let avgFirstResponse = 0
      if (firstResponseData.length > 0) {
        const totalMinutes = firstResponseData.reduce((sum: number, ticket: any) => {
          const created = new Date(ticket.criado_em).getTime()
          const firstResponse = new Date(ticket.primeira_resposta_em).getTime()
          return sum + (firstResponse - created) / (1000 * 60)
        }, 0)
        avgFirstResponse = Math.round(totalMinutes / firstResponseData.length)
      }

      // Fetch average resolution time (filtrado pelo período selecionado)
      const resolutionData = await fetchAllPages<any>((from, to) => {
        let q = supabase
          .from('tickets')
          .select('criado_em, encerrado_em')
          .eq('organizacao_id', orgId)
          .eq('status', 'encerrado')
          .not('encerrado_em', 'is', null)
          .in('setor_id', filterSetorIds)
          .order('criado_em', { ascending: true })
          .range(from, to)
        if (filterDate) q = q.gte('criado_em', filterDate)
        if (filterDateTo) q = q.lte('criado_em', filterDateTo)
        return q
      })

      let avgResolution = 0
      if (resolutionData.length > 0) {
        const totalMinutes = resolutionData.reduce((sum: number, ticket: any) => {
          const created = new Date(ticket.criado_em).getTime()
          const closed = new Date(ticket.encerrado_em).getTime()
          return sum + (closed - created) / (1000 * 60)
        }, 0)
        avgResolution = Math.round(totalMinutes / resolutionData.length)
      }

      // Fetch total tickets recebidos no período selecionado
      // Filtra por criado_em (consistente com monitoramento)
      let totalQuery = supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('organizacao_id', orgId)
        .in('setor_id', filterSetorIds)
      if (filterDate) totalQuery = totalQuery.gte('criado_em', filterDate)
      if (filterDateTo) totalQuery = totalQuery.lte('criado_em', filterDateTo)
      const { count: totalTickets } = await totalQuery

      // Fetch tickets encerrados no período selecionado
      // Filtra por criado_em + status encerrado (consistente com monitoramento)
      let closedQuery = supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('organizacao_id', orgId)
        .eq('status', 'encerrado')
        .in('setor_id', filterSetorIds)
      if (filterDate) closedQuery = closedQuery.gte('criado_em', filterDate)
      if (filterDateTo) closedQuery = closedQuery.lte('criado_em', filterDateTo)
      const { count: closedTickets } = await closedQuery

      // Format times for display
      const formatTime = (minutes: number) => {
        if (minutes < 60) return `${minutes} min`
        const hours = Math.floor(minutes / 60)
        const mins = minutes % 60
        return `${hours}h ${mins}m`
      }

      setMetrics([
        { title: 'Tempo Médio 1ª Resposta', value: formatTime(avgFirstResponse), description: `Tempo médio em ${periodLabel}`, icon: Timer, color: 'bg-primary' },
        { title: 'Tempo Médio Resolução', value: formatTime(avgResolution), description: `Tempo médio em ${periodLabel}`, icon: Clock, color: 'bg-accent' },
        { title: 'Tickets Recebidos', value: String(totalTickets || 0), description: `Recebidos em ${periodLabel}`, icon: Ticket, color: 'bg-secondary' },
        { title: 'Tickets Encerrados', value: String(closedTickets || 0), description: `Encerrados em ${periodLabel}`, icon: CheckCircle, color: 'bg-muted' },
      ])

      // Fetch tickets by sector — paginação completa
      const allSectorData = await fetchAllPages<any>((from, to) => {
        let q = supabase
          .from('tickets')
          .select('setor_id, setores(nome)')
          .eq('organizacao_id', orgId)
          .in('setor_id', filterSetorIds)
          .order('criado_em', { ascending: true })
          .range(from, to)
        if (filterDate) q = q.gte('criado_em', filterDate)
        if (filterDateTo) q = q.lte('criado_em', filterDateTo)
        return q
      })
      if (allSectorData.length > 0) {
        const sectorCounts: Record<string, number> = {}
        allSectorData.forEach((ticket: any) => {
          const sectorName = ticket.setores?.nome || 'Sem setor'
          sectorCounts[sectorName] = (sectorCounts[sectorName] || 0) + 1
        })
        setTicketsBySetor(
          Object.entries(sectorCounts)
            .map(([setor, count]) => ({ setor, count }))
            .sort((a, b) => b.count - a.count)
        )
      }

      // Fetch tickets by collaborator — paginação completa
      const allColabData = await fetchAllPages<any>((from, to) => {
        let q = supabase
          .from('tickets')
          .select('colaborador_id, colaboradores(nome)')
          .eq('organizacao_id', orgId)
          .eq('status', 'encerrado')
          .not('colaborador_id', 'is', null)
          .in('setor_id', filterSetorIds)
          .order('criado_em', { ascending: true })
          .range(from, to)
        if (filterDate) q = q.gte('criado_em', filterDate)
        if (filterDateTo) q = q.lte('criado_em', filterDateTo)
        return q
      })
      if (allColabData.length > 0) {
        const colaboradorCounts: Record<string, number> = {}
        allColabData.forEach((ticket: any) => {
          const colaboradorName = ticket.colaboradores?.nome || 'Desconhecido'
          colaboradorCounts[colaboradorName] = (colaboradorCounts[colaboradorName] || 0) + 1
        })
        setTicketsByColaborador(
          Object.entries(colaboradorCounts)
            .map(([colaborador, count]) => ({ colaborador, count }))
            .sort((a, b) => b.count - a.count)
        )
      }

      // Fetch daily volume — paginação completa
      const allDailyData = await fetchAllPages<any>((from, to) => {
        let q = supabase
          .from('tickets')
          .select('criado_em')
          .eq('organizacao_id', orgId)
          .in('setor_id', filterSetorIds)
          .order('criado_em', { ascending: true })
          .range(from, to)
        if (filterDate) q = q.gte('criado_em', filterDate)
        if (filterDateTo) q = q.lte('criado_em', filterDateTo)
        return q
      })

      if (allDailyData.length > 0) {
        const dailyCounts: Record<string, number> = {}
        allDailyData.forEach((ticket) => {
          // Extrair data diretamente da string ISO para evitar problemas de timezone
          // criado_em vem como "2026-03-17T14:30:00.000Z" — usamos a parte da data local
          const d = new Date(ticket.criado_em)
          const day = String(d.getDate()).padStart(2, '0')
          const month = String(d.getMonth() + 1).padStart(2, '0')
          const dateKey = `${day}/${month}`
          dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1
        })

        // Sort by date (month then day)
        const sortedDates = Object.entries(dailyCounts)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => {
            const [dayA, monthA] = a.date.split('/').map(Number)
            const [dayB, monthB] = b.date.split('/').map(Number)
            if (monthA !== monthB) return monthA - monthB
            return dayA - dayB
          })

        setDailyVolume(sortedDates)
      }

    } catch (error) {
      console.error('Erro ao buscar métricas:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filtered + paginated data for Tickets por Setor
  const filteredTicketsBySetor = useMemo(() => {
    if (chartSetorFilter === 'all') return ticketsBySetor
    return ticketsBySetor.filter(t => t.setor === chartSetorFilter)
  }, [ticketsBySetor, chartSetorFilter])

  const setorTotalPages = Math.max(1, Math.ceil(filteredTicketsBySetor.length / ITEMS_PER_PAGE))
  const paginatedTicketsBySetor = useMemo(() => {
    const start = setorPage * ITEMS_PER_PAGE
    return filteredTicketsBySetor.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredTicketsBySetor, setorPage])

  // Filtered + paginated data for Atendimentos por Colaborador
  const filteredTicketsByColaborador = useMemo(() => {
    if (chartColaboradorFilter === 'all') return ticketsByColaborador
    return ticketsByColaborador.filter(t => t.colaborador === chartColaboradorFilter)
  }, [ticketsByColaborador, chartColaboradorFilter])

  const colaboradorTotalPages = Math.max(1, Math.ceil(filteredTicketsByColaborador.length / ITEMS_PER_PAGE))
  const paginatedTicketsByColaborador = useMemo(() => {
    const start = colaboradorPage * ITEMS_PER_PAGE
    return filteredTicketsByColaborador.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredTicketsByColaborador, colaboradorPage])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  // Accent colors for metric cards: amber for time-based, emerald for count-based
  const metricAccents = ['amber', 'amber', 'emerald', 'emerald']

  return (
    <div className="flex flex-col gap-6">
      {/* Header: Title left, filters right — one compact row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center border border-white/10">
            <Ticket className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Métricas</h1>
            <p className="text-sm text-white/40">Indicadores de desempenho da operação</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={setorFilter} onValueChange={setSetorFilter}>
            <SelectTrigger className="w-48 glass-input rounded-xl text-white/70 h-9 text-sm">
              <SelectValue placeholder="Todos os setores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              {setoresAcessiveis.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DatePeriodFilter
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
            customRange={customRange}
            onCustomRangeChange={setCustomRange}
            showToday={true}
          />
        </div>
      </div>

      {/* Stats Section — 2x2 grid of wider metric cards */}
      <motion.div
        className="grid gap-4 grid-cols-1 md:grid-cols-2"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {metrics.map((metric, index) => {
          const isAmber = metricAccents[index] === 'amber'
          return (
            <motion.div key={metric.title} variants={itemVariants}>
              <div className="glass-card-elevated rounded-2xl overflow-hidden p-5 flex items-center gap-4">
                {/* Icon with colored accent */}
                <div className={`shrink-0 h-12 w-12 rounded-xl flex items-center justify-center border ${
                  isAmber
                    ? 'bg-amber-500/10 border-amber-500/20'
                    : 'bg-emerald-500/10 border-emerald-500/20'
                }`}>
                  <metric.icon className={`h-5 w-5 ${isAmber ? 'text-amber-400' : 'text-emerald-400'}`} />
                </div>
                {/* Text content */}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-white/50 block">{metric.title}</span>
                  <div className={`text-3xl font-bold mt-0.5 ${
                    isAmber ? 'text-amber-400' : 'brand-gradient-text'
                  }`}>{metric.value}</div>
                  <p className="text-xs text-white/30 mt-0.5">{metric.description}</p>
                </div>
                {/* Subtle accent bar on right edge */}
                <div className={`w-1 h-14 rounded-full shrink-0 ${
                  isAmber ? 'bg-amber-500/30' : 'bg-emerald-500/30'
                }`} />
              </div>
            </motion.div>
          )
        })}
      </motion.div>

      {/* Hero Chart — Daily Volume AreaChart, full width, taller */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="glass-card rounded-2xl">
          <CardHeader>
            <CardTitle className="text-white">Volume Diário de Tickets</CardTitle>
            <CardDescription>Quantidade de tickets criados por dia</CardDescription>
          </CardHeader>
          <CardContent>
            {dailyVolume.length > 0 ? (
              <ChartContainer
                config={{
                  count: {
                    label: 'Tickets',
                    color: '#10b981',
                  },
                }}
                className="h-80 w-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyVolume} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                      tickLine={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      name="Tickets"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fill="url(#areaGradient)"
                      dot={{ fill: '#10b981', strokeWidth: 0, r: 3 }}
                      activeDot={{ r: 6, fill: '#06b6d4', stroke: '#06b6d4', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="flex h-80 items-center justify-center text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </div>
      </motion.div>

      {/* Secondary Charts — 2 columns */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tickets by Sector — horizontal bar chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="glass-card rounded-2xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">Tickets por Setor</CardTitle>
                  <CardDescription>Distribuição por departamento</CardDescription>
                </div>
                <Select value={chartSetorFilter} onValueChange={(v) => { setChartSetorFilter(v); setSetorPage(0) }}>
                  <SelectTrigger className="w-44 h-8 text-xs glass-input rounded-xl text-white/70">
                    <SelectValue placeholder="Filtrar setor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os setores</SelectItem>
                    {ticketsBySetor.map((s) => (
                      <SelectItem key={s.setor} value={s.setor}>{s.setor}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {paginatedTicketsBySetor.length > 0 ? (
                <>
                  <ChartContainer
                    config={{
                      count: {
                        label: 'Tickets',
                        color: '#10b981',
                      },
                    }}
                    className="w-full"
                    style={{ height: 400 }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[...paginatedTicketsBySetor].sort((a, b) => a.count - b.count)}
                        layout="vertical"
                        margin={{ top: 10, right: 40, left: 10, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                        <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} />
                        <YAxis
                          dataKey="setor"
                          type="category"
                          tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                          width={140}
                          tickLine={false}
                          axisLine={false}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" name="Tickets" radius={[0, 6, 6, 0]} barSize={24}>
                          {[...paginatedTicketsBySetor].sort((a, b) => a.count - b.count).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                  {/* Pagination */}
                  {filteredTicketsBySetor.length > ITEMS_PER_PAGE && (
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                      <span className="text-xs text-white/40">
                        {setorPage * ITEMS_PER_PAGE + 1}-{Math.min((setorPage + 1) * ITEMS_PER_PAGE, filteredTicketsBySetor.length)} de {filteredTicketsBySetor.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={setorPage === 0}
                          onClick={() => setSetorPage(p => p - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs text-white/40 px-2">
                          {setorPage + 1}/{setorTotalPages}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={setorPage >= setorTotalPages - 1}
                          onClick={() => setSetorPage(p => p + 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-[400px] items-center justify-center text-white/30">
                  Nenhum dado disponível
                </div>
              )}
            </CardContent>
          </div>
        </motion.div>

        {/* Tickets by Collaborator — horizontal bar chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="glass-card rounded-2xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">Atendimentos por Colaborador</CardTitle>
                  <CardDescription>Tickets encerrados por colaborador</CardDescription>
                </div>
                <Select value={chartColaboradorFilter} onValueChange={(v) => { setChartColaboradorFilter(v); setColaboradorPage(0) }}>
                  <SelectTrigger className="w-44 h-8 text-xs glass-input rounded-xl text-white/70">
                    <SelectValue placeholder="Filtrar colaborador" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {ticketsByColaborador.map((c) => (
                      <SelectItem key={c.colaborador} value={c.colaborador}>{c.colaborador}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {paginatedTicketsByColaborador.length > 0 ? (
                <>
                  <ChartContainer
                    config={{
                      count: {
                        label: 'Tickets',
                        color: '#10b981',
                      },
                    }}
                    className="w-full"
                    style={{ height: 400 }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={paginatedTicketsByColaborador}
                        layout="vertical"
                        margin={{ top: 10, right: 40, left: 10, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                        <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} />
                        <YAxis
                          dataKey="colaborador"
                          type="category"
                          tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                          width={140}
                          tickLine={false}
                          axisLine={false}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" name="Tickets" radius={[0, 6, 6, 0]} barSize={22}>
                          {paginatedTicketsByColaborador.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                  {/* Pagination */}
                  {filteredTicketsByColaborador.length > ITEMS_PER_PAGE && (
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                      <span className="text-xs text-white/40">
                        {colaboradorPage * ITEMS_PER_PAGE + 1}-{Math.min((colaboradorPage + 1) * ITEMS_PER_PAGE, filteredTicketsByColaborador.length)} de {filteredTicketsByColaborador.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={colaboradorPage === 0}
                          onClick={() => setColaboradorPage(p => p - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs text-white/40 px-2">
                          {colaboradorPage + 1}/{colaboradorTotalPages}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={colaboradorPage >= colaboradorTotalPages - 1}
                          onClick={() => setColaboradorPage(p => p + 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-[400px] items-center justify-center text-white/30">
                  Nenhum dado disponível
                </div>
              )}
            </CardContent>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
