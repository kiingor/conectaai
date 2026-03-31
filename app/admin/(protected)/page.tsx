'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Shield, Plus, Search, Building2, Users, Ticket,
  Globe, CheckCircle2, XCircle, Clock, Loader2
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

  useEffect(() => {
    fetch('/api/super-admin/organizacoes')
      .then(r => r.json())
      .then(d => setOrgs(d.organizacoes || []))
      .catch(() => toast.error('Erro ao carregar organizações'))
      .finally(() => setLoading(false))
  }, [])

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-bold text-white">Super Admin</p>
            <p className="text-xs text-white/50">Painel de controle da plataforma</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push('/admin/novo')} size="sm" className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-1" />
            Nova Organização
          </Button>
          <Button onClick={handleLogout} variant="ghost" size="sm" className="text-white/60 hover:text-white">
            Sair
          </Button>
        </div>
      </header>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Stats gerais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total de Orgs', value: orgs.length, icon: Building2 },
            { label: 'Orgs Ativas', value: orgs.filter(o => o.ativo).length, icon: CheckCircle2 },
            { label: 'Total Colaboradores', value: orgs.reduce((s, o) => s + o.stats.colaboradores, 0), icon: Users },
            { label: 'Tickets Ativos', value: orgs.reduce((s, o) => s + o.stats.tickets_ativos, 0), icon: Ticket },
          ].map(stat => (
            <Card key={stat.label} className="bg-white/5 border-white/10">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-white/50">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            placeholder="Buscar por nome, slug ou email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/40"
          />
        </div>

        {/* Lista de orgs */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map(org => (
              <Card
                key={org.id}
                className="bg-white/5 border-white/10 hover:bg-white/8 cursor-pointer transition-colors"
                onClick={() => router.push(`/admin/${org.slug}`)}
              >
                <CardContent className="p-5 flex items-center gap-4">
                  {/* Info principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-white">{org.nome}</p>
                      <Badge variant="outline" className="text-xs border-white/20 text-white/60 font-mono">
                        {org.slug}
                      </Badge>
                      <Badge className={org.ativo
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-red-500/20 text-red-300 border-red-500/30'
                      }>
                        {org.ativo ? 'Ativa' : 'Suspensa'}
                      </Badge>
                      <Badge variant="outline" className="text-xs border-primary/30 text-primary/80">
                        {org.plano}
                      </Badge>
                      {!org.onboarding_completo && (
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          Onboarding pendente
                        </Badge>
                      )}
                    </div>
                    {org.admin_email && (
                      <p className="text-xs text-white/40 mt-1">{org.admin_email}</p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="hidden md:flex items-center gap-6 text-white/60 text-sm shrink-0">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-4 w-4" />
                      <span>{org.stats.colaboradores}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Ticket className="h-4 w-4" />
                      <span>{org.stats.tickets_ativos}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Globe className="h-4 w-4" />
                      <span>{org.stats.canais}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={e => { e.stopPropagation(); toggleAtivo(org.slug, org.ativo) }}
                    className={org.ativo
                      ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                      : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                    }
                  >
                    {org.ativo ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    <span className="ml-1 hidden sm:inline">{org.ativo ? 'Suspender' : 'Ativar'}</span>
                  </Button>
                </CardContent>
              </Card>
            ))}

            {filtered.length === 0 && !loading && (
              <div className="text-center py-16 text-white/40">
                <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma organização encontrada</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
