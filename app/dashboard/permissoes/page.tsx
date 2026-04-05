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
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Shield, Plus, Pencil, Trash2, Loader2, Check, X, Search, Users } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
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
  const [searchTerm, setSearchTerm] = useState('')

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
            : 'bg-foreground/5 text-muted-foreground/60 border-foreground/10'
        }`}
      >
        {value ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
        {label}
      </span>
    )
  }

  const filteredPermissoes = searchTerm
    ? permissoes.filter((p) => p.nome.toLowerCase().includes(searchTerm.toLowerCase()))
    : permissoes

  return (
    <div className="flex flex-col gap-5 h-[calc(100vh-130px)]">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center border border-foreground/10">
            <Shield className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Permissoes</h1>
            <p className="text-sm text-muted-foreground/80">
              Gerencie os tipos de permissao e controle o acesso dos colaboradores.
            </p>
          </div>
        </div>
        <Button onClick={openCreateModal} className="btn-glow rounded-xl gap-2 px-5">
          <Plus className="h-4 w-4" />
          Nova Permissao
        </Button>
      </div>

      {/* Search Bar */}
      <div className="glass-card rounded-2xl p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            placeholder="Buscar permissao por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 rounded-xl glass-input text-foreground/80 placeholder:text-muted-foreground/50"
          />
        </div>
      </div>

      {/* Card List */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl p-5 flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))
        ) : filteredPermissoes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-full bg-emerald-500/10 p-4">
              <Shield className="h-10 w-10 text-emerald-400" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-white">
              {permissoes.length === 0 ? 'Nenhuma permissao cadastrada' : 'Nenhuma permissao encontrada'}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground/80">
              {permissoes.length === 0 ? 'Comece criando o primeiro tipo de permissao' : 'Tente ajustar a busca'}
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredPermissoes.map((permissao, index) => (
              <motion.div
                key={permissao.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                className="glass-card rounded-2xl p-5 flex items-center gap-4 border-l-2 border-l-violet-500/30 transition-all duration-200 hover:bg-foreground/[0.03] hover:border-l-violet-500/60 group"
              >
                {/* Shield Icon */}
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500/15 to-cyan-500/15 flex items-center justify-center border border-foreground/8 shrink-0">
                  <Shield className="h-5 w-5 text-violet-400" />
                </div>

                {/* Main Info */}
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-foreground/90">{permissao.nome}</span>
                  {/* Capability badges */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <FlagBadge value={permissao.can_view_dashboard} label="Dashboard" />
                    <FlagBadge value={permissao.can_manage_users} label="Usuarios" />
                    <FlagBadge value={permissao.can_view_all_tickets} label="Todos Tickets" />
                  </div>
                </div>

                {/* Collaborator count */}
                <div className="hidden sm:flex items-center gap-1.5 shrink-0 text-muted-foreground/80">
                  <Users className="h-3.5 w-3.5" />
                  <span className="text-sm">
                    {permissao._count || 0} colaborador{permissao._count !== 1 ? 'es' : ''}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground/80 hover:text-foreground hover:bg-foreground/5"
                    onClick={() => openEditModal(permissao)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {(permissao._count || 0) === 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
                      onClick={() => openDeleteDialog(permissao)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Modal for Create/Edit */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-page-bg-alt border border-foreground/8 rounded-2xl">
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
                className="glass-input rounded-xl text-foreground/80 placeholder:text-muted-foreground/50"
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
              className="border-foreground/10 text-foreground/60 hover:bg-foreground/5"
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
        <AlertDialogContent className="bg-page-bg-alt border border-foreground/8 rounded-2xl">
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
            <AlertDialogCancel className="border-foreground/10 text-foreground/60 hover:bg-foreground/5">
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
