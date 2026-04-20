'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  Shield, ArrowLeft, Building2, Users, Ticket,
  Globe, CheckCircle2, XCircle, Loader2, Edit2,
  Save, X, Clock, Wifi, WifiOff, Mail, Trash2, AlertTriangle
} from 'lucide-react'
import { toast } from 'sonner'

interface Colaborador {
  id: string
  nome: string
  email: string
  ativo: boolean
  is_online: boolean
}

interface Canal {
  id: string
  nome: string
  tipo: string
  ativo: boolean
}

interface OrgDetails {
  id: string
  slug: string
  nome: string
  plano: string
  ativo: boolean
  logo_url: string | null
  cor_primaria: string | null
  admin_email: string | null
  onboarding_completo: boolean
  criado_em: string
}

export default function AdminOrgDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()

  const [org, setOrg] = useState<OrgDetails | null>(null)
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [canais, setCanais] = useState<Canal[]>([])
  const [tickets, setTickets] = useState<{ id: string; status: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    nome: '',
    plano: '',
    logo_url: '',
    cor_primaria: '#6366f1',
  })

  useEffect(() => {
    fetch(`/api/super-admin/organizacoes/${slug}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { toast.error(d.error); router.push('/admin'); return }
        setOrg(d.organizacao)
        setColaboradores(d.colaboradores || [])
        setCanais(d.canais || [])
        setTickets(d.tickets || [])
        setForm({
          nome: d.organizacao.nome,
          plano: d.organizacao.plano,
          logo_url: d.organizacao.logo_url || '',
          cor_primaria: d.organizacao.cor_primaria || '#6366f1',
        })
      })
      .catch(() => toast.error('Erro ao carregar organização'))
      .finally(() => setLoading(false))
  }, [slug, router])

  const handleSave = async () => {
    setSaving(true)
    const res = await fetch(`/api/super-admin/organizacoes/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: form.nome,
        plano: form.plano,
        logo_url: form.logo_url || null,
        cor_primaria: form.cor_primaria,
      }),
    })
    setSaving(false)
    if (res.ok) {
      const d = await res.json()
      setOrg(d.organizacao)
      setEditing(false)
      toast.success('Organização atualizada')
    } else {
      const d = await res.json()
      toast.error(d.error || 'Erro ao salvar')
    }
  }

  const toggleAtivo = async () => {
    if (!org) return
    const res = await fetch(`/api/super-admin/organizacoes/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !org.ativo }),
    })
    if (res.ok) {
      setOrg(prev => prev ? { ...prev, ativo: !prev.ativo } : prev)
      toast.success(org.ativo ? 'Organização suspensa' : 'Organização ativada')
    }
  }

  // ── Exclusao da organizacao ──
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmSlug, setDeleteConfirmSlug] = useState('')
  const [deleting, setDeleting] = useState(false)

  const openDeleteDialog = () => {
    setDeleteConfirmSlug('')
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!org) return
    if (deleteConfirmSlug !== org.slug) {
      toast.error('Digite o slug exatamente como aparece')
      return
    }
    setDeleting(true)
    try {
      const res = await fetch(`/api/super-admin/organizacoes/${slug}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm_slug: deleteConfirmSlug }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erro ao excluir organizacao')
        return
      }
      toast.success('Organizacao excluida permanentemente')
      router.push('/admin')
    } catch {
      toast.error('Erro ao excluir organizacao')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        <p className="text-sm text-white/30">Carregando organização...</p>
      </div>
    )
  }

  if (!org) return null

  const ticketsAtivos = tickets.filter(t => ['aberto', 'em_atendimento'].includes(t.status)).length
  const ticketsConcluidos = tickets.filter(t => t.status === 'resolvido').length

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="glass-header sticky top-0 z-30 px-6 py-4">
        <div className="flex items-center gap-4 max-w-6xl mx-auto">
          <button
            onClick={() => router.push('/admin')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-all text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>

          <div className="flex items-center gap-3 flex-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl brand-gradient shadow-lg shadow-emerald-500/20">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg brand-gradient-text">{org.nome}</h1>
              <p className="text-xs text-white/30 font-mono">{org.slug}.{process.env.NEXT_PUBLIC_BASE_DOMAIN || 'multihub-one.vercel.app'}</p>
            </div>
            <div className="flex items-center gap-2 ml-2">
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
          </div>

          <button
            onClick={toggleAtivo}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              org.ativo
                ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
                : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
            }`}
          >
            {org.ativo ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {org.ativo ? 'Suspender' : 'Ativar'}
          </button>

          <button
            onClick={openDeleteDialog}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
          >
            <Trash2 className="h-4 w-4" />
            Excluir empresa
          </button>
        </div>
      </header>

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Colaboradores', value: colaboradores.filter(c => c.ativo).length, icon: Users, gradient: 'from-blue-500/20 to-cyan-500/10' },
            { label: 'Online agora', value: colaboradores.filter(c => c.is_online).length, icon: Wifi, gradient: 'from-emerald-500/20 to-green-500/10' },
            { label: 'Tickets ativos', value: ticketsAtivos, icon: Ticket, gradient: 'from-amber-500/20 to-orange-500/10' },
            { label: 'Canais ativos', value: canais.filter(c => c.ativo).length, icon: Globe, gradient: 'from-violet-500/20 to-purple-500/10' },
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

        <div className="grid md:grid-cols-2 gap-6">
          {/* Configuracoes da Org */}
          <div className="glass-card-elevated rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-400" />
                <h3 className="font-semibold text-white text-sm">Configurações</h3>
              </div>
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white hover:bg-white/5 transition-all"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Editar
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditing(false)}
                    className="flex items-center justify-center h-8 w-8 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-glow flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Salvar
                  </button>
                </div>
              )}
            </div>

            <div className="p-5">
              {editing ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/50">Nome da empresa</label>
                    <input
                      value={form.nome}
                      onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                      className="glass-input w-full px-3.5 py-2 rounded-lg text-sm text-white outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/50">Plano</label>
                    <input
                      value={form.plano}
                      onChange={e => setForm(p => ({ ...p, plano: e.target.value }))}
                      className="glass-input w-full px-3.5 py-2 rounded-lg text-sm text-white outline-none"
                      placeholder="basic, pro, enterprise..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/50">URL do Logo</label>
                    <input
                      value={form.logo_url}
                      onChange={e => setForm(p => ({ ...p, logo_url: e.target.value }))}
                      className="glass-input w-full px-3.5 py-2 rounded-lg text-sm text-white outline-none"
                      placeholder="https://..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/50">Cor primária</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.cor_primaria}
                        onChange={e => setForm(p => ({ ...p, cor_primaria: e.target.value }))}
                        className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                      />
                      <input
                        value={form.cor_primaria}
                        onChange={e => setForm(p => ({ ...p, cor_primaria: e.target.value }))}
                        className="glass-input flex-1 px-3.5 py-2 rounded-lg text-sm text-white outline-none font-mono"
                        maxLength={7}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <dl className="space-y-3 text-sm">
                  {[
                    { label: 'Slug', value: <span className="font-mono">{org.slug}</span> },
                    { label: 'Nome', value: org.nome },
                    { label: 'Plano', value: org.plano },
                    { label: 'Admin', value: <span className="text-xs">{org.admin_email || '\u2014'}</span> },
                    {
                      label: 'Cor primária',
                      value: (
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block w-4 h-4 rounded-full border border-white/15"
                            style={{ backgroundColor: org.cor_primaria || '#6366f1' }}
                          />
                          <span className="font-mono text-xs text-white/60">{org.cor_primaria || '#6366f1'}</span>
                        </span>
                      ),
                    },
                    {
                      label: 'Onboarding',
                      value: org.onboarding_completo
                        ? <span className="text-emerald-400 text-xs">Concluído</span>
                        : <span className="text-amber-400 text-xs">Pendente</span>,
                    },
                    {
                      label: 'Criado em',
                      value: (
                        <span className="text-white/50 text-xs">
                          {new Date(org.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      ),
                    },
                    {
                      label: 'Tickets totais',
                      value: (
                        <>
                          {tickets.length}{' '}
                          <span className="text-white/30 text-xs">({ticketsConcluidos} resolvidos)</span>
                        </>
                      ),
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center py-1">
                      <dt className="text-white/40">{label}</dt>
                      <dd className="text-white">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>

          {/* Canais */}
          <div className="glass-card-elevated rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-violet-400" />
                <h3 className="font-semibold text-white text-sm">Canais de Atendimento</h3>
              </div>
              <span className="glass-badge rounded-md px-2 py-0.5 text-xs text-white/40 bg-white/5">
                {canais.length}
              </span>
            </div>

            <div className="p-5">
              {canais.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-white/30 gap-2">
                  <Globe className="h-8 w-8 opacity-30" />
                  <p className="text-sm">Nenhum canal configurado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {canais.map(canal => (
                    <div key={canal.id} className="flex items-center justify-between glass-card rounded-lg px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Globe className="h-3.5 w-3.5 text-white/30" />
                        <span className="text-sm text-white">{canal.nome}</span>
                        <span className="glass-badge rounded-md px-2 py-0.5 text-xs font-mono text-white/40 bg-white/5">
                          {canal.tipo}
                        </span>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 text-xs ${canal.ativo ? 'text-emerald-400' : 'text-red-400'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${canal.ativo ? 'status-dot-online' : 'status-dot-busy'}`} />
                        {canal.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Colaboradores */}
        <div className="glass-card-elevated rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-400" />
              <h3 className="font-semibold text-white text-sm">Colaboradores</h3>
            </div>
            <span className="glass-badge rounded-md px-2 py-0.5 text-xs text-white/40 bg-white/5">
              {colaboradores.length}
            </span>
          </div>

          <div className="p-5">
            {colaboradores.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-white/30 gap-2">
                <Users className="h-8 w-8 opacity-30" />
                <p className="text-sm">Nenhum colaborador</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {colaboradores.map(colab => (
                  <div key={colab.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-white/8 to-white/3 border border-white/8 text-sm font-semibold text-white/70">
                        {colab.nome.charAt(0).toUpperCase()}
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0a0c14] ${
                        colab.is_online ? 'status-dot-online' : 'bg-white/15'
                      }`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium">{colab.nome}</p>
                      <p className="text-xs text-white/30 flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3" />
                        {colab.email}
                      </p>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2 shrink-0">
                      {colab.is_online ? (
                        <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                          <Wifi className="h-3 w-3" />
                          Online
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs text-white/25">
                          <WifiOff className="h-3 w-3" />
                          Offline
                        </span>
                      )}
                      {!colab.ativo && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-red-500/10 text-red-400 border border-red-500/20">
                          Inativo
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialog de exclusao */}
      {deleteDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => !deleting && setDeleteDialogOpen(false)}
        >
          <div
            className="glass-card-elevated w-full max-w-md rounded-2xl p-6 space-y-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Excluir empresa permanentemente
              </h2>
              <button
                onClick={() => !deleting && setDeleteDialogOpen(false)}
                disabled={deleting}
                className="text-white/40 hover:text-white/80"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-2">
              <p className="text-sm text-white/80">
                Esta acao e <strong className="text-red-400">irreversivel</strong>. Serao apagados:
              </p>
              <ul className="list-disc list-inside text-xs text-white/60 space-y-0.5">
                <li>Todos os tickets e mensagens</li>
                <li>Todos os colaboradores (incluindo usuarios de auth)</li>
                <li>Todos os setores, canais e templates</li>
                <li>Clientes e base de conhecimento</li>
                <li>A propria organizacao</li>
              </ul>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/60">
                Para confirmar, digite o slug: <span className="text-red-400 font-mono">{org.slug}</span>
              </label>
              <input
                type="text"
                value={deleteConfirmSlug}
                onChange={e => setDeleteConfirmSlug(e.target.value)}
                placeholder={org.slug}
                disabled={deleting}
                className="glass-input w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder:text-white/25 outline-none font-mono"
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setDeleteDialogOpen(false)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-lg border border-white/10 text-sm text-white/70 hover:bg-white/5 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || deleteConfirmSlug !== org.slug}
                className="flex-1 py-2.5 rounded-lg bg-red-500/20 border border-red-500/40 text-sm text-red-300 hover:bg-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Excluir permanentemente
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
