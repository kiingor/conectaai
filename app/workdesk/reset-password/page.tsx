'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'
import { Headphones, Eye, EyeOff, ArrowRight, ShieldCheck, AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'

type Status = 'idle' | 'loading' | 'success' | 'error' | 'invalid'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const router = useRouter()
  const recoveryStorageKey = 'workdesk-password-recovery-ready'

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    const markReady = () => {
      if (!cancelled) {
        window.sessionStorage.setItem(recoveryStorageKey, 'true')
        setSessionReady(true)
        setStatus('idle')
        setError(null)
      }
    }

    const markInvalid = (message?: string) => {
      if (!cancelled) {
        window.sessionStorage.removeItem(recoveryStorageKey)
        setSessionReady(false)
        setStatus('invalid')
        setError(message || null)
      }
    }

    const paramsFromHash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const paramsFromQuery = new URLSearchParams(window.location.search)
    const authError =
      paramsFromHash.get('error_description') ||
      paramsFromQuery.get('error_description') ||
      paramsFromHash.get('error') ||
      paramsFromQuery.get('error')

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        markReady()
      }
    })

    const prepareRecoverySession = async () => {
      if (authError) {
        markInvalid(authError)
        return
      }

      const code = paramsFromQuery.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          markInvalid(error.message)
          return
        }
        window.history.replaceState(null, '', window.location.pathname)
        markReady()
        return
      }

      const accessToken = paramsFromHash.get('access_token')
      const refreshToken = paramsFromHash.get('refresh_token')
      const type = paramsFromHash.get('type')
      if (accessToken && refreshToken && (!type || type === 'recovery')) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (error) {
          markInvalid(error.message)
          return
        }
        window.history.replaceState(null, '', window.location.pathname)
        markReady()
        return
      }

      const { data } = await supabase.auth.getSession()
      if (data.session && window.sessionStorage.getItem(recoveryStorageKey) === 'true') {
        markReady()
      } else {
        markInvalid()
      }
    }

    prepareRecoverySession()

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As senhas nao coincidem.')
      return
    }

    setStatus('loading')
    const supabase = createClient()

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setStatus('error')
      return
    }

    setStatus('success')
    window.sessionStorage.removeItem(recoveryStorageKey)
    // Redirect after short delay so the user can read the success message
    setTimeout(() => router.push('/workdesk/login'), 3000)
  }

  const passwordStrength = (() => {
    if (!password) return null
    if (password.length < 6) return { label: 'Muito curta', color: 'bg-red-500', width: 'w-1/4' }
    if (password.length < 8) return { label: 'Fraca', color: 'bg-orange-500', width: 'w-2/4' }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) return { label: 'Media', color: 'bg-yellow-500', width: 'w-3/4' }
    return { label: 'Forte', color: 'bg-emerald-500', width: 'w-full' }
  })()

  return (
    <div className="flex min-h-svh items-center justify-center ambient-glow bg-page-bg p-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-md glass-card rounded-2xl p-8 z-10"
      >
        {/* Logo header */}
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

        {/* Success State */}
        {status === 'success' ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="mb-6 flex justify-center">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-full" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                  <ShieldCheck className="h-10 w-10 text-emerald-400" />
                </div>
                <div
                  className="absolute inset-0 rounded-full blur-xl opacity-20"
                  style={{ background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)' }}
                />
              </div>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Senha redefinida!</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Sua senha foi atualizada com sucesso.
              <br />
              Redirecionando para o login...
            </p>
            <div className="mt-6 flex justify-center">
              <div className="h-1 w-48 overflow-hidden rounded-full bg-foreground/5">
                <motion.div
                  className="h-full brand-gradient"
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 3 }}
                />
              </div>
            </div>
          </motion.div>
        ) : !sessionReady ? (
          /* Invalid / expired link */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="mb-6 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
                <AlertTriangle className="h-10 w-10 text-red-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Link invalido</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {error || 'Este link de recuperacao e invalido ou expirou.'}
              <br />
              Solicite um novo link de redefinicao.
            </p>
            <Button
              onClick={() => router.push('/workdesk/login')}
              className="mt-8 h-12 w-full btn-glow rounded-xl text-white border-0"
            >
              Ir para o login
            </Button>
          </motion.div>
        ) : (
          /* Reset Form */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="mb-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                <ShieldCheck className="h-6 w-6 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Redefinir senha
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Escolha uma nova senha para sua conta.
              </p>
            </div>

            <form onSubmit={handleReset} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-sm font-medium text-foreground/70">
                  Nova senha
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimo 6 caracteres"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 glass-input rounded-xl text-foreground placeholder:text-muted-foreground/50 pr-12 focus-visible:ring-0"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground/70 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                {/* Password strength bar */}
                {passwordStrength && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-1"
                  >
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/5">
                      <motion.div
                        className={`h-full rounded-full ${passwordStrength.color}`}
                        initial={{ width: 0 }}
                        animate={{ width: passwordStrength.width }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <p className={`text-xs font-medium ${
                      passwordStrength.label === 'Forte' ? 'text-emerald-400' :
                      passwordStrength.label === 'Media' ? 'text-yellow-400' : 'text-orange-400'
                    }`}>
                      Forca: {passwordStrength.label}
                    </p>
                  </motion.div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-sm font-medium text-foreground/70">
                  Confirmar nova senha
                </Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Repita a nova senha"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="h-12 glass-input rounded-xl text-foreground placeholder:text-muted-foreground/50 pr-12 focus-visible:ring-0"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground/70 transition-colors"
                  >
                    {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {confirm && password !== confirm && (
                  <p className="text-xs text-red-400">As senhas nao coincidem.</p>
                )}
                {confirm && password === confirm && confirm.length > 0 && (
                  <p className="text-xs text-emerald-400">Senhas coincidem.</p>
                )}
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
                disabled={status === 'loading'}
              >
                {status === 'loading' ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Salvando...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    Salvar nova senha
                    <ArrowRight className="h-4 w-4" />
                  </div>
                )}
              </Button>
            </form>
          </motion.div>
        )}

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
