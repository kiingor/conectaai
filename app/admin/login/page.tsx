'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Shield, Loader2, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

export default function AdminLoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error, data } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        toast.error('Credenciais invalidas')
        return
      }

      // Verificar se e super admin
      const { data: superAdmin } = await supabase
        .from('super_admins')
        .select('user_id')
        .eq('user_id', data.user.id)
        .maybeSingle()

      if (!superAdmin) {
        await supabase.auth.signOut()
        toast.error('Acesso negado. Voce nao e um super admin.')
        return
      }

      router.push('/admin')
    } catch {
      toast.error('Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-svh flex items-center justify-center ambient-glow p-4" style={{ backgroundColor: '#06080f' }}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-md glass-card rounded-2xl p-8 z-10"
      >
        {/* Shield Icon with gradient glow */}
        <div className="flex flex-col items-center text-center mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="relative mb-5"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl brand-gradient">
              <Shield className="h-8 w-8 text-white" />
            </div>
            {/* Glow behind icon */}
            <div
              className="absolute inset-0 rounded-2xl blur-xl opacity-40"
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)' }}
            />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="text-2xl font-bold brand-gradient-text"
          >
            Super Admin
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mt-2 text-sm text-white/40"
          >
            Acesso restrito a administracao da plataforma
          </motion.p>
        </div>

        {/* Form */}
        <motion.form
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          onSubmit={handleLogin}
          className="space-y-5"
        >
          <div className="space-y-2">
            <Label className="text-sm font-medium text-white/70">Email</Label>
            <Input
              type="email"
              placeholder="admin@conectaai.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              className="h-12 glass-input rounded-xl text-white placeholder:text-white/30 focus-visible:ring-0"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-white/70">Senha</Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Digite sua senha"
                className="h-12 glass-input rounded-xl text-white placeholder:text-white/30 pr-12 focus-visible:ring-0"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="h-12 w-full btn-glow rounded-xl text-white border-0"
            disabled={loading}
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Entrando...
              </div>
            ) : (
              'Entrar'
            )}
          </Button>
        </motion.form>

        {/* Subtle footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 flex items-center justify-center gap-2"
        >
          <div className="h-px flex-1 bg-white/5" />
          <span className="text-xs text-white/20 font-medium brand-gradient-text">ConectaAI</span>
          <div className="h-px flex-1 bg-white/5" />
        </motion.div>
      </motion.div>
    </div>
  )
}
