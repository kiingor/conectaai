'use client'

import { useEffect } from "react"

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Plus, Pencil, Search, UserCog, Building2, Trash2, Filter } from 'lucide-react'
import { motion } from 'framer-motion'
import { useColaborador } from '@/lib/hooks/use-data'

interface Setor {
  id: string
  nome: string
}

interface Permissao {
  id: string
  nome: string
}

interface Colaborador {
  id: string
  nome: string
  email: string
  is_master: boolean
  ativo: boolean
  permissao_id: string | null
  permissoes: Permissao | null
  setores_atribuidos?: string[]
}

interface ColaboradorSetor {
  colaborador_id: string
  setor_id: string
}

const supabase = createClient()

async function fetchUsuariosData([, organizacaoId]: [string, string]) {
  const [colabsRes, setoresRes, permissoesRes, colabSetoresRes] = await Promise.all([
    supabase.from('colaboradores').select('*, permissoes:permissao_id(*)').eq('organizacao_id', organizacaoId).order('nome'),
    supabase.from('setores').select('*').eq('organizacao_id', organizacaoId).order('nome'),
    supabase.from('permissoes').select('*').eq('organizacao_id', organizacaoId).order('nome'),
    supabase.from('colaborador_setores').select('*'),
  ])
  return {
    colaboradores: colabsRes.data || [],
    setores: setoresRes.data || [],
    permissoes: permissoesRes.data || [],
    colaboradorSetores: colabSetoresRes.data || [],
  }
}

