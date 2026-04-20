'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Shield, ArrowLeft, Plus, Loader2, Trash2, X, Copy,
  CheckCircle2, User, Mail, Lock, Eye, EyeOff, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'

interface SuperAdmin {
  user_id: string
  email: string | null
  criado_em: string
}

export default function SuperAdminsPage() {
  const router = useRouter()
  const [list, setList] = useState<SuperAdmin[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  // Dialog cadastrar
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [form, setForm] = useState({ nome: '', email: '', senha: '' })
  const [formResult, setFormResult] = useState<{ email: string; senha: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const createdRef = useRef(false)

  // Remover
  const [removing, setRemoving] = useState<string | null>(null)

  const fetchList = () => {
    setLoading(true)
    fetch('/api/super-admin/super-admins')
      .then(r => r.json())
      .then(d => {
        setList(d.super_admins || [])
        setCurrentUserId(d.current_user_id || '')
      })
      .catch(() => toast.error('Erro ao carregar super-admins'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchList() }, [])

  useEffect(() => {
    if (!dialogOpen && createdRef.current) {
      fetchList()
      createdRef.current = false
    }
  }, [dialogOpen])

  useEffect(() => {
    if (!dialogOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !formLoading) setDialogOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [dialogOpen, formLoading])

  const openDialog = () => {
    setForm({ nome: '', email: '', senha: '' })
    setFormResult(null)
    setCopied(false)
    setShowPassword(false)
    setDialogOpen(true)
  }

  const closeDialog = () => {
    if (formLoading) return
    setDialogOpen(false)
  }

  const gerarSenha = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#'
    let s = ''
    for (let i = 0; i < 12; i++) s += chars.charAt(Math.floor(Math.random() * chars.length))
    setForm(prev => ({ ...prev, senha: s }))
    setShowPassword(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    try {
      const res = await fetch('/api/super-admin/super-admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erro ao cadastrar super-admin')
        return
      }
      createdRef.current = true
      setFormResult({ email: form.email, senha: form.senha })
      toast.success('Super-admin cadastrado!')
    } catch {
      toast.error('Erro ao cadastrar super-admin')
    } finally {
      setFormLoading(false)
    }
  }

  const copyCredentials = () => {
    if (!formResult) return
    navigator.clipboard.writeText(`Email: ${formResult.email}\nSenha: ${formResult.senha}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const removerSuperAdmin = async (user_id: string, email: string | null) => {
    if (user_id === currentUserId) {
      toast.error('Voce nao pode remover a si mesmo')
      return
    }
    const confirmacao = confirm(`Remover o super-admin ${email || user_id}? Ele perdera acesso ao painel.`)
    if (!confirmacao) return

    setRemoving(user_id)
    try {
      const res = await fetch(`/api/super-admin/super-admins?user_id=${encodeURIComponent(user_id)}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erro ao remover super-admin')
        return
      }
      toast.success('Super-admin removido')
      fetchList()
    } catch {
      toast.error('Erro ao remover super-admin')
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="glass-panel-elevated sticky top-0 z-30 flex items-center justify-between p-4 px-6 border-b border-white/6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/admin')}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/50 hover:text-white/90 hover:bg-white/5 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10">
            <Shield className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Super-admins</h1>
            <p className="text-xs text-white/40">Quem tem acesso ao painel /admin</p>
          </div>
        </div>
        <button
          onClick={openDialog}
          className="btn-glow flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
        >
          <Plus className="h-4 w-4" />
          Cadastrar super-admin
        </button>
      </header>

      <div className="p-6 max-w-4xl mx-auto space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            <p className="text-sm text-white/30">Carregando super-admins...</p>
          </div>
        ) : list.length === 0 ? (
          <div className="glass-card rounded-xl p-10 text-center text-white/40 text-sm">
            Nenhum super-admin cadastrado.
          </div>
        ) : (
          <div className="glass-card rounded-xl divide-y divide-white/5 overflow-hidden">
            {list.map(sa => (
              <div key={sa.user_id} className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/15 to-cyan-500/10">
                    <Shield className="h-4 w-4 text-emerald-400/80" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{sa.email || '(sem email)'}</p>
                    <p className="text-xs text-white/30">
                      Desde {new Date(sa.criado_em).toLocaleDateString('pt-BR')}
                      {sa.user_id === currentUserId && (
                        <span className="ml-2 text-emerald-400/80">• voce</span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removerSuperAdmin(sa.user_id, sa.email)}
                  disabled={sa.user_id === currentUserId || removing === sa.user_id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400/80 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title={sa.user_id === currentUserId ? 'Voce nao pode remover a si mesmo' : 'Remover super-admin'}
                >
                  {removing === sa.user_id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog cadastrar */}
      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={closeDialog}
        >
          <div
            className="glass-card-elevated w-full max-w-md rounded-2xl p-6 space-y-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-400" />
                {formResult ? 'Super-admin criado' : 'Novo super-admin'}
              </h2>
              <button
                onClick={closeDialog}
                disabled={formLoading}
                className="text-white/40 hover:text-white/80"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formResult ? (
              <div className="space-y-4">
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                  <p className="text-xs text-amber-200/80">
                    Salve essas credenciais agora. A senha nao sera mostrada novamente.
                  </p>
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-white/40 mb-1">Email</p>
                    <p className="text-white font-mono">{formResult.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/40 mb-1">Senha</p>
                    <p className="text-white font-mono">{formResult.senha}</p>
                  </div>
                </div>
                <button
                  onClick={copyCredentials}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-white/10 text-sm text-white/80 hover:bg-white/5 transition-all"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiar credenciais
                    </>
                  )}
                </button>
                <button
                  onClick={closeDialog}
                  className="btn-glow w-full py-2.5 rounded-lg text-sm"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-sm font-medium text-white/60">
                    <User className="h-3.5 w-3.5" />
                    Nome
                  </label>
                  <input
                    placeholder="Ex: Joao Silva"
                    value={form.nome}
                    onChange={e => setForm(prev => ({ ...prev, nome: e.target.value }))}
                    required
                    className="glass-input w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder:text-white/25 outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-sm font-medium text-white/60">
                    <Mail className="h-3.5 w-3.5" />
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="joao@empresa.com"
                    value={form.email}
                    onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                    required
                    className="glass-input w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder:text-white/25 outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-sm font-medium text-white/60">
                      <Lock className="h-3.5 w-3.5" />
                      Senha
                    </label>
                    <button
                      type="button"
                      onClick={gerarSenha}
                      className="text-xs text-emerald-400/80 hover:text-emerald-300"
                    >
                      Gerar senha
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Minimo 6 caracteres"
                      value={form.senha}
                      onChange={e => setForm(prev => ({ ...prev, senha: e.target.value }))}
                      required
                      minLength={6}
                      className="glass-input w-full px-4 py-2.5 pr-10 rounded-xl text-sm text-white placeholder:text-white/25 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={formLoading}
                  className="btn-glow w-full py-2.5 rounded-lg text-sm flex items-center justify-center gap-2"
                >
                  {formLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Cadastrar
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
