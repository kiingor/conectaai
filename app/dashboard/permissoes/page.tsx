'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Shield, Plus, Pencil, Trash2, Loader2, Check, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useColaborador } from '@/lib/hooks/use-data'

interface Permissao {
  id: string
  nome: string
  can_view_dashboard: boolean
  can_manage_users: boolean
  can_view_all_tickets: boolean
  created_at: string
  _count?: number
}

export default function PermissoesPage() {
  const [permissoes, setPermissoes] = useState<Permissao[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingPermissao, setEditingPermissao] = useState<Permissao | null>(null)
  const [deletingPermissao, setDeletingPermissao] = useState<Permissao | null>(null)
  const [formData, setFormData] = useState({
    nome: '',
    can_view_dashboard: false,
    can_manage_users: false,
    can_view_all_tickets: false,
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const supabase = createClient()
  const { data: colaborador } = useColaborador()

  async function fetchPermissoes() {
    if (!colaborador?.organizacao_id) return

    setLoading(true)

    // Fetch permissoes
    const { data: permissoesData, error: permissoesError } = await supabase
      .from('permissoes')
      .select('*')
      .eq('organizacao_id', colaborador.organizacao_id)
      .order('created_at', { ascending: false })

    if (permissoesError || !permissoesData) {
      setLoading(false)
      return
    }

    // Count collaborators per permission
    const { data: countData } = await supabase
      .from('colaboradores')
      .select('permissao_id')
      .eq('organizacao_id', colaborador.organizacao_id)

    const countMap: Record<string, number> = {}
    if (countData) {
      for (const colab of countData) {
        if (colab.permissao_id) {
          countMap[colab.permissao_id] = (countMap[colab.permissao_id] || 0) + 1
        }
      }
    }

    const permissoesWithCount = permissoesData.map((p) => ({
      ...p,
      _count: countMap[p.id] || 0,
    }))

    setPermissoes(permissoesWithCount)
    setLoading(false)
  }

  useEffect(() => {
    fetchPermissoes()
  }, [colaborador?.organizacao_id])

  function openCreateModal() {
    setEditingPermissao(null)
    setFormData({
      nome: '',
      can_view_dashboard: false,
      can_manage_users: false,
      can_view_all_tickets: false,
    })
    setModalOpen(true)
  }

  function openEditModal(permissao: Permissao) {
    setEditingPermissao(permissao)
    setFormData({
      nome: permissao.nome,
      can_view_dashboard: permissao.can_view_dashboard,
      can_manage_users: permissao.can_manage_users,
      can_view_all_tickets: permissao.can_view_all_tickets,
    })
    setModalOpen(true)
  }

  function openDeleteDialog(permissao: Permissao) {
    setDeletingPermissao(permissao)
    setDeleteDialogOpen(true)
  }

  async function handleSave() {
    if (!formData.nome.trim()) return

    setSaving(true)

    if (editingPermissao) {
      const { error } = await supabase
        .from('permissoes')
        .update({
          nome: formData.nome.trim(),
          can_view_dashboard: formData.can_view_dashboard,
          can_manage_users: formData.can_manage_users,
          can_view_all_tickets: formData.can_view_all_tickets,
        })
        .eq('id', editingPermissao.id)

      if (!error) {
        setModalOpen(false)
        fetchPermissoes()
      }
    } else {
      const { error } = await supabase.from('permissoes').insert({
        nome: formData.nome.trim(),
        can_view_dashboard: formData.can_view_dashboard,
        can_manage_users: formData.can_manage_users,
        can_view_all_tickets: formData.can_view_all_tickets,
        organizacao_id: colaborador?.organizacao_id,
      })

      if (!error) {
        setModalOpen(false)
        fetchPermissoes()
      }
    }

    setSaving(false)
  }

  async function handleDelete() {
    if (!deletingPermissao) return

    setDeleting(true)

    const { error } = await supabase
      .from('permissoes')
      .delete()
      .eq('id', deletingPermissao.id)

    if (!error) {
      setDeleteDialogOpen(false)
      setDeletingPermissao(null)
      fetchPermissoes()
    }

    setDeleting(false)
  }

  function FlagBadge({ value, label }: { value: boolean; label: string }) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium glass-badge ${
          value
            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
            : 'bg-white/5 text-white/30 border-white/10'
        }`}
      >
        {value ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
        {label}
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center border border-white/10">
          <Shield className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">
            Permissoes
          </h1>
          <p className="text-sm text-white/40">
            Gerencie os tipos de permissao e controle o acesso dos colaboradores.
          </p>
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/6">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">Lista de Permissoes</h2>
          </div>
        </div>
        <div className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            </div>
          ) : permissoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-emerald-500/10 p-4">
                <Shield className="h-8 w-8 text-emerald-400" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">
                Nenhuma permissao cadastrada
              </h3>
              <p className="mt-1 text-sm text-white/40">
                Comece criando o primeiro tipo de permissao
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/6 hover:bg-transparent">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Nome</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Capacidades</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Colaboradores</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-white/40">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence>
                  {permissoes.map((permissao, index) => (
                    <motion.tr
                      key={permissao.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b border-white/6 transition-colors hover:bg-white/[0.03]"
                    >
                      <TableCell className="font-medium text-white/90">
                        {permissao.nome}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <FlagBadge
                            value={permissao.can_view_dashboard}
                            label="Dashboard"
                          />
                          <FlagBadge
                            value={permissao.can_manage_users}
                            label="Usuarios"
                          />
                          <FlagBadge
                            value={permissao.can_view_all_tickets}
                            label="Todos Tickets"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-white/50">
                        {permissao._count || 0} colaborador
                        {permissao._count !== 1 ? 'es' : ''}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(permissao)}
                            className="text-white/40 hover:text-white hover:bg-white/5"
                          >
                            <Pencil className="mr-1 h-4 w-4" />
                            Editar
                          </Button>
                          {(permissao._count || 0) === 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDeleteDialog(permissao)}
                              className="text-red-400/60 hover:bg-red-500/10 hover:text-red-400"
                            >
                              <Trash2 className="mr-1 h-4 w-4" />
                              Excluir
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Floating Action Button */}
      <motion.div
        className="fixed right-6 bottom-6"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Button
          onClick={openCreateModal}
          size="lg"
          className="h-14 w-14 rounded-full bg-primary text-primary-foreground glass-fab"
        >
          <Plus className="h-6 w-6" />
          <span className="sr-only">Nova Permissao</span>
        </Button>
      </motion.div>

      {/* Modal for Create/Edit */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#0e1019] border border-white/8 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Shield className="h-5 w-5 text-emerald-400" />
              {editingPermissao ? 'Editar Permissao' : 'Nova Permissao'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nome" className="text-foreground">
                Nome da Permissao *
              </Label>
              <Input
                id="nome"
                placeholder="Ex: Atendente, Supervisor, Admin..."
                value={formData.nome}
                onChange={(e) =>
                  setFormData({ ...formData, nome: e.target.value })
                }
                className="glass-input rounded-xl text-white/80 placeholder:text-white/25"
              />
            </div>

            <div className="space-y-4">
              <Label className="text-foreground">Capacidades</Label>

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="can_view_dashboard"
                  checked={formData.can_view_dashboard}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      can_view_dashboard: checked === true,
                    })
                  }
                />
                <Label
                  htmlFor="can_view_dashboard"
                  className="cursor-pointer text-sm font-normal text-foreground"
                >
                  Pode visualizar o Dashboard?
                </Label>
              </div>

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="can_manage_users"
                  checked={formData.can_manage_users}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      can_manage_users: checked === true,
                    })
                  }
                />
                <Label
                  htmlFor="can_manage_users"
                  className="cursor-pointer text-sm font-normal text-foreground"
                >
                  Pode gerenciar usuarios?
                </Label>
              </div>

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="can_view_all_tickets"
                  checked={formData.can_view_all_tickets}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      can_view_all_tickets: checked === true,
                    })
                  }
                />
                <Label
                  htmlFor="can_view_all_tickets"
                  className="cursor-pointer text-sm font-normal text-foreground"
                >
                  Pode visualizar tickets de todos os setores?
                </Label>
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
              {editingPermissao ? 'Salvar Alteracoes' : 'Salvar Permissao'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#0e1019] border border-white/8 rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Excluir Permissao
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a permissao{' '}
              <strong>{deletingPermissao?.nome}</strong>? Esta acao nao pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-white/60 hover:bg-white/5">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
