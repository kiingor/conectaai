'use client'

import React from 'react'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { User, LogOut, MessageCircle, Volume2, Play, KeyRound } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ThemeToggle } from '@/components/theme-toggle'
import { DisponibilidadePanel } from '@/components/workdesk/disponibilidade-panel'
import { NotificacoesPanel } from '@/components/workdesk/notificacoes-panel'
import { useAudioAlert, type TicketSoundType } from '@/hooks/use-audio-alert'

interface ColaboradorSetor {
  setor_id: string
}

interface Colaborador {
  id: string
  nome: string
  email: string
  is_online: boolean
  setores_vinculados?: ColaboradorSetor[]
}

export default function WorkdeskLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [colaborador, setColaborador] = useState<Colaborador | null>(null)
  const [loading, setLoading] = useState(true)
  const [ticketSound, setTicketSound] = useState<TicketSoundType>('default')
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const { setTicketSoundType, getTicketSoundType, playAlert, playBuhBuh, initAudioContext } = useAudioAlert()

  // Carregar preferencia de som salva
  useEffect(() => {
    const saved = localStorage.getItem('ticketSoundType') as TicketSoundType | null
    if (saved === 'buhbuh' || saved === 'default') {
      setTicketSound(saved)
    }
  }, [])

  const handleSoundChange = (type: TicketSoundType) => {
    setTicketSound(type)
    setTicketSoundType(type)
    // Pre-visualizar o som selecionado
    initAudioContext()
    if (type === 'buhbuh') {
      playBuhBuh()
    } else {
      playAlert('new_ticket')
    }
  }

  const fetchColaborador = useCallback(async () => {
    console.log('[workdesk layout] fetchColaborador iniciado, pathname:', pathname)

    // Skip auth check for login and reset-password pages
    if (pathname === '/workdesk/login' || pathname === '/workdesk/reset-password') {
      console.log('[workdesk layout] pagina de login/reset, pulando auth check')
      setLoading(false)
      return
    }

    console.log('[workdesk layout] verificando sessao...')
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    console.log('[workdesk layout] getUser resultado:', { user: user?.email ?? null, error: userError?.message ?? null })

    if (!user) {
      const orgParam = new URLSearchParams(window.location.search).get('org')
      console.log('[workdesk layout] sem usuario, redirecionando para login. org param:', orgParam)
      router.push(orgParam ? `/workdesk/login?org=${encodeURIComponent(orgParam)}` : '/workdesk/login')
      return
    }

    // Se tem ?org= na URL e nao tem cookie, resolve o org_id agora
    let orgId = document.cookie.match(/(?:^|;\s*)org_id=([^;]+)/)?.[1] ?? null
    const orgParam = new URLSearchParams(window.location.search).get('org')
    if (!orgId && orgParam) {
      console.log('[workdesk layout] sem cookie, resolvendo org via ?org=', orgParam)
      try {
        const res = await fetch(`/api/org/lookup?slug=${encodeURIComponent(orgParam)}`)
        const data = res.ok ? await res.json() : null
        if (data?.id) {
          orgId = data.id
          document.cookie = `org_id=${data.id}; path=/; max-age=28800; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`
          console.log('[workdesk layout] org_id setado via ?org=:', orgId)
        }
      } catch { /* silencia erros de rede */ }
    }

    console.log('[workdesk layout] org_id do cookie:', orgId)
    console.log('[workdesk layout] buscando colaborador para email:', user.email, 'org:', orgId)

    let colaboradorQuery = supabase
      .from('colaboradores')
      .select('id, nome, email, is_online, pausa_atual_id')
      .eq('email', user.email!)
    if (orgId) colaboradorQuery = colaboradorQuery.eq('organizacao_id', orgId)
    let { data: colaboradorData, error: colabError } = await colaboradorQuery.maybeSingle()
    console.log('[workdesk layout] colaborador resultado:', { data: colaboradorData, error: colabError?.message ?? null })

    // Fallback: se nao achou na org especifica, busca sem filtro de org (master admin)
    if (!colaboradorData && orgId) {
      console.log('[workdesk layout] nao encontrado na org, tentando fallback sem filtro de org')
      const fallback = await supabase
        .from('colaboradores')
        .select('id, nome, email, is_online, pausa_atual_id')
        .eq('email', user.email!)
        .limit(1)
        .maybeSingle()
      console.log('[workdesk layout] fallback resultado:', { data: fallback.data, error: fallback.error?.message ?? null })
      colaboradorData = fallback.data
    }

    if (!colaboradorData) {
      console.log('[workdesk layout] colaborador nao encontrado, redirecionando para login')
      router.push(orgParam ? `/workdesk/login?org=${encodeURIComponent(orgParam)}` : '/workdesk/login')
      return
    }

    // Then get their setores
    const { data: setoresData, error: setoresError } = await supabase
      .from('colaboradores_setores')
      .select('setor_id')
      .eq('colaborador_id', colaboradorData.id)
    console.log('[workdesk layout] setores resultado:', { count: setoresData?.length ?? 0, error: setoresError?.message ?? null })

    const data = {
      ...colaboradorData,
      setores_vinculados: setoresData || [],
    }

    console.log('[workdesk layout] colaborador carregado com sucesso:', data.nome)
    setColaborador(data)
    setLoading(false)
  }, [supabase, router, pathname])

  useEffect(() => {
    fetchColaborador()
  }, [fetchColaborador])

  // Real-time subscription to sync status across all sessions/browsers
  useEffect(() => {
    if (!colaborador?.id) return

    const channel = supabase
      .channel(`colaborador-status-${colaborador.id}`)
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
          // Update local state with the new status from database
          setColaborador((prev) =>
            prev
              ? {
                  ...prev,
                  is_online: newData.is_online,
                  pausa_atual_id: newData.pausa_atual_id,
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

  // Note: We intentionally DO NOT set offline on page close
  // The status is GLOBAL and should only change when user explicitly changes it
  // Multiple tabs/browsers share the same status

  const handleStatusChange = (newStatus: boolean) => {
    setColaborador((prev) => (prev ? { ...prev, is_online: newStatus } : null))
  }

  const handleLogout = async () => {
    if (colaborador?.id) {
      // Usa API route (service role) para garantir que o offline seja escrito
      // Supabase client-side com RLS bloqueia silenciosamente esta escrita
      await fetch('/api/colaborador/toggle-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colaboradorId: colaborador.id, isOnline: false, pausaAtualId: null }),
      }).catch(() => {})
    }
    await supabase.auth.signOut()
    router.push('/workdesk/login')
  }

  // -- Alterar senha
  const [senhaDialogOpen, setSenhaDialogOpen] = useState(false)
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [senhaLoading, setSenhaLoading] = useState(false)
  const [senhaError, setSenhaError] = useState<string | null>(null)

  const resetSenhaDialog = () => {
    setSenhaAtual('')
    setNovaSenha('')
    setConfirmarSenha('')
    setSenhaError(null)
    setSenhaLoading(false)
  }

  const handleAlterarSenha = async () => {
    setSenhaError(null)

    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      setSenhaError('Preencha todos os campos.')
      return
    }
    if (novaSenha.length < 6) {
      setSenhaError('A nova senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (novaSenha !== confirmarSenha) {
      setSenhaError('A confirmacao nao coincide com a nova senha.')
      return
    }

    setSenhaLoading(true)

    // Verificar senha atual
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: colaborador!.email,
      password: senhaAtual,
    })
    if (authError) {
      setSenhaError('Senha atual incorreta.')
      setSenhaLoading(false)
      return
    }

    // Atualizar para nova senha
    const { error: updateError } = await supabase.auth.updateUser({ password: novaSenha })
    if (updateError) {
      setSenhaError('Erro ao atualizar senha. Tente novamente.')
      setSenhaLoading(false)
      return
    }

    // Marcar offline e fazer logout via API route (service role)
    if (colaborador?.id) {
      await fetch('/api/colaborador/toggle-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colaboradorId: colaborador.id, isOnline: false, pausaAtualId: null }),
      }).catch(() => {})
    }
    await supabase.auth.signOut()
    router.push('/workdesk/login')
  }

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#06080f]">
        <div className="flex items-center gap-3 text-white/50">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <span className="text-sm">Carregando...</span>
        </div>
      </div>
    )
  }

  // Render login and reset-password pages without auth wrapper
  if (pathname === '/workdesk/login' || pathname === '/workdesk/reset-password') {
    return <>{children}</>
  }

  if (!colaborador) {
    const orgParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('org') : null
    router.push(orgParam ? `/workdesk/login?org=${encodeURIComponent(orgParam)}` : '/workdesk/login')
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#06080f]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-[#06080f] ambient-glow">
      {/* Header */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between glass-header px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg brand-gradient shadow-lg shadow-emerald-500/20">
            <MessageCircle className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-sm font-bold brand-gradient-text tracking-tight">ConectaAI</h1>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Status Panel */}
          <DisponibilidadePanel
            colaboradorId={colaborador.id}
            isOnline={colaborador.is_online}
            onStatusChange={handleStatusChange}
            setorIds={colaborador.setores_vinculados?.map((s) => s.setor_id) || []}
          />

          {/* Notifications */}
          <NotificacoesPanel
            colaboradorId={colaborador.id}
            setorIds={colaborador.setores_vinculados?.map((s) => s.setor_id) || []}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/8 transition-all">
                <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
                  <User className="h-3.5 w-3.5 text-white/70" />
                  <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#06080f] ${colaborador.is_online ? 'status-dot-online' : 'status-dot-busy'}`} />
                </div>
                <span className="hidden text-xs font-medium text-white/80 md:inline">{colaborador.nome}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 glass-dropdown rounded-2xl border-0 p-1">
              <div className="px-3 py-2.5">
                <p className="text-sm font-semibold text-white/90">{colaborador.nome}</p>
                <p className="text-xs text-white/40">{colaborador.email}</p>
              </div>

              <DropdownMenuSeparator className="mx-2 bg-white/6" />

              {/* Som de novo ticket */}
              <DropdownMenuLabel className="px-3 py-1.5 text-[10px] font-semibold text-white/30 uppercase tracking-wider flex items-center gap-1.5">
                <Volume2 className="h-3 w-3" />
                Som -- Novo Ticket
              </DropdownMenuLabel>

              <div className="px-1.5 pb-1 space-y-0.5">
                {/* Opcao Padrao */}
                <button
                  onClick={() => handleSoundChange('default')}
                  className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
                    ticketSound === 'default'
                      ? 'bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20'
                      : 'hover:bg-white/5 text-white/70'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm">Padrao</span>
                  </span>
                  {ticketSound === 'default' && (
                    <Play className="h-3 w-3 shrink-0 opacity-60" />
                  )}
                </button>

                {/* Opcao Buh Buh */}
                <button
                  onClick={() => handleSoundChange('buhbuh')}
                  className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
                    ticketSound === 'buhbuh'
                      ? 'bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20'
                      : 'hover:bg-white/5 text-white/70'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm">Buh Buh</span>
                  </span>
                  {ticketSound === 'buhbuh' && (
                    <Play className="h-3 w-3 shrink-0 opacity-60" />
                  )}
                </button>
              </div>

              <DropdownMenuSeparator className="mx-2 bg-white/6" />

              <DropdownMenuItem
                onClick={() => { resetSenhaDialog(); setSenhaDialogOpen(true) }}
                className="rounded-lg mx-1 text-white/70 hover:text-white hover:bg-white/5 focus:bg-white/5"
              >
                <KeyRound className="mr-2 h-4 w-4" />
                Alterar Senha
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleLogout} className="text-red-400 rounded-lg mx-1 mb-1 hover:bg-red-500/10 focus:bg-red-500/10">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Dialog -- Alterar Senha */}
          <Dialog open={senhaDialogOpen} onOpenChange={(open) => { if (!open) resetSenhaDialog(); setSenhaDialogOpen(open) }}>
            <DialogContent className="sm:max-w-md glass-dropdown border-white/8 bg-[#0e101a]/95">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-white/90">
                  <KeyRound className="h-4 w-4 text-emerald-400" />
                  Alterar Senha
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="wk-senha-atual" className="text-white/60 text-xs">Senha atual</Label>
                  <Input
                    id="wk-senha-atual"
                    type="password"
                    placeholder="Digite sua senha atual"
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    disabled={senhaLoading}
                    className="glass-input text-white/90 placeholder:text-white/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wk-nova-senha" className="text-white/60 text-xs">Nova senha</Label>
                  <Input
                    id="wk-nova-senha"
                    type="password"
                    placeholder="Minimo 6 caracteres"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    disabled={senhaLoading}
                    className="glass-input text-white/90 placeholder:text-white/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wk-confirmar-senha" className="text-white/60 text-xs">Confirmar nova senha</Label>
                  <Input
                    id="wk-confirmar-senha"
                    type="password"
                    placeholder="Repita a nova senha"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    disabled={senhaLoading}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAlterarSenha() }}
                    className="glass-input text-white/90 placeholder:text-white/20"
                  />
                </div>
                {senhaError && (
                  <p className="text-sm text-red-400">{senhaError}</p>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setSenhaDialogOpen(false)}
                  disabled={senhaLoading}
                  className="border-white/10 text-white/60 hover:bg-white/5 hover:text-white/80"
                >
                  Cancelar
                </Button>
                <Button onClick={handleAlterarSenha} disabled={senhaLoading} className="btn-glow rounded-lg">
                  {senhaLoading ? 'Salvando...' : 'Salvar e sair'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Page content */}
      <main className="relative z-10">{children}</main>
    </div>
  )
}
