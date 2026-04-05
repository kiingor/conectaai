'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Circle, Power, History, ChevronDown, ChevronUp, Coffee, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface DisponibilidadeLog {
  id: string
  colaborador_id: string
  status: string
  timestamp: string
}

interface Pausa {
  id: string
  nome: string
  descricao: string | null
  ativo: boolean
  setor_id: string
}

interface PausaColaborador {
  id: string
  pausa_id: string
  inicio: string
  pausas: Pausa
}

interface DisponibilidadePanelProps {
  colaboradorId: string
  isOnline: boolean
  onStatusChange: (newStatus: boolean) => void
  setorIds?: string[]
}

export function DisponibilidadePanel({
  colaboradorId,
  isOnline,
  onStatusChange,
  setorIds = [],
}: DisponibilidadePanelProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<DisponibilidadeLog[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [pausas, setPausas] = useState<Pausa[]>([])
  const [pausaAtual, setPausaAtual] = useState<PausaColaborador | null>(null)
  const [selectedPausa, setSelectedPausa] = useState<string>('')
  const [, setTick] = useState(0) // For timer updates

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase
      .from('disponibilidade_logs')
      .select('*')
      .eq('colaborador_id', colaboradorId)
      .order('timestamp', { ascending: false })
      .limit(5)

    if (data) {
      setLogs(data)
    }
  }, [supabase, colaboradorId])

  const fetchPausas = useCallback(async () => {
    if (!setorIds || setorIds.length === 0) {
      return
    }
    // Fetch pausas from ALL setores the colaborador belongs to
    const { data } = await supabase
      .from('pausas')
      .select('*')
      .in('setor_id', setorIds)
      .eq('ativo', true)
      .order('nome')

    if (data) {
      // Group by name to avoid duplicates (same pause name in different setores)
      const uniquePausas = data.reduce((acc: Pausa[], pausa) => {
        if (!acc.find((p) => p.nome === pausa.nome)) {
          acc.push(pausa)
        }
        return acc
      }, [])
      setPausas(uniquePausas)
    }
  }, [supabase, setorIds])

  const fetchPausaAtual = useCallback(async () => {
    const { data } = await supabase
      .from('pausas_colaboradores')
      .select('*, pausas(*)')
      .eq('colaborador_id', colaboradorId)
      .is('fim', null)
      .order('inicio', { ascending: false })
      .limit(1)

    if (data && data.length > 0) {
      setPausaAtual(data[0] as PausaColaborador)
    } else {
      setPausaAtual(null)
    }
  }, [supabase, colaboradorId])

  useEffect(() => {
    fetchLogs()
    fetchPausas()
    fetchPausaAtual()
  }, [fetchLogs, fetchPausas, fetchPausaAtual])

  // Real-time subscription to sync status across all sessions/browsers
  useEffect(() => {
    const channel = supabase
      .channel(`colaborador-disponibilidade-${colaboradorId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'colaboradores',
          filter: `id=eq.${colaboradorId}`,
        },
        (payload) => {
          const newData = payload.new as any
          // Update parent component with new status
          onStatusChange(newData.is_online)
          // Refresh pause status
          fetchPausaAtual()
          fetchLogs()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [colaboradorId, supabase, onStatusChange, fetchPausaAtual, fetchLogs])

  // Timer for pause duration
  useEffect(() => {
    if (pausaAtual) {
      const interval = setInterval(() => setTick((t) => t + 1), 1000)
      return () => clearInterval(interval)
    }
  }, [pausaAtual])

  const toggleStatus = async () => {
    setLoading(true)
    const newStatus = !isOnline

    // If going online, first end any active pause
    if (newStatus && pausaAtual) {
      await endPausa()
    }

    // Update colaborador status via API (bypassa RLS)
    try {
      const res = await fetch('/api/colaborador/toggle-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colaboradorId, isOnline: newStatus, pausaAtualId: null }),
      })
      const result = await res.json()
      if (!res.ok) {
        console.error('Error updating status:', result.error)
        setLoading(false)
        return
      }
    } catch (err) {
      console.error('Error updating status:', err)
      setLoading(false)
      return
    }

    // Create log entry
    const { error: logError } = await supabase.from('disponibilidade_logs').insert({
      colaborador_id: colaboradorId,
      status: newStatus ? 'online' : 'offline',
    })

    if (logError) {
      console.error('Error creating log:', logError)
    }

    onStatusChange(newStatus)
    fetchLogs()
    fetchPausaAtual()

    // If coming online, process the ticket queue
    if (newStatus) {
      fetch('/api/tickets/process-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colaboradorId }),
      }).catch(console.error)
    }

    setLoading(false)
  }

  const startPausa = async (pausaId: string) => {
    if (!pausaId) return
    setLoading(true)

    // Find the pausa to get its setor_id
    const pausaToUse = pausas.find((p) => p.id === pausaId)
    if (!pausaToUse) {
      console.error('Pausa not found')
      setLoading(false)
      return
    }

    // End any existing pause first
    if (pausaAtual) {
      await supabase.from('pausas_colaboradores').update({ fim: new Date().toISOString() }).eq('id', pausaAtual.id)
    }

    // Create new pause record with setor_id and get the inserted ID
    const { data: pausaColaboradorData, error: pausaError } = await supabase
      .from('pausas_colaboradores')
      .insert({
        colaborador_id: colaboradorId,
        pausa_id: pausaId,
        setor_id: pausaToUse.setor_id,
      })
      .select('id')
      .single()

    if (pausaError || !pausaColaboradorData) {
      console.error('Error starting pause:', pausaError)
      setLoading(false)
      return
    }

    // Update colaborador via API (bypassa RLS) - set offline and pausa_atual_id
    try {
      await fetch('/api/colaborador/toggle-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colaboradorId, isOnline: false, pausaAtualId: pausaColaboradorData.id }),
      })
    } catch (err) {
      console.error('Error updating colaborador:', err)
    }

    // Create log entry
    await supabase.from('disponibilidade_logs').insert({
      colaborador_id: colaboradorId,
      status: `pausa:${pausaToUse.nome}`,
    })

    onStatusChange(false)
    fetchLogs()
    fetchPausaAtual()
    setSelectedPausa('')
    setLoading(false)
  }

  const endPausa = async () => {
    if (!pausaAtual) return
    setLoading(true)

    // End the pause
    await supabase.from('pausas_colaboradores').update({ fim: new Date().toISOString() }).eq('id', pausaAtual.id)

    // Update colaborador via API (bypassa RLS) - go online and clear pausa
    try {
      await fetch('/api/colaborador/toggle-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colaboradorId, isOnline: true, pausaAtualId: null }),
      })
    } catch (err) {
      console.error('Error updating colaborador:', err)
    }

    // Create log entry
    await supabase.from('disponibilidade_logs').insert({
      colaborador_id: colaboradorId,
      status: 'online',
    })

    onStatusChange(true)
    fetchLogs()
    fetchPausaAtual()
    setLoading(false)

    // Process ticket queue
    fetch('/api/tickets/process-queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ colaboradorId }),
    }).catch(console.error)
  }

  const goOfflineFromPausa = async () => {
    if (!pausaAtual) return
    setLoading(true)

    // End the pause
    await supabase.from('pausas_colaboradores').update({ fim: new Date().toISOString() }).eq('id', pausaAtual.id)

    // Update colaborador via API - go OFFLINE and clear pausa
    try {
      await fetch('/api/colaborador/toggle-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colaboradorId, isOnline: false, pausaAtualId: null }),
      })
    } catch (err) {
      console.error('Error updating colaborador:', err)
    }

    // Create log entry
    await supabase.from('disponibilidade_logs').insert({
      colaborador_id: colaboradorId,
      status: 'offline',
    })

    onStatusChange(false)
    fetchLogs()
    fetchPausaAtual()
    setLoading(false)
  }

  const getPauseDuration = () => {
    if (!pausaAtual) return ''
    const start = new Date(pausaAtual.inicio)
    const now = new Date()
    const diff = now.getTime() - start.getTime()
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  // Determine current status
  const currentStatus = pausaAtual ? 'pausa' : isOnline ? 'online' : 'offline'
  const statusLabel = pausaAtual ? `Ausente - ${pausaAtual.pausas.nome}` : isOnline ? 'Online' : 'Offline'

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="group relative flex items-center justify-center w-9 h-9 rounded-full transition-all hover:bg-foreground/5"
          aria-label={statusLabel}
        >
          {/* Animated ring around status dot */}
          <motion.div
            className={cn(
              'absolute inset-0 rounded-full',
              currentStatus === 'online' && 'ring-2 ring-emerald-500/40',
              currentStatus === 'pausa' && 'ring-2 ring-amber-500/40',
              currentStatus === 'offline' && 'ring-2 ring-foreground/10'
            )}
            animate={{
              scale: currentStatus !== 'offline' ? [1, 1.15, 1] : 1,
              opacity: currentStatus !== 'offline' ? [0.6, 0.2, 0.6] : 0.4,
            }}
            transition={{
              duration: 2.5,
              repeat: currentStatus !== 'offline' ? Number.POSITIVE_INFINITY : 0,
              repeatType: 'loop',
            }}
          />
          {/* Status dot */}
          <div className={cn(
            'relative w-3 h-3 rounded-full transition-colors',
            currentStatus === 'online' && 'status-dot-online',
            currentStatus === 'pausa' && 'bg-amber-500',
            currentStatus === 'offline' && 'bg-muted-foreground/50'
          )} />
          {/* Pause timer badge */}
          {pausaAtual && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-mono text-amber-400 bg-page-bg/90 px-1 rounded whitespace-nowrap">
              {getPauseDuration()}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 glass-dropdown rounded-2xl border-0" align="center" side="right" sideOffset={12}>
        {/* Prominent status icon at top */}
        <div className="flex flex-col items-center pt-5 pb-3">
          <motion.div
            className={cn(
              'w-14 h-14 rounded-full flex items-center justify-center mb-3',
              currentStatus === 'online' && 'bg-emerald-500/10 ring-2 ring-emerald-500/30',
              currentStatus === 'offline' && 'bg-foreground/5 ring-2 ring-foreground/10',
              currentStatus === 'pausa' && 'bg-amber-500/10 ring-2 ring-amber-500/30'
            )}
            animate={{
              boxShadow:
                currentStatus === 'online'
                  ? ['0 0 0 0 rgba(16, 185, 129, 0.3)', '0 0 0 10px rgba(16, 185, 129, 0)']
                  : currentStatus === 'pausa'
                    ? ['0 0 0 0 rgba(245, 158, 11, 0.3)', '0 0 0 10px rgba(245, 158, 11, 0)']
                    : 'none',
            }}
            transition={{
              duration: 1.8,
              repeat: currentStatus !== 'offline' ? Number.POSITIVE_INFINITY : 0,
              repeatType: 'loop',
            }}
          >
            {currentStatus === 'pausa' ? (
              <Coffee className="h-6 w-6 text-amber-400" />
            ) : (
              <div className={cn(
                'h-5 w-5 rounded-full',
                currentStatus === 'online' ? 'status-dot-online' : 'bg-foreground/20'
              )} />
            )}
          </motion.div>
          <p className={cn(
            'text-sm font-semibold',
            currentStatus === 'online' && 'text-emerald-400',
            currentStatus === 'offline' && 'text-muted-foreground',
            currentStatus === 'pausa' && 'text-amber-400'
          )}>
            {statusLabel}
          </p>
          {pausaAtual && (
            <p className="text-[11px] text-amber-400/70 font-mono mt-0.5">{getPauseDuration()}</p>
          )}
        </div>

        <div className="px-4 pb-4">
          {/* Pause: horizontal pill toggles */}
          {pausaAtual ? (
            <div className="flex gap-2">
              <Button onClick={endPausa} disabled={loading} className="flex-1 gap-1.5 btn-glow rounded-full h-9 text-xs">
                <Play className="h-3.5 w-3.5" />
                {loading ? 'Voltando...' : 'Retomar'}
              </Button>
              <Button
                onClick={goOfflineFromPausa}
                disabled={loading}
                className="flex-1 gap-1.5 bg-foreground/5 hover:bg-foreground/8 text-muted-foreground hover:text-foreground/70 border border-foreground/8 rounded-full h-9 text-xs"
              >
                <Power className="h-3.5 w-3.5" />
                {loading ? '...' : 'Offline'}
              </Button>
            </div>
          ) : (
            <>
              {/* Horizontal pill toggle */}
              <div className="flex gap-2">
                <Button
                  onClick={!isOnline ? toggleStatus : undefined}
                  disabled={loading || isOnline}
                  className={cn(
                    'flex-1 gap-1.5 rounded-full h-9 text-xs transition-all',
                    isOnline
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 cursor-default'
                      : 'btn-glow'
                  )}
                >
                  <Circle className={cn('h-2.5 w-2.5', isOnline && 'fill-emerald-400')} />
                  Online
                </Button>
                <Button
                  onClick={isOnline ? toggleStatus : undefined}
                  disabled={loading || !isOnline}
                  className={cn(
                    'flex-1 gap-1.5 rounded-full h-9 text-xs transition-all',
                    !isOnline
                      ? 'bg-foreground/8 text-muted-foreground border border-foreground/10 cursor-default'
                      : 'bg-foreground/5 hover:bg-foreground/8 text-muted-foreground hover:text-foreground/70 border border-foreground/8'
                  )}
                >
                  <Power className="h-3.5 w-3.5" />
                  Offline
                </Button>
              </div>

              {/* Pause dropdown with icons */}
              {isOnline && pausas.length > 0 && (
                <div className="mt-3 pt-3 border-t border-foreground/6">
                  <div className="flex gap-2 items-center">
                    <Coffee className="h-3.5 w-3.5 text-amber-400/60 shrink-0" />
                    <Select value={selectedPausa} onValueChange={setSelectedPausa}>
                      <SelectTrigger className="flex-1 glass-input text-foreground/60 border-foreground/8 h-8 text-xs rounded-full px-3">
                        <SelectValue placeholder="Iniciar pausa..." />
                      </SelectTrigger>
                      <SelectContent className="glass-dropdown border-foreground/8">
                        {pausas.map((pausa) => (
                          <SelectItem key={pausa.id} value={pausa.id} className="text-xs">
                            <span className="flex items-center gap-2">
                              <Coffee className="h-3 w-3 text-amber-400/60" />
                              {pausa.nome}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => startPausa(selectedPausa)}
                      disabled={!selectedPausa || loading}
                      size="sm"
                      className="bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 rounded-full h-8 w-8 p-0"
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Compact timeline history */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 w-full mt-3 pt-3 border-t border-foreground/6 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            <History className="h-3 w-3" />
            <span>Historico</span>
            {showHistory ? (
              <ChevronUp className="h-3 w-3 ml-auto" />
            ) : (
              <ChevronDown className="h-3 w-3 ml-auto" />
            )}
          </button>

          {/* Timeline view history */}
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pt-2.5 pl-2">
                  {logs.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground/40 text-center py-1.5">Sem registros</p>
                  ) : (
                    <div className="relative">
                      {/* Vertical timeline line */}
                      <div className="absolute left-[3px] top-1 bottom-1 w-px bg-foreground/8" />
                      <div className="space-y-2.5">
                        {logs.map((log) => {
                          const isPausa = log.status.startsWith('pausa:')
                          const statusText = isPausa
                            ? `Pausa (${log.status.replace('pausa:', '')})`
                            : log.status === 'online'
                              ? 'Online'
                              : 'Offline'
                          return (
                            <motion.div
                              key={log.id}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="relative flex items-center gap-2.5 pl-4"
                            >
                              {/* Timeline dot */}
                              <div className="absolute left-0">
                                {isPausa ? (
                                  <div className="h-[7px] w-[7px] rounded-full bg-amber-500 ring-2 ring-[#0e101a]" />
                                ) : (
                                  <div className={cn(
                                    'h-[7px] w-[7px] rounded-full ring-2 ring-[#0e101a]',
                                    log.status === 'online' ? 'bg-emerald-500' : 'bg-muted-foreground/50'
                                  )} />
                                )}
                              </div>
                              <div className="flex items-baseline gap-1.5 min-w-0">
                                <span className="text-[11px] text-muted-foreground/80 truncate">{statusText}</span>
                                <span className="text-[10px] text-muted-foreground/40 font-mono shrink-0">
                                  {format(new Date(log.timestamp), 'HH:mm', { locale: ptBR })}
                                </span>
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </PopoverContent>
    </Popover>
  )
}
