'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Shield, ArrowLeft, Building2, Users, Ticket,
  Globe, CheckCircle2, XCircle, Loader2, Edit2,
  Save, X, Clock, Wifi, WifiOff, Mail
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!org) return null

  const ticketsAtivos = tickets.filter(t => ['aberto', 'em_atendimento'].includes(t.status)).length
  const ticketsConcluidos = tickets.filter(t => t.status === 'resolvido').length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/admin')}
          className="text-white/60 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-bold text-white">{org.nome}</p>
            <p className="text-xs text-white/50 font-mono">{org.slug}.{process.env.NEXT_PUBLIC_BASE_DOMAIN || 'multihub-one.vercel.app'}</p>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <Badge className={org.ativo
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              : 'bg-red-500/20 text-red-300 border-red-500/30'
            }>
              {org.ativo ? 'Ativa' : 'Suspensa'}
            </Badge>
            <Badge variant="outline" className="border-primary/30 text-primary/80 text-xs">
              {org.plano}
            </Badge>
            {!org.onboarding_completo && (
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">
                <Clock className="h-3 w-3 mr-1" />
                Onboarding pendente
              </Badge>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleAtivo}
          className={org.ativo
            ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
            : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
          }
        >
          {org.ativo ? <XCircle className="h-4 w-4 mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
          {org.ativo ? 'Suspender' : 'Ativar'}
        </Button>
      </header>

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Colaboradores', value: colaboradores.filter(c => c.ativo).length, icon: Users, color: 'blue' },
            { label: 'Online agora', value: colaboradores.filter(c => c.is_online).length, icon: Wifi, color: 'emerald' },
            { label: 'Tickets ativos', value: ticketsAtivos, icon: Ticket, color: 'amber' },
            { label: 'Canais ativos', value: canais.filter(c => c.ativo).length, icon: Globe, color: 'violet' },
          ].map(stat => (
            <Card key={stat.label} className="bg-white/5 border-white/10">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-${stat.color}-500/20`}>
                  <stat.icon className={`h-5 w-5 text-${stat.color}-400`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-white/50">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Configurações da Org */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Configurações
              </CardTitle>
              {!editing ? (
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="text-white/60 hover:text-white">
                  <Edit2 className="h-4 w-4 mr-1" />
                  Editar
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="text-white/60 hover:text-white">
                    <X className="h-4 w-4" />
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                    Salvar
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-white/70 text-xs">Nome da empresa</Label>
                    <Input
                      value={form.nome}
                      onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white/70 text-xs">Plano</Label>
                    <Input
                      value={form.plano}
                      onChange={e => setForm(p => ({ ...p, plano: e.target.value }))}
                      className="bg-white/5 border-white/10 text-white"
                      placeholder="basic, pro, enterprise..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white/70 text-xs">URL do Logo</Label>
                    <Input
                      value={form.logo_url}
                      onChange={e => setForm(p => ({ ...p, logo_url: e.target.value }))}
                      className="bg-white/5 border-white/10 text-white"
                      placeholder="https://..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white/70 text-xs">Cor primária</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.cor_primaria}
                        onChange={e => setForm(p => ({ ...p, cor_primaria: e.target.value }))}
                        className="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
                      />
                      <Input
                        value={form.cor_primaria}
                        onChange={e => setForm(p => ({ ...p, cor_primaria: e.target.value }))}
                        className="bg-white/5 border-white/10 text-white font-mono text-sm"
                        maxLength={7}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-white/50">Slug</dt>
                    <dd className="text-white font-mono">{org.slug}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-white/50">Nome</dt>
                    <dd className="text-white">{org.nome}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-white/50">Plano</dt>
                    <dd className="text-white">{org.plano}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-white/50">Admin</dt>
                    <dd className="text-white text-xs">{org.admin_email || '—'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-white/50">Cor primária</dt>
                    <dd className="flex items-center gap-2">
                      <span
                        className="inline-block w-4 h-4 rounded-full border border-white/20"
                        style={{ backgroundColor: org.cor_primaria || '#6366f1' }}
                      />
                      <span className="text-white font-mono text-xs">{org.cor_primaria || '#6366f1'}</span>
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-white/50">Onboarding</dt>
                    <dd>{org.onboarding_completo
                      ? <span className="text-emerald-400 text-xs">Concluído</span>
                      : <span className="text-amber-400 text-xs">Pendente</span>
                    }</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-white/50">Criado em</dt>
                    <dd className="text-white/70 text-xs">
                      {new Date(org.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-white/50">Tickets totais</dt>
                    <dd className="text-white">{tickets.length} <span className="text-white/40 text-xs">({ticketsConcluidos} resolvidos)</span></dd>
                  </div>
                </dl>
              )}
            </CardContent>
          </Card>

          {/* Canais */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-violet-400" />
                Canais de Atendimento
                <Badge variant="outline" className="ml-auto border-white/20 text-white/50 text-xs">
                  {canais.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {canais.length === 0 ? (
                <p className="text-white/40 text-sm text-center py-6">Nenhum canal configurado</p>
              ) : (
                <div className="space-y-2">
                  {canais.map(canal => (
                    <div key={canal.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5 text-white/40" />
                        <span className="text-sm text-white">{canal.nome}</span>
                        <Badge variant="outline" className="text-xs border-white/10 text-white/40 font-mono">
                          {canal.tipo}
                        </Badge>
                      </div>
                      <div className={`h-2 w-2 rounded-full ${canal.ativo ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Colaboradores */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-400" />
              Colaboradores
              <Badge variant="outline" className="ml-auto border-white/20 text-white/50 text-xs">
                {colaboradores.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {colaboradores.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-6">Nenhum colaborador</p>
            ) : (
              <div className="divide-y divide-white/5">
                {colaboradores.map(colab => (
                  <div key={colab.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="relative flex-shrink-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
                        {colab.nome.charAt(0).toUpperCase()}
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900 ${colab.is_online ? 'bg-emerald-400' : 'bg-white/20'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium">{colab.nome}</p>
                      <p className="text-xs text-white/40 flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3" />
                        {colab.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {colab.is_online ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-400">
                          <Wifi className="h-3 w-3" />
                          Online
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-white/30">
                          <WifiOff className="h-3 w-3" />
                          Offline
                        </span>
                      )}
                      {!colab.ativo && (
                        <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-xs">Inativo</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
