'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Building2, Globe, Users, Clock, CheckCircle2,
  ArrowRight, ArrowLeft, Loader2, Smartphone, Wifi,
  Coffee, MessageCircle
} from 'lucide-react'
import { toast } from 'sonner'

const STEPS = [
  { id: 1, label: 'Empresa', icon: Building2 },
  { id: 2, label: 'Canal', icon: Globe },
  { id: 3, label: 'Colaborador', icon: Users },
  { id: 4, label: 'Horarios', icon: Clock },
  { id: 5, label: 'Concluido', icon: CheckCircle2 },
]

const DIAS_SEMANA = [
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terca-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sabado' },
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

  // Step 4 — Horarios e pausas
  const [horarios, setHorarios] = useState(
    DIAS_SEMANA.map(d => ({
      dia_semana: d.value,
      ativo: d.value >= 1 && d.value <= 5,
      hora_inicio: '08:00',
      hora_fim: '18:00',
    }))
  )
  const [pausasPadrao, setPausasPadrao] = useState([
    { nome: 'Almoco', selecionado: true },
    { nome: 'Banheiro', selecionado: true },
    { nome: 'Reuniao', selecionado: true },
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
      // Salvar horarios
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
      toast.error('Erro ao salvar horarios')
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
    <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl brand-gradient shadow-lg shadow-emerald-500/20">
            <MessageCircle className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Bem-vindo ao <span className="brand-gradient-text">ConectaAI</span></h1>
          <p className="text-white/50 text-sm">Configure sua empresa em poucos passos</p>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full brand-gradient transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step Indicator */}
        <div className="flex justify-between items-center">
          {STEPS.map((s, idx) => (
            <div key={s.id} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div className={`relative flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                  step > s.id
                    ? 'brand-gradient text-white shadow-lg shadow-emerald-500/25'
                    : step === s.id
                      ? 'gradient-border bg-white/5 text-white shadow-lg shadow-emerald-500/15'
                      : 'bg-white/5 text-white/30 border border-white/10'
                }`}>
                  {step > s.id ? <CheckCircle2 className="h-5 w-5" /> : s.id}
                </div>
                <span className={`text-[10px] hidden sm:block transition-colors ${
                  step >= s.id ? 'text-white/70' : 'text-white/30'
                }`}>{s.label}</span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`hidden sm:block w-12 lg:w-20 h-px mx-2 transition-colors duration-300 ${
                  step > s.id ? 'bg-gradient-to-r from-emerald-500 to-cyan-500' : 'bg-white/10'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content Card */}
        <div className="glass-card rounded-2xl p-8">

          {/* Step 1: Dados da empresa */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                  <Building2 className="h-5 w-5 text-emerald-400" />
                  Dados da empresa
                </h2>
                <p className="text-sm text-white/40 mt-1">Personalize as informacoes da sua empresa</p>
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Nome da empresa</Label>
                <Input
                  value={empresa.nome}
                  onChange={e => setEmpresa(p => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: Softcom Tecnologia"
                  className="glass-input h-11 rounded-xl text-white placeholder:text-white/25 border-white/10 focus:border-emerald-500/40"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">URL do logo (opcional)</Label>
                <div className="glass-input rounded-xl border-dashed border-2 border-white/10 bg-white/[0.02] p-6 text-center hover:border-emerald-500/30 transition-colors">
                  <Input
                    value={empresa.logo_url}
                    onChange={e => setEmpresa(p => ({ ...p, logo_url: e.target.value }))}
                    placeholder="https://..."
                    className="bg-transparent border-0 text-center text-white placeholder:text-white/25 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <p className="text-[11px] text-white/30 mt-2">Cole a URL da imagem do logo</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Cor primaria</Label>
                <div className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.03] border border-white/8">
                  <input
                    type="color"
                    value={empresa.cor_primaria}
                    onChange={e => setEmpresa(p => ({ ...p, cor_primaria: e.target.value }))}
                    className="h-10 w-16 rounded-lg cursor-pointer border-0 bg-transparent"
                  />
                  <span className="text-sm font-mono text-white/50">{empresa.cor_primaria}</span>
                </div>
              </div>
              <button
                onClick={saveStep1}
                disabled={loading || !empresa.nome}
                className="btn-glow w-full h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Continuar <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Step 2: Canal */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                  <Globe className="h-5 w-5 text-emerald-400" />
                  Canal de atendimento
                </h2>
                <p className="text-sm text-white/40 mt-1">Configure como voce recebe e responde mensagens</p>
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Tipo de canal</Label>
                <div className="grid grid-cols-2 gap-3">
                  {(['whatsapp', 'evolution_api'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setCanal(p => ({ ...p, tipo: t }))}
                      className={`relative flex flex-col items-center gap-3 rounded-xl p-5 transition-all duration-200 ${
                        canal.tipo === t
                          ? 'gradient-border bg-white/[0.06] shadow-lg shadow-emerald-500/10'
                          : 'bg-white/[0.03] border border-white/8 hover:bg-white/[0.05] hover:border-white/15'
                      }`}
                    >
                      {t === 'whatsapp' ? <Smartphone className="h-7 w-7 text-emerald-400" /> : <Wifi className="h-7 w-7 text-cyan-400" />}
                      <span className="text-sm font-medium text-white/80">{t === 'whatsapp' ? 'WhatsApp Oficial' : 'EvolutionAPI'}</span>
                    </button>
                  ))}
                </div>
              </div>
              {canal.tipo === 'whatsapp' && (
                <>
                  <div className="space-y-2">
                    <Label className="text-white/70">Phone Number ID</Label>
                    <Input
                      value={canal.phone_number_id}
                      onChange={e => setCanal(p => ({ ...p, phone_number_id: e.target.value }))}
                      placeholder="123456789012345"
                      className="glass-input h-11 rounded-xl text-white placeholder:text-white/25 border-white/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/70">Access Token</Label>
                    <Input
                      type="password"
                      value={canal.whatsapp_token}
                      onChange={e => setCanal(p => ({ ...p, whatsapp_token: e.target.value }))}
                      placeholder="EAAxxxxx..."
                      className="glass-input h-11 rounded-xl text-white placeholder:text-white/25 border-white/10"
                    />
                  </div>
                </>
              )}
              {canal.tipo === 'evolution_api' && (
                <div className="space-y-2">
                  <Label className="text-white/70">Nome da instancia</Label>
                  <Input
                    value={canal.instancia}
                    onChange={e => setCanal(p => ({ ...p, instancia: e.target.value }))}
                    placeholder="Ex: instancia-01"
                    className="glass-input h-11 rounded-xl text-white placeholder:text-white/25 border-white/10"
                  />
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-white/70 bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-white/20 transition-all"
                >
                  <ArrowLeft className="h-4 w-4" />Voltar
                </button>
                <button
                  onClick={saveStep2}
                  disabled={loading}
                  className="btn-glow flex-1 h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-40"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Continuar <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              <button type="button" onClick={() => setStep(3)} className="w-full text-xs text-white/30 hover:text-white/60 underline-offset-2 hover:underline transition-colors">
                Pular por agora
              </button>
            </div>
          )}

          {/* Step 3: Primeiro colaborador */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                  <Users className="h-5 w-5 text-emerald-400" />
                  Primeiro atendente
                </h2>
                <p className="text-sm text-white/40 mt-1">Crie o primeiro colaborador da sua equipe</p>
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Nome</Label>
                <Input value={colab.nome} onChange={e => setColab(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Maria Santos" className="glass-input h-11 rounded-xl text-white placeholder:text-white/25 border-white/10" />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Email</Label>
                <Input type="email" value={colab.email} onChange={e => setColab(p => ({ ...p, email: e.target.value }))} placeholder="maria@empresa.com" className="glass-input h-11 rounded-xl text-white placeholder:text-white/25 border-white/10" />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Senha provisoria</Label>
                <Input type="password" value={colab.senha} onChange={e => setColab(p => ({ ...p, senha: e.target.value }))} placeholder="Minimo 6 caracteres" className="glass-input h-11 rounded-xl text-white placeholder:text-white/25 border-white/10" />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-white/70 bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-white/20 transition-all"
                >
                  <ArrowLeft className="h-4 w-4" />Voltar
                </button>
                <button
                  onClick={saveStep3}
                  disabled={loading}
                  className="btn-glow flex-1 h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-40"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Continuar <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              <button type="button" onClick={() => setStep(4)} className="w-full text-xs text-white/30 hover:text-white/60 underline-offset-2 hover:underline transition-colors">
                Pular por agora
              </button>
            </div>
          )}

          {/* Step 4: Horarios e pausas */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                  <Clock className="h-5 w-5 text-emerald-400" />
                  Horarios de atendimento
                </h2>
                <p className="text-sm text-white/40 mt-1">Defina quando sua empresa atende</p>
              </div>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {horarios.map((h, i) => (
                  <div key={h.dia_semana} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/8 hover:border-white/12 transition-colors">
                    <Switch checked={h.ativo} onCheckedChange={v => setHorarios(prev => prev.map((x, j) => j === i ? { ...x, ativo: v } : x))} />
                    <span className="text-sm w-32 shrink-0 text-white/70">{DIAS_SEMANA.find(d => d.value === h.dia_semana)?.label}</span>
                    {h.ativo ? (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Input type="time" value={h.hora_inicio} onChange={e => setHorarios(prev => prev.map((x, j) => j === i ? { ...x, hora_inicio: e.target.value } : x))} className="glass-input h-8 w-24 text-xs rounded-lg text-white border-white/10" />
                        <span className="text-white/30">-</span>
                        <Input type="time" value={h.hora_fim} onChange={e => setHorarios(prev => prev.map((x, j) => j === i ? { ...x, hora_fim: e.target.value } : x))} className="glass-input h-8 w-24 text-xs rounded-lg text-white border-white/10" />
                      </div>
                    ) : <span className="text-xs text-white/30">Fechado</span>}
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Coffee className="h-4 w-4 text-white/40" />
                  <Label className="text-white/70">Tipos de pausa</Label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {pausasPadrao.map((p, i) => (
                    <button
                      key={p.nome}
                      onClick={() => setPausasPadrao(prev => prev.map((x, j) => j === i ? { ...x, selecionado: !x.selecionado } : x))}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer select-none ${
                        p.selecionado
                          ? 'brand-gradient text-white shadow-sm shadow-emerald-500/20'
                          : 'bg-white/[0.04] text-white/50 border border-white/10 hover:bg-white/[0.08] hover:text-white/70'
                      }`}
                    >
                      {p.nome}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-white/70 bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-white/20 transition-all"
                >
                  <ArrowLeft className="h-4 w-4" />Voltar
                </button>
                <button
                  onClick={saveStep4}
                  disabled={loading}
                  className="btn-glow flex-1 h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-40"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Continuar <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Concluido */}
          {step === 5 && (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full brand-gradient shadow-xl shadow-emerald-500/25">
                <CheckCircle2 className="h-10 w-10 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-2">Tudo pronto!</h2>
                <p className="text-white/40 text-sm">Sua empresa esta configurada e pronta para receber atendimentos.</p>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/8 p-5 text-sm text-left space-y-3">
                <p className="font-medium text-white/80">O que foi configurado:</p>
                <ul className="space-y-2 text-white/50">
                  <li className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full brand-gradient"><CheckCircle2 className="h-3 w-3 text-white" /></span>
                    Dados da empresa
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full brand-gradient"><CheckCircle2 className="h-3 w-3 text-white" /></span>
                    Canal de atendimento
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full brand-gradient"><CheckCircle2 className="h-3 w-3 text-white" /></span>
                    Primeiro colaborador
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full brand-gradient"><CheckCircle2 className="h-3 w-3 text-white" /></span>
                    Horarios e pausas
                  </li>
                </ul>
              </div>
              <button
                onClick={completarOnboarding}
                disabled={loading}
                className="btn-glow w-full h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-40"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Ir para o Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
