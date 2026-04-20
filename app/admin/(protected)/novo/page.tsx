'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, ArrowLeft, Loader2, Copy, CheckCircle2, Building2, User, Mail, CreditCard } from 'lucide-react'
import { toast } from 'sonner'

export default function NovaOrganizacaoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ slug: string; admin_email: string; senha: string; login_url: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const [form, setForm] = useState({
    nome: '',
    plano: 'basic',
    admin_email: '',
    admin_nome: '',
  })

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
    <div className="min-h-screen">
      {/* Header */}
      <header className="glass-header sticky top-0 z-30 px-6 py-4 flex items-center gap-3">
        <button
          onClick={() => router.push('/admin')}
          className="flex items-center justify-center h-9 w-9 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-all"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl brand-gradient shadow-lg shadow-emerald-500/20">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="font-semibold brand-gradient-text">Nova Organização</h1>
            <p className="text-xs text-white/30">Cadastrar nova empresa na plataforma</p>
          </div>
        </div>
      </header>

      <div className="p-6 max-w-lg mx-auto">
        {result ? (
          /* ---- Result card ---- */
          <div className="glass-card-elevated rounded-2xl overflow-hidden">
            {/* Success banner */}
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
              {/* Credentials block */}
              <div className="rounded-xl bg-black/30 border border-white/8 p-4 space-y-3 font-mono text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-white/40 shrink-0 w-14">URL:</span>
                  <span className="text-emerald-400 break-all">{result.login_url}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/40 shrink-0 w-14">Email:</span>
                  <span className="text-white">{result.admin_email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/40 shrink-0 w-14">Senha:</span>
                  <span className="text-cyan-300 font-semibold">{result.senha}</span>
                </div>
              </div>

              <p className="text-xs text-white/30 leading-relaxed">
                Compartilhe essas credenciais com o admin da empresa. A senha deve ser trocada no primeiro acesso.
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
                  onClick={() => router.push('/admin')}
                  className="flex-1 btn-glow px-4 py-2.5 rounded-xl text-sm"
                >
                  Voltar ao painel
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ---- Form card ---- */
          <div className="glass-card-elevated rounded-2xl overflow-hidden">
            {/* Form header */}
            <div className="px-6 pt-6 pb-4 border-b border-white/6">
              <h2 className="font-semibold text-white text-lg">Dados da nova organização</h2>
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
                  <span className="bg-[#06080f] px-3 text-xs text-white/30 font-medium">Admin da empresa</span>
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

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="btn-glow w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Criar organização
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
