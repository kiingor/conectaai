'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Building2, Globe, Users, Clock, CheckCircle2,
  ArrowRight, ArrowLeft, Loader2, Smartphone, Wifi,
  Coffee, MessageCircle
} from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

const STEPS = [
  { id: 1, label: 'Empresa', icon: Building2 },
  { id: 2, label: 'Canal', icon: Globe },
  { id: 3, label: 'Colaborador', icon: Users },
  { id: 4, label: 'Horários', icon: Clock },
  { id: 5, label: 'Concluído', icon: CheckCircle2 },
]

const DIAS_SEMANA = [
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [setorId, setSetorId] = useState<string | null>(null)

  // Step 1 — Empresa
  const [empresa, setEmpresa] = useState({ nome: '', logo_url: '', cor_primaria: '#6366f1' })

  // Step 2 — Canal
  const [canal, setCanal] = useState({
    tipo: 'whatsapp' as 'whatsapp' | 'evolution_api',
    nome: '',
    phone_number_id: '',
    whatsapp_token: '',
    instancia: '',
  })

  // Step 3 — Colaborador
  const [colab, setColab] = useState({ nome: '', email: '', senha: '' })

  // Step 4 — Horários e pausas
  const [horarios, setHorarios] = useState(
    DIAS_SEMANA.map(d => ({
      dia_semana: d.value,
      ativo: d.value >= 1 && d.value <= 5,
      hora_inicio: '08:00',
      hora_fim: '18:00',
    }))
  )
  const [pausasPadrao, setPausasPadrao] = useState([
    { nome: 'Almoço', selecionado: true },
    { nome: 'Banheiro', selecionado: true },
    { nome: 'Reunião', selecionado: true },
    { nome: 'Lanche', selecionado: false },
  ])

  useEffect(() => {
    // Pegar org e setor do contexto atual
    const orgIdCookie = document.cookie.match(/(?:^|;\s*)org_id=([^;]+)/)?.[1] || null
    setOrgId(orgIdCookie)

    if (orgIdCookie) {
      supabase.from('setores').select('id').eq('organizacao_id', orgIdCookie).single()
        .then(({ data }) => { if (data) setSetorId(data.id) })

      supabase.from('organizacoes').select('nome').eq('id', orgIdCookie).single()
        .then(({ data }) => { if (data) setEmpresa(prev => ({ ...prev, nome: data.nome })) })
    }
  }, [])

  const progress = ((step - 1) / (STEPS.length - 1)) * 100

  const saveStep1 = async () => {
    setLoading(true)
    try {
      await fetch('/api/onboarding/empresa', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: empresa.nome, logo_url: empresa.logo_url || null, cor_primaria: empresa.cor_primaria }),
      })
      setStep(2)
    } catch {
      toast.error('Erro ao salvar dados da empresa')
    } finally {
      setLoading(false)
    }
  }

  const saveStep2 = async () => {
    if (!setorId || !orgId) { setStep(3); return }
    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        setor_id: setorId,
        organizacao_id: orgId,
        nome: canal.nome || (canal.tipo === 'whatsapp' ? 'WhatsApp Principal' : 'Evolution Principal'),
        tipo: canal.tipo,
        ativo: true,
      }
      if (canal.tipo === 'whatsapp') {
        payload.phone_number_id = canal.phone_number_id || null
        payload.whatsapp_token = canal.whatsapp_token || null
      } else {
        payload.instancia = canal.instancia || null
      }
      await supabase.from('setor_canais').insert(payload)
      setStep(3)
    } catch {
      toast.error('Erro ao salvar canal')
    } finally {
      setLoading(false)
    }
  }

  const saveStep3 = async () => {
    if (!orgId) { setStep(4); return }
    if (!colab.email || !colab.nome || !colab.senha) {
      toast.error('Preencha todos os campos do colaborador')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-org-id': orgId },
        body: JSON.stringify({ email: colab.email, password: colab.senha, nome: colab.nome }),
      })
      if (!res.ok) {
        const d = await res.json()
        toast.error(d.error || 'Erro ao criar colaborador')
        return
      }
      setStep(4)
    } catch {
      toast.error('Erro ao criar colaborador')
    } finally {
      setLoading(false)
    }
  }

  const saveStep4 = async () => {
    if (!setorId || !orgId) { setStep(5); return }
    setLoading(true)
    try {
      // Salvar horários
      for (const h of horarios) {
        await supabase.from('horarios_atendimento').upsert({
          setor_id: setorId,
          organizacao_id: orgId,
          dia_semana: h.dia_semana,
          ativo: h.ativo,
          hora_inicio: h.hora_inicio,
          hora_fim: h.hora_fim,
        }, { onConflict: 'setor_id,dia_semana' })
      }
      // Salvar pausas selecionadas
      const pausasSelecionadas = pausasPadrao.filter(p => p.selecionado)
      for (const p of pausasSelecionadas) {
        await supabase.from('pausas').insert({ setor_id: setorId, organizacao_id: orgId, nome: p.nome, ativo: true })
      }
      setStep(5)
    } catch {
      toast.error('Erro ao salvar horários')
    } finally {
      setLoading(false)
    }
  }

  const completarOnboarding = async () => {
    setLoading(true)
    try {
      await fetch('/api/onboarding/completar', { method: 'POST' })
      router.push('/dashboard')
    } catch {
      toast.error('Erro ao concluir onboarding')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary">
            <MessageCircle className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Bem-vindo ao SoftcomHub</h1>
          <p className="text-muted-foreground text-sm">Configure sua empresa em poucos passos</p>
        </div>

        {/* Progress */}
        <div className="space-y-3">
          <div className="flex justify-between">
            {STEPS.map(s => (
              <div key={s.id} className="flex flex-col items-center gap-1">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  step > s.id ? 'bg-primary text-primary-foreground' :
                  step === s.id ? 'bg-primary text-primary-foreground' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {step > s.id ? <CheckCircle2 className="h-4 w-4" /> : s.id}
                </div>
                <span className="text-[10px] text-muted-foreground hidden sm:block">{s.label}</span>
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Step content */}
        <Card>
          <CardContent className="p-6">

            {/* Step 1: Dados da empresa */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <CardTitle className="flex items-center gap-2 mb-1"><Building2 className="h-5 w-5 text-primary" />Dados da empresa</CardTitle>
                  <p className="text-sm text-muted-foreground">Personalize as informações da sua empresa</p>
                </div>
                <div className="space-y-2">
                  <Label>Nome da empresa</Label>
                  <Input value={empresa.nome} onChange={e => setEmpresa(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Softcom Tecnologia" />
                </div>
                <div className="space-y-2">
                  <Label>URL do logo (opcional)</Label>
                  <Input value={empresa.logo_url} onChange={e => setEmpresa(p => ({ ...p, logo_url: e.target.value }))} placeholder="https://..." />
                </div>
                <div className="space-y-2">
                  <Label>Cor primária</Label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={empresa.cor_primaria} onChange={e => setEmpresa(p => ({ ...p, cor_primaria: e.target.value }))} className="h-10 w-16 rounded cursor-pointer border" />
                    <span className="text-sm font-mono text-muted-foreground">{empresa.cor_primaria}</span>
                  </div>
                </div>
                <Button onClick={saveStep1} disabled={loading || !empresa.nome} className="w-full">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Continuar <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Step 2: Canal */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <CardTitle className="flex items-center gap-2 mb-1"><Globe className="h-5 w-5 text-primary" />Canal de atendimento</CardTitle>
                  <p className="text-sm text-muted-foreground">Configure como você recebe e responde mensagens</p>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de canal</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['whatsapp', 'evolution_api'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setCanal(p => ({ ...p, tipo: t }))}
                        className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors ${canal.tipo === t ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                      >
                        {t === 'whatsapp' ? <Smartphone className="h-6 w-6 text-emerald-500" /> : <Wifi className="h-6 w-6 text-sky-500" />}
                        <span className="text-sm font-medium">{t === 'whatsapp' ? 'WhatsApp Oficial' : 'EvolutionAPI'}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {canal.tipo === 'whatsapp' && (
                  <>
                    <div className="space-y-2">
                      <Label>Phone Number ID</Label>
                      <Input value={canal.phone_number_id} onChange={e => setCanal(p => ({ ...p, phone_number_id: e.target.value }))} placeholder="123456789012345" />
                    </div>
                    <div className="space-y-2">
                      <Label>Access Token</Label>
                      <Input type="password" value={canal.whatsapp_token} onChange={e => setCanal(p => ({ ...p, whatsapp_token: e.target.value }))} placeholder="EAAxxxxx..." />
                    </div>
                  </>
                )}
                {canal.tipo === 'evolution_api' && (
                  <div className="space-y-2">
                    <Label>Nome da instância</Label>
                    <Input value={canal.instancia} onChange={e => setCanal(p => ({ ...p, instancia: e.target.value }))} placeholder="Ex: instancia-01" />
                  </div>
                )}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
                  <Button onClick={saveStep2} disabled={loading} className="flex-1">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Continuar <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
                <button type="button" onClick={() => setStep(3)} className="w-full text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
                  Pular por agora
                </button>
              </div>
            )}

            {/* Step 3: Primeiro colaborador */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <CardTitle className="flex items-center gap-2 mb-1"><Users className="h-5 w-5 text-primary" />Primeiro atendente</CardTitle>
                  <p className="text-sm text-muted-foreground">Crie o primeiro colaborador da sua equipe</p>
                </div>
                <div className="space-y-2"><Label>Nome</Label><Input value={colab.nome} onChange={e => setColab(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Maria Santos" /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={colab.email} onChange={e => setColab(p => ({ ...p, email: e.target.value }))} placeholder="maria@empresa.com" /></div>
                <div className="space-y-2"><Label>Senha provisória</Label><Input type="password" value={colab.senha} onChange={e => setColab(p => ({ ...p, senha: e.target.value }))} placeholder="Mínimo 6 caracteres" /></div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(2)} className="flex-1"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
                  <Button onClick={saveStep3} disabled={loading} className="flex-1">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Continuar <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
                <button type="button" onClick={() => setStep(4)} className="w-full text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
                  Pular por agora
                </button>
              </div>
            )}

            {/* Step 4: Horários e pausas */}
            {step === 4 && (
              <div className="space-y-5">
                <div>
                  <CardTitle className="flex items-center gap-2 mb-1"><Clock className="h-5 w-5 text-primary" />Horários de atendimento</CardTitle>
                  <p className="text-sm text-muted-foreground">Defina quando sua empresa atende</p>
                </div>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {horarios.map((h, i) => (
                    <div key={h.dia_semana} className="flex items-center gap-3 p-2 rounded-lg border">
                      <Switch checked={h.ativo} onCheckedChange={v => setHorarios(prev => prev.map((x, j) => j === i ? { ...x, ativo: v } : x))} />
                      <span className="text-sm w-32 shrink-0">{DIAS_SEMANA.find(d => d.value === h.dia_semana)?.label}</span>
                      {h.ativo ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Input type="time" value={h.hora_inicio} onChange={e => setHorarios(prev => prev.map((x, j) => j === i ? { ...x, hora_inicio: e.target.value } : x))} className="h-7 w-24 text-xs" />
                          <span className="text-muted-foreground">–</span>
                          <Input type="time" value={h.hora_fim} onChange={e => setHorarios(prev => prev.map((x, j) => j === i ? { ...x, hora_fim: e.target.value } : x))} className="h-7 w-24 text-xs" />
                        </div>
                      ) : <span className="text-xs text-muted-foreground">Fechado</span>}
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Coffee className="h-4 w-4 text-muted-foreground" />
                    <Label>Tipos de pausa</Label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {pausasPadrao.map((p, i) => (
                      <Badge
                        key={p.nome}
                        variant={p.selecionado ? 'default' : 'outline'}
                        className="cursor-pointer select-none"
                        onClick={() => setPausasPadrao(prev => prev.map((x, j) => j === i ? { ...x, selecionado: !x.selecionado } : x))}
                      >
                        {p.nome}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(3)} className="flex-1"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
                  <Button onClick={saveStep4} disabled={loading} className="flex-1">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Continuar <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 5: Concluído */}
            {step === 5 && (
              <div className="space-y-5 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-xl mb-2">Tudo pronto!</CardTitle>
                  <p className="text-muted-foreground text-sm">Sua empresa está configurada e pronta para receber atendimentos.</p>
                </div>
                <div className="rounded-xl border bg-muted/30 p-4 text-sm text-left space-y-2">
                  <p className="font-medium">O que foi configurado:</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>✓ Dados da empresa</li>
                    <li>✓ Canal de atendimento</li>
                    <li>✓ Primeiro colaborador</li>
                    <li>✓ Horários e pausas</li>
                  </ul>
                </div>
                <Button onClick={completarOnboarding} disabled={loading} className="w-full" size="lg">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Ir para o Dashboard
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
