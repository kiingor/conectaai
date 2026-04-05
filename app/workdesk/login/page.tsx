'use client'

import React from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Headphones, Eye, EyeOff, ArrowRight, ArrowLeft, Mail } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type View = 'login' | 'forgot' | 'forgot-sent'

export default function WorkdeskLoginPage() {
  const [view, setView] = useState<View>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [forgotEmail, setForgotEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // Resolve ?org=slug → seta cookie org_id
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
      // Try master login first
      const masterRes = await fetch('/api/auth/master-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const masterBody = await masterRes.json().catch(() => ({}))

      if (masterRes.ok && masterBody.session) {
        // Sign out any existing session first to avoid conflicts
        await supabase.auth.signOut({ scope: 'local' })
        // Set the new session from master login
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: masterBody.session.access_token,
          refresh_token: masterBody.session.refresh_token,
        })
        if (sessionError) {
          throw new Error('Erro ao definir sessao. Tente novamente.')
        }
        // Verify we got the correct user session
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || user.email?.toLowerCase() !== masterBody.targetEmail?.toLowerCase()) {
          await supabase.auth.signOut()
          throw new Error('Erro de sessao: usuario incorreto. Tente novamente.')
        }
        router.push('/workdesk')
        return
      }

      // If not master password, do normal login
      if (masterBody.error && masterBody.error !== 'not_master') {
        throw new Error(masterBody.error)
      }

      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error

      // Check if user is a colaborador
      const orgId = document.cookie.match(/(?:^|;\s*)org_id=([^;]+)/)?.[1] || null
      let colaboradorQ = supabase
        .from('colaboradores')
        .select('id, ativo')
        .eq('email', data.user.email)
      if (orgId) colaboradorQ = colaboradorQ.eq('organizacao_id', orgId)
      const { data: colaborador } = await colaboradorQ.single()

      if (!colaborador) {
        throw new Error('Voce nao tem permissao para acessar o WorkDesk')
      }

      if (!colaborador.ativo) {
        throw new Error('Sua conta esta desativada. Entre em contato com o administrador.')
      }

      router.push('/workdesk')
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Erro ao fazer login')
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const origin = window.location.origin
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim().toLowerCase(), {
        redirectTo: `${origin}/workdesk/reset-password`,
      })
      if (error) throw error
      setView('forgot-sent')
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Erro ao enviar e-mail de recuperacao')
    } finally {
      setIsLoading(false)
    }
  }

  const goToForgot = () => {
    setForgotEmail(email)
    setError(null)
    setView('forgot')
  }

  const goToLogin = () => {
    setError(null)
    setView('login')
  }

  return (
    <div className="flex min-h-svh items-center justify-center ambient-glow p-4" style={{ backgroundColor: '#06080f' }}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-md glass-card rounded-2xl p-8 z-10"
      >
        {/* Logo at top */}
        <div className="flex flex-col items-center mb-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="relative mb-4"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl brand-gradient">
              <Headphones className="h-7 w-7 text-white" />
            </div>
            <div
              className="absolute inset-0 rounded-2xl blur-xl opacity-30"
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)' }}
            />
          </motion.div>
          <motion.span
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl font-bold brand-gradient-text"
          >
            ConectaAI
          </motion.span>
          <motion.span
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-sm text-muted-foreground/80 mt-1"
          >
            Area do Atendente
          </motion.span>
        </div>

        <AnimatePresence mode="wait">

          {/* ── LOGIN ── */}
          {view === 'login' && (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-white">
                  Bom te ver!
                </h2>
                <p className="mt-1 text-sm text-muted-foreground/80">
                  Entre com suas credenciais para acessar sua area de trabalho
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-foreground/70">
                    E-mail
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 glass-input rounded-xl text-white placeholder:text-muted-foreground/60 focus-visible:ring-0"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium text-foreground/70">
                      Senha
                    </Label>
                    <button
                      type="button"
                      onClick={goToForgot}
                      className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-medium"
                    >
                      Esqueceu sua senha?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Digite sua senha"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 glass-input rounded-xl text-white placeholder:text-muted-foreground/60 pr-12 focus-visible:ring-0"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/80 hover:text-foreground/70 transition-colors"
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
                      Acessar WorkDesk
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  )}
                </Button>
              </form>

              {/* Stats */}
              <div className="mt-8 grid grid-cols-3 gap-3">
                <div className="text-center glass rounded-xl px-3 py-2">
                  <p className="text-base font-bold text-white">24/7</p>
                  <p className="text-xs text-muted-foreground/60">Suporte</p>
                </div>
                <div className="text-center glass rounded-xl px-3 py-2">
                  <p className="text-base font-bold text-white">99%</p>
                  <p className="text-xs text-muted-foreground/60">Uptime</p>
                </div>
                <div className="text-center glass rounded-xl px-3 py-2">
                  <p className="text-base font-bold brand-gradient-text">Ativo</p>
                  <p className="text-xs text-muted-foreground/60">Status</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── FORGOT PASSWORD ── */}
          {view === 'forgot' && (
            <motion.div
              key="forgot"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <button
                type="button"
                onClick={goToLogin}
                className="mb-6 flex items-center gap-2 text-sm text-muted-foreground/80 hover:text-foreground/70 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar ao login
              </button>

              <div className="mb-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                  <Mail className="h-6 w-6 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-white">
                  Recuperar senha
                </h2>
                <p className="mt-1 text-sm text-muted-foreground/80">
                  Informe seu e-mail e enviaremos um link para redefinir sua senha.
                </p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email" className="text-sm font-medium text-foreground/70">
                    E-mail
                  </Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="seu@email.com"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="h-12 glass-input rounded-xl text-white placeholder:text-muted-foreground/60 focus-visible:ring-0"
                  />
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
                      Enviando...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      Enviar link de recuperacao
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  )}
                </Button>
              </form>
            </motion.div>
          )}

          {/* ── FORGOT SENT ── */}
          {view === 'forgot-sent' && (
            <motion.div
              key="forgot-sent"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="text-center"
            >
              <div className="mb-6 flex justify-center">
                <div className="relative">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                    <Mail className="h-10 w-10 text-emerald-400" />
                  </div>
                  <div
                    className="absolute inset-0 rounded-full blur-xl opacity-20"
                    style={{ background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)' }}
                  />
                </div>
              </div>

              <h2 className="text-2xl font-bold tracking-tight text-white">
                E-mail enviado!
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Enviamos um link de recuperacao para{' '}
                <span className="font-medium text-foreground/80">{forgotEmail}</span>.
                <br />
                Verifique sua caixa de entrada e spam.
              </p>

              <div className="mt-6 glass rounded-xl px-4 py-3 text-sm text-muted-foreground/80">
                O link expira em <span className="font-medium text-foreground/70">1 hora</span>.
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={goToLogin}
                className="mt-6 h-12 w-full rounded-xl border-foreground/10 text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao login
              </Button>
            </motion.div>
          )}

        </AnimatePresence>

        {/* Footer divider with brand */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 flex items-center justify-center gap-2"
        >
          <div className="h-px flex-1 bg-foreground/5" />
          <span className="text-xs font-medium brand-gradient-text">ConectaAI</span>
          <div className="h-px flex-1 bg-foreground/5" />
        </motion.div>
      </motion.div>
    </div>
  )
}
