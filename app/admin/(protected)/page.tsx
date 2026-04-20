'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Shield, Plus, Search, Building2, Users, Ticket,
  Globe, CheckCircle2, XCircle, Clock, Loader2, LogOut,
  X, Copy, User, Mail, Tag, CreditCard, Lock, Eye, EyeOff
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface OrgStats {
  id: string
  slug: string
  nome: string
  plano: string
  ativo: boolean
  admin_email: string | null
  onboarding_completo: boolean
  criado_em: string
  stats: { colaboradores: number; tickets_ativos: number; canais: number }
}

export default function AdminPage() {
  const router = useRouter()
  const [orgs, setOrgs] = useState<OrgStats[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [formResult, setFormResult] = useState<{
    slug: string
    admin_email: string
    senha: string
    login_url: string
  } | null>(null)
  const [copied, setCopied] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({
    nome: '',
    plano: 'basic',
    admin_email: '',
    admin_nome: '',
    admin_senha: '',
  })
  const createdRef = useRef(false)

  const fetchOrgs = () => {
    setLoading(true)
    fetch('/api/super-admin/organizacoes')
      .then(r => r.json())
      .then(d => setOrgs(d.organizacoes || []))
      .catch(() => toast.error('Erro ao carregar organizações'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchOrgs() }, [])

  // Escape key to close dialog
  useEffect(() => {
    if (!dialogOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !formLoading) setDialogOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [dialogOpen, formLoading])

  // Refresh org list when dialog closes after creation
  useEffect(() => {
    if (!dialogOpen && createdRef.current) {
      fetchOrgs()
      createdRef.current = false
    }
  }, [dialogOpen])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  const toggleAtivo = async (slug: string, ativo: boolean) => {
    const res = await fetch(`/api/super-admin/organizacoes/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !ativo }),
    })
    if (res.ok) {
      setOrgs(prev => prev.map(o => o.slug === slug ? { ...o, ativo: !ativo } : o))
      toast.success(ativo ? 'Organização suspensa' : 'Organização ativada')
    }
  }

  const filtered = orgs.filter(o =>
    o.nome.toLowerCase().includes(search.toLowerCase()) ||
    o.slug.toLowerCase().includes(search.toLowerCase()) ||
    (o.admin_email || '').toLowerCase().includes(search.toLowerCase())
  )

  // ── Dialog functions ──

  const openDialog = () => {
    setForm({ nome: '', plano: 'basic', admin_email: '', admin_nome: '', admin_senha: '' })
    setFormResult(null)
    setCopied(false)
    setShowPassword(false)
    setDialogOpen(true)
  }

  const closeDialog = () => {
    if (formLoading) return
    setDialogOpen(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    try {
      const res = await fetch('/api/super-admin/organizacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erro ao criar organização')
        return
      }
      createdRef.current = true
      setFormResult({
        slug: data.organizacao.slug,
        admin_email: form.admin_email,
        senha: form.admin_senha,
        login_url: `${window.location.origin}/login?org=${data.organizacao.slug}`,
      })
      toast.success('Organização criada com sucesso!')
    } catch {
      toast.error('Erro ao criar organização')
    } finally {
      setFormLoading(false)
    }
  }

  const copyCredentials = () => {
    if (!formResult) return
    navigator.clipboard.writeText(`URL: ${formResult.login_url}\nEmail: ${formResult.admin_email}\nSenha: ${formResult.senha}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="glass-header sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl brand-gradient shadow-lg shadow-emerald-500/20">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg brand-gradient-text">Super Admin</h1>
            <p className="text-xs text-white/40">Painel de controle ConectaAI</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/admin/super-admins')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/60 hover:text-white/90 hover:bg-white/5 transition-all"
          >
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Super-admins</span>
          </button>
          <button
            onClick={openDialog}
            className="btn-glow flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
          >
            <Plus className="h-4 w-4" />
            Nova Organização
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-all"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Stats gerais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total de Orgs', value: orgs.length, icon: Building2, gradient: 'from-emerald-500/20 to-cyan-500/10' },
            { label: 'Orgs Ativas', value: orgs.filter(o => o.ativo).length, icon: CheckCircle2, gradient: 'from-green-500/20 to-emerald-500/10' },
            { label: 'Total Colaboradores', value: orgs.reduce((s, o) => s + o.stats.colaboradores, 0), icon: Users, gradient: 'from-blue-500/20 to-cyan-500/10' },
            { label: 'Tickets Ativos', value: orgs.reduce((s, o) => s + o.stats.tickets_ativos, 0), icon: Ticket, gradient: 'from-amber-500/20 to-orange-500/10' },
          ].map(stat => (
            <div key={stat.label} className="glass-card rounded-xl p-4 flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${stat.gradient}`}>
                <stat.icon className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-white/40">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            placeholder="Buscar por nome, slug ou email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="glass-input w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder:text-white/30 outline-none"
          />
        </div>

        {/* Lista de orgs */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            <p className="text-sm text-white/30">Carregando organizações...</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(org => (
              <div
                key={org.id}
                className="glass-card-elevated rounded-xl cursor-pointer group"
                onClick={() => router.push(`/admin/${org.slug}`)}
              >
                <div className="p-5 flex items-center gap-4">
                  {/* Org avatar */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/8 text-lg font-bold text-white/60 shrink-0 group-hover:border-emerald-500/30 transition-colors">
                    {org.nome.charAt(0).toUpperCase()}
                  </div>

                  {/* Info principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-white group-hover:text-emerald-300 transition-colors">{org.nome}</p>
                      <span className="glass-badge rounded-md px-2 py-0.5 text-xs font-mono text-white/50 bg-white/5">
                        {org.slug}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        org.ativo
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          org.ativo ? 'status-dot-online' : 'status-dot-busy'
                        }`} />
                        {org.ativo ? 'Ativa' : 'Suspensa'}
                      </span>
                      <span className="glass-badge rounded-md px-2 py-0.5 text-xs text-emerald-400/70 bg-emerald-500/5 border border-emerald-500/10">
                        {org.plano}
                      </span>
                      {!org.onboarding_completo && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Clock className="h-3 w-3" />
                          Onboarding pendente
                        </span>
                      )}
                    </div>
                    {org.admin_email && (
                      <p className="text-xs text-white/30 mt-1">{org.admin_email}</p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="hidden md:flex items-center gap-5 text-white/40 text-sm shrink-0">
                    <div className="flex items-center gap-1.5" title="Colaboradores">
                      <Users className="h-4 w-4" />
                      <span className="text-white/60">{org.stats.colaboradores}</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Tickets ativos">
                      <Ticket className="h-4 w-4" />
                      <span className="text-white/60">{org.stats.tickets_ativos}</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Canais">
                      <Globe className="h-4 w-4" />
                      <span className="text-white/60">{org.stats.canais}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <button
                    onClick={e => { e.stopPropagation(); toggleAtivo(org.slug, org.ativo) }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      org.ativo
                        ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                        : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                    }`}
                  >
                    {org.ativo ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    <span className="hidden sm:inline">{org.ativo ? 'Suspender' : 'Ativar'}</span>
                  </button>
                </div>
              </div>
            ))}

            {filtered.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-20 text-white/30 gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 border border-white/8">
                  <Building2 className="h-8 w-8 opacity-40" />
                </div>
                <p className="text-sm">Nenhuma organização encontrada</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Dialog: Nova Organização ── */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeDialog}
          />

          {/* Dialog card */}
          <div className="relative w-full max-w-lg glass-card-elevated rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* Close button */}
            <button
              onClick={closeDialog}
              disabled={formLoading}
              className="absolute right-4 top-4 z-10 flex items-center justify-center h-8 w-8 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>

            {formResult ? (
              /* ── Success result ── */
              <>
                <div className="brand-gradient px-6 py-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                    <CheckCircle2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Organização criada!</p>
                    <p className="text-xs text-white/70">Credenciais de acesso geradas</p>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  <div className="rounded-xl bg-black/30 border border-white/8 p-4 space-y-3 font-mono text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-white/40 shrink-0 w-14">URL:</span>
                      <span className="text-emerald-400 break-all">{formResult.login_url}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white/40 shrink-0 w-14">Email:</span>
                      <span className="text-white">{formResult.admin_email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white/40 shrink-0 w-14">Senha:</span>
                      <span className="text-cyan-300 font-semibold">{formResult.senha}</span>
                    </div>
                  </div>

                  <p className="text-xs text-white/30 leading-relaxed">
                    Compartilhe essas credenciais com o admin da empresa.
                  </p>

                  <div className="flex gap-3">
                    <button
                      onClick={copyCredentials}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl glass-card text-sm font-medium text-white/80 hover:text-white transition-all"
                    >
                      {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      {copied ? 'Copiado!' : 'Copiar credenciais'}
                    </button>
                    <button
                      onClick={closeDialog}
                      className="flex-1 btn-glow px-4 py-2.5 rounded-xl text-sm"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* ── Creation form ── */
              <>
                <div className="px-6 pt-6 pb-4 border-b border-white/6">
                  <h2 className="font-semibold text-white text-lg">Nova Organização</h2>
                  <p className="text-xs text-white/30 mt-1">Preencha as informações para criar uma nova empresa</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                  {/* Nome da empresa */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-1.5 text-sm font-medium text-white/60">
                      <Building2 className="h-3.5 w-3.5" />
                      Nome da empresa
                    </label>
                    <input
                      placeholder="Ex: Softcom Tecnologia"
                      value={form.nome}
                      onChange={e => setForm(prev => ({ ...prev, nome: e.target.value }))}
                      required
                      className="glass-input w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder:text-white/25 outline-none"
                    />
                  </div>

                  {/* Plano */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-1.5 text-sm font-medium text-white/60">
                      <CreditCard className="h-3.5 w-3.5" />
                      Plano
                    </label>
                    <select
                      value={form.plano}
                      onChange={e => setForm(prev => ({ ...prev, plano: e.target.value }))}
                      className="glass-input w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none bg-transparent appearance-none cursor-pointer"
                    >
                      <option value="basic" className="bg-[#0e1019] text-white">Basic</option>
                      <option value="pro" className="bg-[#0e1019] text-white">Pro</option>
                      <option value="enterprise" className="bg-[#0e1019] text-white">Enterprise</option>
                    </select>
                  </div>

                  {/* Divider */}
                  <div className="relative py-1">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/6" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-[#0e1019] px-3 text-xs text-white/30 font-medium">Admin da empresa</span>
                    </div>
                  </div>

                  {/* Nome do admin */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-1.5 text-sm font-medium text-white/60">
                      <User className="h-3.5 w-3.5" />
                      Nome do admin
                    </label>
                    <input
                      placeholder="Ex: João Silva"
                      value={form.admin_nome}
                      onChange={e => setForm(prev => ({ ...prev, admin_nome: e.target.value }))}
                      required
                      className="glass-input w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder:text-white/25 outline-none"
                    />
                  </div>

                  {/* Email do admin */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-1.5 text-sm font-medium text-white/60">
                      <Mail className="h-3.5 w-3.5" />
                      Email do admin
                    </label>
                    <input
                      type="email"
                      placeholder="admin@empresa.com"
                      value={form.admin_email}
                      onChange={e => setForm(prev => ({ ...prev, admin_email: e.target.value }))}
                      required
                      className="glass-input w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder:text-white/25 outline-none"
                    />
                  </div>

                  {/* Senha do admin */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-1.5 text-sm font-medium text-white/60">
                      <Lock className="h-3.5 w-3.5" />
                      Senha do admin
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Mínimo 6 caracteres"
                        value={form.admin_senha}
                        onChange={e => setForm(prev => ({ ...prev, admin_senha: e.target.value }))}
                        required
                        minLength={6}
                        className="glass-input w-full px-4 py-2.5 pr-11 rounded-xl text-sm text-white placeholder:text-white/25 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="btn-glow w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {formLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Criar organização
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
