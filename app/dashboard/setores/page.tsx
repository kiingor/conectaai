'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useColaborador } from '@/lib/hooks/use-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Building2, Plus, Pencil, Loader2, AlertCircle } from 'lucide-react'

interface Setor {
  id: string
  nome: string
  descricao: string | null
  template_id: string | null
  phone_number_id: string | null
  created_at: string
}

export default function SetoresPage() {
  const [setores, setSetores] = useState<Setor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSetor, setEditingSetor] = useState<Setor | null>(null)
  const [formData, setFormData] = useState({ nome: '', descricao: '', template_id: '', phone_number_id: '' })
  const [saving, setSaving] = useState(false)

  const { data: colaborador } = useColaborador()
  const supabase = createClient()

  async function fetchSetores() {
    if (!colaborador?.organizacao_id) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('setores')
        .select('*')
        .eq('organizacao_id', colaborador.organizacao_id)
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('[v0] Error fetching setores:', fetchError)
        setError(fetchError.message)
        return
      }

      setSetores(data || [])
    } catch (err: any) {
      console.error('[v0] Exception fetching setores:', err)
      setError(err.message || 'Erro ao carregar setores')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSetores()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colaborador?.organizacao_id])

  function openCreateModal() {
    setEditingSetor(null)
    setFormData({ nome: '', descricao: '', template_id: '', phone_number_id: '' })
    setModalOpen(true)
  }

  function openEditModal(setor: Setor) {
    setEditingSetor(setor)
    setFormData({ nome: setor.nome, descricao: setor.descricao || '', template_id: setor.template_id || '', phone_number_id: setor.phone_number_id || '' })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!formData.nome.trim()) return

    setSaving(true)

    const payload = {
      nome: formData.nome.trim(),
      descricao: formData.descricao.trim() || null,
      template_id: formData.template_id.trim() || null,
      phone_number_id: formData.phone_number_id.trim() || null,
    }

    if (editingSetor) {
      const { error } = await supabase
        .from('setores')
        .update(payload)
        .eq('id', editingSetor.id)

      if (!error) {
        setModalOpen(false)
        fetchSetores()
      }
    } else {
      const { error } = await supabase.from('setores').insert({ ...payload, organizacao_id: colaborador?.organizacao_id })

      if (!error) {
        setModalOpen(false)
        fetchSetores()
      }
    }

    setSaving(false)
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center border border-white/10">
          <Building2 className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">
            Setores
          </h1>
          <p className="text-sm text-white/40">
            Gerencie os setores da sua empresa para organizar os atendimentos.
          </p>
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/6">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">Lista de Setores</h2>
          </div>
        </div>
        <div className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-red-500/10 p-4">
                <AlertCircle className="h-8 w-8 text-red-400" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">
                Erro ao carregar setores
              </h3>
              <p className="mt-1 text-sm text-white/40">
                {error}
              </p>
              <Button onClick={fetchSetores} variant="outline" className="mt-4 border-white/10 text-white/60 hover:bg-white/5">
                Tentar novamente
              </Button>
            </div>
          ) : setores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-emerald-500/10 p-4">
                <Building2 className="h-8 w-8 text-emerald-400" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">
                Nenhum setor cadastrado
              </h3>
              <p className="mt-1 text-sm text-white/40">
                Comece criando o primeiro setor da sua empresa
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/6 hover:bg-transparent">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Nome</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Descricao</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Template ID</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Phone Number ID</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Criado em</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-white/40">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                  {setores.map((setor) => (
                    <TableRow key={setor.id} className="border-white/6 hover:bg-white/[0.03] transition-colors">
                      <TableCell className="font-medium text-white/90">{setor.nome}</TableCell>
                      <TableCell className="text-white/50 max-w-[200px] truncate">
                        {setor.descricao || '-'}
                      </TableCell>
                      <TableCell className="text-white/40 text-xs font-mono">
                        {setor.template_id || <span className="text-white/20">Nao configurado</span>}
                      </TableCell>
                      <TableCell className="text-white/40 text-xs font-mono">
                        {setor.phone_number_id || <span className="text-white/20">Nao configurado</span>}
                      </TableCell>
                      <TableCell className="text-white/40">
                        {formatDate(setor.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(setor)}
                          className="text-white/40 hover:text-white hover:bg-white/5"
                        >
                          <Pencil className="mr-1 h-4 w-4" />
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Floating Action Button */}
      <div className="fixed right-6 bottom-6">
        <Button
          onClick={openCreateModal}
          size="lg"
          className="h-14 w-14 rounded-full bg-primary text-primary-foreground glass-fab"
        >
          <Plus className="h-6 w-6" />
          <span className="sr-only">Novo Setor</span>
        </Button>
      </div>

      {/* Modal for Create/Edit */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#0e1019] border border-white/8 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Building2 className="h-5 w-5 text-emerald-400" />
              {editingSetor ? 'Editar Setor' : 'Novo Setor'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nome" className="text-foreground">
                Nome do Setor *
              </Label>
              <Input
                id="nome"
                placeholder="Ex: Suporte, Comercial, Ouvidoria..."
                value={formData.nome}
                onChange={(e) =>
                  setFormData({ ...formData, nome: e.target.value })
                }
                className="glass-input rounded-xl text-white/80 placeholder:text-white/25"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="descricao" className="text-foreground">
                Descricao
              </Label>
              <Textarea
                id="descricao"
                placeholder="Descreva as responsabilidades deste setor..."
                value={formData.descricao}
                onChange={(e) =>
                  setFormData({ ...formData, descricao: e.target.value })
                }
                className="min-h-24 resize-none glass-input rounded-xl text-white/80 placeholder:text-white/25"
              />
            </div>

            <div className="border-t border-border pt-4 mt-2">
              <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Configuracoes WhatsApp (Disparo)</p>
              
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="template_id" className="text-foreground">
                    Template ID
                  </Label>
                  <Input
                    id="template_id"
                    placeholder="Ex: atendimento_inicio"
                    value={formData.template_id}
                    onChange={(e) =>
                      setFormData({ ...formData, template_id: e.target.value })
                    }
                    className="glass-input rounded-xl text-white/80 placeholder:text-white/25"
                  />
                  <p className="text-[10px] text-muted-foreground">ID do template aprovado na Meta para disparo de mensagens</p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="phone_number_id" className="text-foreground">
                    Phone Number ID
                  </Label>
                  <Input
                    id="phone_number_id"
                    placeholder="Ex: 123456789012345"
                    value={formData.phone_number_id}
                    onChange={(e) =>
                      setFormData({ ...formData, phone_number_id: e.target.value })
                    }
                    className="glass-input rounded-xl text-white/80 placeholder:text-white/25"
                  />
                  <p className="text-[10px] text-muted-foreground">ID do numero de telefone da API do WhatsApp Business</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              className="border-white/10 text-white/60 hover:bg-white/5"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formData.nome.trim()}
              className="btn-glow rounded-xl"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingSetor ? 'Atualizar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
