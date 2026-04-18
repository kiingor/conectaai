'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Brain, Eye, EyeOff, Loader2, Save, Sparkles } from 'lucide-react'
import { useColaborador } from '@/lib/hooks/use-data'

interface IaConfig {
  openai_api_key: string
  embedding_modelo: string
}

export default function IaConfigPage() {
  const { data: colaborador } = useColaborador()
  const [config, setConfig] = useState<IaConfig>({
    openai_api_key: '',
    embedding_modelo: 'text-embedding-3-small',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showOpenAiKey, setShowOpenAiKey] = useState(false)

  const orgId = colaborador?.organizacao_id

  const load = async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const res = await fetch('/api/organizacao/ia-config', {
        headers: { 'x-org-id': orgId },
      })
      if (!res.ok) throw new Error('Falha ao carregar')
      const data = await res.json()
      setConfig({
        openai_api_key: data.openai_api_key || '',
        embedding_modelo: data.google_ai_modelo || 'text-embedding-3-small',
      })
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar configuracao')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (orgId) load()
  }, [orgId])

  const save = async () => {
    if (!orgId) return
    setSaving(true)
    try {
      const res = await fetch('/api/organizacao/ia-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-org-id': orgId },
        body: JSON.stringify({
          openai_api_key: config.openai_api_key,
          google_ai_modelo: config.embedding_modelo,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Falha ao salvar')
      }
      toast.success('Configuracao salva')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold brand-gradient-text">
          <Brain className="h-6 w-6 text-emerald-400" />
          Configuracoes de IA
        </h1>
        <p className="text-sm text-muted-foreground/80 mt-1">
          Chave do OpenAI usada pelo agente de IA para responder mensagens e consultar a base de conhecimento.
        </p>
      </div>

      {/* OpenAI */}
      <Card className="glass-panel border-foreground/8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-blue-400" />
            OpenAI
          </CardTitle>
          <CardDescription>
            Obrigatoria para o agente responder automaticamente no WhatsApp e para treinar a base de conhecimento dos setores. A chave comeca com &quot;sk-&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="openai-key" className="text-xs text-foreground/60">Chave do OpenAI</Label>
            <div className="relative">
              <Input
                id="openai-key"
                type={showOpenAiKey ? 'text' : 'password'}
                value={config.openai_api_key}
                onChange={(e) => setConfig((c) => ({ ...c, openai_api_key: e.target.value }))}
                placeholder="sk-..."
                className="glass-input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowOpenAiKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showOpenAiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="embedding-modelo" className="text-xs text-foreground/60">Modelo usado na base de conhecimento</Label>
            <Select
              value={config.embedding_modelo}
              onValueChange={(v) => setConfig((c) => ({ ...c, embedding_modelo: v }))}
            >
              <SelectTrigger id="embedding-modelo" className="glass-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text-embedding-3-small">text-embedding-3-small (768 dim, recomendado)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="btn-glow gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </div>
    </div>
  )
}