export default function UsuariosPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<Colaborador | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingUser, setDeletingUser] = useState<Colaborador | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    is_master: false,
    permissao_id: '',
    setores_selecionados: [] as string[],
  })

  const { data: colaborador } = useColaborador()

  const { data, isLoading, mutate } = useSWR(
    colaborador?.organizacao_id ? ['usuarios-data', colaborador.organizacao_id] : null,
    fetchUsuariosData,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  )

  const colaboradores = data?.colaboradores || []
  const setores = data?.setores || []
  const permissoes = data?.permissoes || []
  const colaboradorSetores = data?.colaboradorSetores || []

  const filteredColaboradores = useMemo(() => {
    let result = colaboradores
    if (searchTerm) {
      result = result.filter((c: any) =>
        c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    if (statusFilter === 'active') {
      result = result.filter((c: any) => c.ativo)
    } else if (statusFilter === 'inactive') {
      result = result.filter((c: any) => !c.ativo)
    }
    return result
  }, [colaboradores, searchTerm, statusFilter])

  function getSetoresDoColaborador(colaboradorId: string): string[] {
    return colaboradorSetores
      .filter((cs: any) => cs.colaborador_id === colaboradorId)
      .map((cs: any) => cs.setor_id)
  }

  function openCreateModal() {
    setEditingUser(null)
    setFormData({
      nome: '',
      email: '',
      senha: '',
      is_master: false,
      permissao_id: '',
      setores_selecionados: [],
    })
    setIsModalOpen(true)
  }

  function openEditModal(user: Colaborador) {
    setEditingUser(user)
    setFormData({
      nome: user.nome,
      email: user.email,
      senha: '',
      is_master: user.is_master,
      permissao_id: user.permissao_id || '',
      setores_selecionados: getSetoresDoColaborador(user.id),
    })
    setIsModalOpen(true)
  }

  async function handleSave() {
    if (!formData.nome || !formData.email) return

    setSaving(true)
    try {
      if (editingUser) {
        // Update existing user
        await supabase
          .from('colaboradores')
          .update({
            nome: formData.nome,
            is_master: formData.is_master,
            permissao_id: formData.permissao_id || null,
          })
          .eq('id', editingUser.id)

        // Update setores relationships
        // First, remove all existing
        await supabase
          .from('colaborador_setores')
          .delete()
          .eq('colaborador_id', editingUser.id)

        // Then add new ones (only if not master)
        if (!formData.is_master && formData.setores_selecionados.length > 0) {
          const newRelations = formData.setores_selecionados.map((setorId) => ({
            colaborador_id: editingUser.id,
            setor_id: setorId,
          }))
          await supabase.from('colaborador_setores').insert(newRelations)
        }
      } else {
        // Create new user via Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.senha,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        })

        if (authError) throw authError

        // Create colaborador record
        const { data: newColab, error: colabError } = await supabase
          .from('colaboradores')
          .insert({
            nome: formData.nome,
            email: formData.email,
            is_master: formData.is_master,
            permissao_id: formData.permissao_id || null,
            ativo: true,
            is_online: false,
            organizacao_id: colaborador?.organizacao_id,
          })
          .select()
          .single()

        if (colabError) throw colabError

        // Add setor relationships (only if not master)
        if (!formData.is_master && formData.setores_selecionados.length > 0 && newColab) {
          const relations = formData.setores_selecionados.map((setorId) => ({
            colaborador_id: newColab.id,
            setor_id: setorId,
          }))
          await supabase.from('colaborador_setores').insert(relations)
        }
      }

      setIsModalOpen(false)
      mutate()
    } catch (error) {
      console.error('Error saving user:', error)
    } finally {
      setSaving(false)
    }
  }

  function toggleSetorSelection(setorId: string) {
    setFormData((prev) => ({
      ...prev,
      setores_selecionados: prev.setores_selecionados.includes(setorId)
        ? prev.setores_selecionados.filter((id) => id !== setorId)
        : [...prev.setores_selecionados, setorId],
    }))
  }

  async function handleDelete() {
    if (!deletingUser) return
    setDeleting(true)
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colaboradorId: deletingUser.id,
          email: deletingUser.email,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Erro ao deletar')
      toast.success(`Usuário "${deletingUser.nome}" removido com sucesso`)
      setDeletingUser(null)
      mutate()
    } catch (error: any) {
      toast.error(error.message || 'Erro ao deletar usuário')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 h-[calc(100vh-130px)]">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center border border-foreground/10">
            <UserCog className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Usuarios Master</h1>
            <p className="text-sm text-muted-foreground/80">
              Gerencie usuarios e defina quais setores cada um pode acessar
            </p>
          </div>
        </div>
        <Button onClick={openCreateModal} className="btn-glow rounded-xl gap-2 px-5">
          <Plus className="h-4 w-4" />
          Novo Usuario
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              placeholder="Buscar por nome ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 rounded-xl glass-input text-foreground/80 placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground/60 shrink-0" />
            <div className="flex rounded-xl border border-foreground/8 overflow-hidden">
              {(['all', 'active', 'inactive'] as const).map((val) => (
                <button
                  key={val}
                  onClick={() => setStatusFilter(val)}
                  className={cn(
                    'px-4 py-2 text-xs font-medium transition-colors',
                    statusFilter === val
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'text-muted-foreground/80 hover:bg-foreground/5 hover:text-foreground/60'
                  )}
                >
                  {val === 'all' ? 'Todos' : val === 'active' ? 'Ativos' : 'Inativos'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Card List */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl p-4 flex items-center gap-4">
              <Skeleton className="h-11 w-11 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))
        ) : filteredColaboradores.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/60">
            <UserCog className="mb-3 h-10 w-10" />
            <p className="text-sm">Nenhum usuario encontrado</p>
          </div>
        ) : (
          filteredColaboradores.map((user: any, index: number) => {
            const userSetores = getSetoresDoColaborador(user.id)
            const setorNames = setores
              .filter((s) => userSetores.includes(s.id))
              .map((s) => s.nome)
            const initials = user.nome
              .split(' ')
              .map((n: string) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()

            return (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, duration: 0.3 }}
                className={cn(
                  'glass-card rounded-2xl p-4 flex items-center gap-4 border-l-2 transition-all duration-200 hover:bg-foreground/[0.03] hover:border-l-emerald-500/60 group',
                  user.ativo ? 'border-l-emerald-500/30' : 'border-l-white/10 opacity-60'
                )}
              >
                {/* Avatar */}
                <div className={cn(
                  'h-11 w-11 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold',
                  user.is_master
                    ? 'bg-gradient-to-br from-emerald-500/25 to-cyan-500/25 text-emerald-400 border border-emerald-500/20'
                    : 'bg-foreground/[0.06] text-muted-foreground border border-foreground/8'
                )}>
                  {initials}
                </div>

                {/* Main Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground/90 truncate">{user.nome}</span>
                    {user.is_master && (
                      <Badge className="glass-badge bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[10px] px-1.5 py-0">
                        Admin
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground/80 truncate">{user.email}</p>
                  {/* Setores inline */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {user.is_master ? (
                      <span className="text-xs text-muted-foreground/60">Todos os setores</span>
                    ) : setorNames.length > 0 ? (
                      <>
                        {setorNames.slice(0, 3).map((nome: string) => (
                          <Badge key={nome} className="glass-badge bg-cyan-500/10 text-cyan-400/60 border-cyan-500/15 text-[10px] px-1.5 py-0">
                            {nome}
                          </Badge>
                        ))}
                        {setorNames.length > 3 && (
                          <Badge className="glass-badge bg-foreground/5 text-muted-foreground/60 border-foreground/8 text-[10px] px-1.5 py-0">
                            +{setorNames.length - 3}
                          </Badge>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">Sem setores</span>
                    )}
                  </div>
                </div>

                {/* Permission */}
                <div className="hidden md:block text-right shrink-0">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 block">Permissao</span>
                  <span className="text-sm text-muted-foreground">{user.permissoes?.nome || '-'}</span>
                </div>

                {/* Status */}
                <Badge
                  className={cn(
                    'shrink-0',
                    user.ativo
                      ? 'glass-badge bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                      : 'glass-badge bg-foreground/5 text-muted-foreground/60 border-foreground/10'
                  )}
                >
                  {user.ativo ? 'Ativo' : 'Inativo'}
                </Badge>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground/80 hover:text-foreground hover:bg-foreground/5"
                    onClick={() => openEditModal(user)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
                    onClick={() => setDeletingUser(user)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </motion.div>
            )
          })
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent className="bg-page-bg-alt border border-foreground/8 rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar <strong>{deletingUser?.nome}</strong>?
              <br />
              Esta ação removerá o colaborador e seu acesso ao sistema. Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deletando...' : 'Deletar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl bg-page-bg-alt border border-foreground/8 rounded-2xl flex flex-col max-h-[88vh] p-0 gap-0">
          {/* Header fixo */}
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b border-border/50">
            <DialogTitle>
              {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? 'Atualize as informações do usuário e seus setores'
                : 'Cadastre um novo usuário e defina seus acessos'}
            </DialogDescription>
          </DialogHeader>

          {/* Conteúdo rolável */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="grid gap-5">
              {/* Nome + E-mail */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, nome: e.target.value }))
                    }
                    placeholder="Nome completo"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="email@exemplo.com"
                    disabled={!!editingUser}
                  />
                </div>
              </div>

              {/* Senha (apenas criação) */}
              {!editingUser && (
                <div className="space-y-2">
                  <Label htmlFor="senha">Senha</Label>
                  <Input
                    id="senha"
                    type="password"
                    value={formData.senha}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, senha: e.target.value }))
                    }
                    placeholder="Mínimo 8 caracteres"
                  />
                </div>
              )}

              {/* Permissão + Admin toggle */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="permissao">Permissão</Label>
                  <Select
                    value={formData.permissao_id}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, permissao_id: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma permissão" />
                    </SelectTrigger>
                    <SelectContent>
                      {permissoes.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-3 h-fit mt-auto">
                  <Switch
                    id="is_master"
                    checked={formData.is_master}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, is_master: checked }))
                    }
                  />
                  <Label htmlFor="is_master" className="cursor-pointer text-sm leading-tight">
                    Admin — acesso a todos os setores
                  </Label>
                </div>
              </div>

              {/* Setores */}
              {!formData.is_master && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Setores que o usuário pode acessar</Label>
                    {formData.setores_selecionados.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {formData.setores_selecionados.length} selecionado{formData.setores_selecionados.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {setores.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum setor cadastrado</p>
                  ) : (
                    <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 max-h-56 overflow-y-auto pr-1">
                      {setores.map((setor) => {
                        const isSelected = formData.setores_selecionados.includes(setor.id)
                        return (
                          <button
                            key={setor.id}
                            type="button"
                            onClick={() => toggleSetorSelection(setor.id)}
                            className={cn(
                              'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                              isSelected
                                ? 'border-primary bg-primary/10 text-primary font-medium'
                                : 'border-border/60 bg-background hover:bg-muted/50 text-foreground'
                            )}
                          >
                            <Building2 className="h-3.5 w-3.5 shrink-0 opacity-60" />
                            <span className="truncate leading-tight">{setor.nome}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer fixo */}
          <div className="flex justify-end gap-2 px-6 py-4 shrink-0 border-t border-border/50">
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editingUser ? 'Salvar alterações' : 'Criar Usuário'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
