'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Brain, Eye, EyeOff, Loader2, Save, Sparkles } from 'lucide-react'

interface IaConfig {
  google_ai_api_key: string
  google_ai_modelo: string
  openai_api_key: string
}

export default function IaConfigPage() {
  const [config, setConfig] = useState<IaConfig>({
    google_ai_api_key: '',
    google_ai_modelo: 'text-embedding-004',
    openai_api_key: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showGoogleKey, setShowGoogleKey] = useState(false)
  const [showOpenAiKey, setShowOpenAiKey] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/organizacao/ia-config')
      if (!res.ok) throw new Error('Falha ao carregar')
      const data = await res.json()
      setConfig({
        google_ai_api_key: data.google_ai_api_key || '',
        google_ai_modelo: data.google_ai_modelo || 'text-embedding-004',
        openai_api_key: data.openai_api_key || '',
      })
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar configuracao')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/organizacao/ia-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
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
          Chaves de API usadas pela organizacao para embeddings (RAG) e geracao de resposta.
        </p>
      </div>

      {/* Google AI */}
      <Card className="glass-panel border-foreground/8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            Google AI (Gemini)
          </CardTitle>
          <CardDescription>
            Usada para gerar embeddings da base de conhecimento (RAG) dos setores desta organizacao.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="google-key" className="text-xs text-foreground/60">API Key</Label>
            <div className="relative">
              <Input
                id="google-key"
                type={showGoogleKey ? 'text' : 'password'}
                value={config.google_ai_api_key}
                onChange={(e) => setConfig((c) => ({ ...c, google_ai_api_key: e.target.value }))}
                placeholder="AIza..."
                className="glass-input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowGoogleKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showGoogleKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="google-modelo" className="text-xs text-foreground/60">Modelo de embedding</Label>
            <Select
              value={config.google_ai_modelo}
              onValueChange={(v) => setConfig((c) => ({ ...c, google_ai_modelo: v }))}
            >
              <SelectTrigger id="google-modelo" className="glass-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text-embedding-004">text-embedding-004 (768 dim)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* OpenAI */}
      <Card className="glass-panel border-foreground/8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-blue-400" />
            OpenAI
          </CardTitle>
          <CardDescription>
            Chave usada pelos agentes (n8n / retaguarda) para chamadas a modelos OpenAI.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label htmlFor="openai-key" className="text-xs text-foreground/60">API Key</Label>
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
