'use client'

import React from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { LayoutDashboard, Eye, EyeOff, ArrowRight, BarChart3, Settings, Shield, PieChart } from 'lucide-react'
import { motion } from 'framer-motion'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // Resolve ?org=slug → org_id e seta o cookie para que o proxy.ts tenha contexto
  useEffect(() => {
    const orgSlug = new URLSearchParams(window.location.search).get('org')
    if (!orgSlug) return
    fetch(`/api/org/lookup?slug=${encodeURIComponent(orgSlug)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.id) {
          document.cookie = `org_id=${data.id}; path=/; max-age=3600; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`
        }
      })
      .catch(() => {})
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error

      // Check user permissions - must have dashboard access
      const orgId = document.cookie.match(/(?:^|;\s*)org_id=([^;]+)/)?.[1] || null
      let colaboradorQ = supabase
        .from('colaboradores')
        .select('id, ativo, permissoes:permissao_id(can_view_dashboard)')
        .eq('email', data.user.email)
      if (orgId) colaboradorQ = colaboradorQ.eq('organizacao_id', orgId)
      const { data: colaborador } = await colaboradorQ.maybeSingle()

      if (!colaborador) {
        throw new Error('Voce nao tem permissao para acessar o sistema')
      }

      if (!colaborador.ativo) {
        throw new Error('Sua conta esta desativada. Entre em contato com o administrador.')
      }

      // O join do Supabase pode vir como objeto (1:1) ou array — normaliza ambos.
      const permissoesRel = colaborador?.permissoes as
        | { can_view_dashboard?: boolean }
        | { can_view_dashboard?: boolean }[]
        | null
        | undefined
      const permissao = Array.isArray(permissoesRel) ? permissoesRel[0] : permissoesRel
      const canViewDashboard = permissao?.can_view_dashboard ?? false

      if (!canViewDashboard) {
        throw new Error('Voce nao tem permissao para acessar o Dashboard. Use o WorkDesk.')
      }

      router.push('/dashboard')
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Erro ao fazer login')
    } finally {
      setIsLoading(false)
    }
  }

  const features = [
    { icon: BarChart3, text: 'Metricas em tempo real' },
    { icon: PieChart, text: 'Relatorios detalhados' },
    { icon: Settings, text: 'Gestao de setores' },
    { icon: Shield, text: 'Controle de acesso' },
  ]

  return (
    <div className="flex min-h-svh ambient-glow" style={{ backgroundColor: '#06080f' }}>
      {/* Left Side - Brand Info Panel */}
      <div className="relative hidden w-1/2 lg:flex lg:flex-col lg:justify-between p-12 z-10">
        {/* Floating decorative glass elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 1.5 }}
            className="absolute top-[15%] left-[10%] w-32 h-32 rounded-2xl glass rotate-12"
            style={{ background: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.08)' }}
          />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 1.5 }}
            className="absolute top-[45%] right-[15%] w-24 h-24 rounded-xl glass -rotate-6"
            style={{ background: 'rgba(6, 182, 212, 0.04)', border: '1px solid rgba(6, 182, 212, 0.08)' }}
          />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 1.5 }}
            className="absolute bottom-[20%] left-[25%] w-20 h-20 rounded-lg glass rotate-3"
            style={{ background: 'rgba(16, 185, 129, 0.03)', border: '1px solid rgba(16, 185, 129, 0.06)' }}
          />
        </div>

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex items-center gap-3"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl brand-gradient">
            <LayoutDashboard className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold brand-gradient-text">ConectaAI</span>
        </motion.div>

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative z-10 space-y-6"
        >
          <h1 className="text-4xl font-bold leading-tight text-white xl:text-5xl">
            Gerencie seu
            <br />
            <span className="brand-gradient-text">atendimento</span>
          </h1>
          <p className="max-w-md text-lg text-white/60">
            Painel administrativo completo para gestao de equipes, setores e metricas de atendimento.
          </p>

          {/* Features */}
          <div className="grid grid-cols-2 gap-4 pt-4">
            {features.map((feature, index) => (
              <motion.div
                key={feature.text}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                className="flex items-center gap-3 rounded-xl glass px-4 py-3"
              >
                <feature.icon className="h-5 w-5 text-emerald-400" />
                <span className="text-sm font-medium text-white/80">{feature.text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="relative z-10"
        >
          <p className="text-sm text-white/30">
            Acesso exclusivo para administradores
          </p>
        </motion.div>
      </div>

      {/* Right Side - Login Form */}
      <div className="relative flex w-full flex-col items-center justify-center px-8 py-12 lg:w-1/2 lg:px-16 xl:px-24 z-10">
        {/* Mobile Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center gap-3 lg:hidden"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg brand-gradient">
            <LayoutDashboard className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold brand-gradient-text">ConectaAI</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-md glass-card rounded-2xl p-8"
        >
          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight text-white">
              Area Administrativa
            </h2>
            <p className="mt-2 text-white/50">
              Entre com suas credenciais de administrador
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-white/70">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@empresa.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 glass-input rounded-xl text-white placeholder:text-white/30 focus-visible:ring-0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-white/70">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Digite sua senha"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 glass-input rounded-xl text-white placeholder:text-white/30 pr-12 focus-visible:ring-0"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400"
              >
                {error}
              </motion.div>
            )}

            <Button
              type="submit"
              className="h-12 w-full btn-glow rounded-xl text-white border-0"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Entrando...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  Acessar Dashboard
                  <ArrowRight className="h-4 w-4" />
                </div>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-white/40">
              E um atendente?{' '}
              <a href="/workdesk/login" className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium">
                Acesse o WorkDesk
              </a>
            </p>
          </div>
        </motion.div>

        {/* Stats below the card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 grid w-full max-w-md grid-cols-3 gap-4"
        >
          <div className="text-center glass rounded-xl px-4 py-3">
            <p className="text-lg font-bold text-white">Admin</p>
            <p className="text-xs text-white/40">Nivel</p>
          </div>
          <div className="text-center glass rounded-xl px-4 py-3">
            <p className="text-lg font-bold text-white">Full</p>
            <p className="text-xs text-white/40">Acesso</p>
          </div>
          <div className="text-center glass rounded-xl px-4 py-3">
            <p className="text-lg font-bold brand-gradient-text">Ativo</p>
            <p className="text-xs text-white/40">Status</p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
