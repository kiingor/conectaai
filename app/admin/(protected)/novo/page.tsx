'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Shield, ArrowLeft, Loader2, Copy, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

export default function NovaOrganizacaoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ slug: string; admin_email: string; senha: string; login_url: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const [form, setForm] = useState({
    slug: '',
    nome: '',
    plano: 'basic',
    admin_email: '',
    admin_nome: '',
  })

  const handleSlugChange = (v: string) => {
    setForm(prev => ({ ...prev, slug: v.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-') }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
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
      setResult({
        slug: data.organizacao.slug,
        admin_email: data.admin.email,
        senha: data.admin.senha_temporaria,
        login_url: data.login_url,
      })
      toast.success('Organização criada com sucesso!')
    } catch {
      toast.error('Erro ao criar organização')
    } finally {
      setLoading(false)
    }
  }

  const copyCredentials = () => {
    if (!result) return
    navigator.clipboard.writeText(`URL: ${result.login_url}\nEmail: ${result.admin_email}\nSenha: ${result.senha}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <header className="border-b border-white/10 px-6 py-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/admin')} className="text-white/60 hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-semibold">Nova Organização</span>
        </div>
      </header>

      <div className="p-6 max-w-lg mx-auto">
        {result ? (
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
                Organização criada!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-2 font-mono text-sm">
                <p><span className="text-white/50">URL:</span> <span className="text-white">{result.login_url}</span></p>
                <p><span className="text-white/50">Email:</span> <span className="text-white">{result.admin_email}</span></p>
                <p><span className="text-white/50">Senha:</span> <span className="text-emerald-300">{result.senha}</span></p>
              </div>
              <p className="text-xs text-white/40">Compartilhe essas credenciais com o admin da empresa. A senha deve ser trocada no primeiro acesso.</p>
              <div className="flex gap-2">
                <Button onClick={copyCredentials} variant="outline" className="border-white/10 text-white hover:bg-white/5 flex-1">
                  {copied ? <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-400" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copied ? 'Copiado!' : 'Copiar credenciais'}
                </Button>
                <Button onClick={() => router.push('/admin')} className="flex-1">
                  Voltar ao painel
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Dados da nova organização</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white/70">Nome da empresa</Label>
                  <Input
                    placeholder="Ex: Softcom Tecnologia"
                    value={form.nome}
                    onChange={e => setForm(prev => ({ ...prev, nome: e.target.value }))}
                    required
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70">Slug (subdomínio)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="softcom"
                      value={form.slug}
                      onChange={e => handleSlugChange(e.target.value)}
                      required
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>
                  {form.slug && (
                    <p className="text-xs text-white/40">Acesso: <span className="text-primary">{process.env.NEXT_PUBLIC_APP_URL || 'https://multihub-one.vercel.app'}/login?org={form.slug}</span></p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70">Plano</Label>
                  <Select value={form.plano} onValueChange={v => setForm(prev => ({ ...prev, plano: v }))}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="border-t border-white/10 pt-4 space-y-4">
                  <p className="text-sm font-medium text-white/70">Admin da empresa</p>
                  <div className="space-y-2">
                    <Label className="text-white/70">Nome do admin</Label>
                    <Input
                      placeholder="Ex: João Silva"
                      value={form.admin_nome}
                      onChange={e => setForm(prev => ({ ...prev, admin_nome: e.target.value }))}
                      required
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/70">Email do admin</Label>
                    <Input
                      type="email"
                      placeholder="admin@empresa.com"
                      value={form.admin_email}
                      onChange={e => setForm(prev => ({ ...prev, admin_email: e.target.value }))}
                      required
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Criar organização
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
