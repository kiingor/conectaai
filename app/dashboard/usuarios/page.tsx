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
import { Plus, Pencil, Search, UserCog, Building2, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'

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

async function fetchUsuariosData() {
  const [colabsRes, setoresRes, permissoesRes, colabSetoresRes] = await Promise.all([
    supabase.from('colaboradores').select('*, permissoes:permissao_id(*)').order('nome'),
    supabase.from('setores').select('*').order('nome'),
    supabase.from('permissoes').select('*').order('nome'),
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

  const { data, isLoading, mutate } = useSWR('usuarios-data', fetchUsuariosData, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  })

  const colaboradores = data?.colaboradores || []
  const setores = data?.setores || []
  const permissoes = data?.permissoes || []
  const colaboradorSetores = data?.colaboradorSetores || []

  const filteredColaboradores = useMemo(() => {
    if (!searchTerm) return colaboradores
    return colaboradores.filter((c: any) =>
      c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [colaboradores, searchTerm])

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
    <div className="flex flex-col gap-6 h-[calc(100vh-130px)]">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center border border-white/10">
            <UserCog className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Usuarios Master</h1>
            <p className="text-sm text-white/40">
              Gerencie usuarios e defina quais setores cada um pode acessar
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <Input
              placeholder="Buscar usuario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64 pl-9 rounded-xl glass-input text-white/80 placeholder:text-white/25"
            />
          </div>
          <Button onClick={openCreateModal} className="btn-glow rounded-xl gap-2 px-5">
            <Plus className="h-4 w-4" />
            Novo Usuario
          </Button>
        </div>
      </div>

      {/* Users Table */}
      <div className="glass-card rounded-2xl flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="p-0 overflow-y-auto flex-1">
          <Table>
            <TableHeader>
              <TableRow className="border-white/6 hover:bg-transparent">
                <TableHead className="pl-5 text-[11px] font-semibold uppercase tracking-wider text-white/40">Nome</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-white/40">E-mail</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Tipo</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Permissao</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Setores</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Status</TableHead>
                <TableHead className="w-24 text-[11px] font-semibold uppercase tracking-wider text-white/40">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-white/6">
                    <TableCell className="pl-5"><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : filteredColaboradores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center text-white/30">
                      <UserCog className="mb-2 h-8 w-8" />
                      <p>Nenhum usuario encontrado</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredColaboradores.map((user: any, index: number) => {
                  const userSetores = getSetoresDoColaborador(user.id)
                  const setorNames = setores
                    .filter((s) => userSetores.includes(s.id))
                    .map((s) => s.nome)

                  return (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="border-b border-white/6 hover:bg-white/[0.03] transition-colors"
                    >
                      <TableCell className="font-medium pl-5 text-white/90">{user.nome}</TableCell>
                      <TableCell className="text-white/60">{user.email}</TableCell>
                      <TableCell>
                        {user.is_master ? (
                          <Badge className="glass-badge bg-emerald-500/15 text-emerald-400 border-emerald-500/20">
                            Admin
                          </Badge>
                        ) : (
                          <Badge className="glass-badge bg-white/5 text-white/50 border-white/10">Usuario</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-white/60">
                        {user.permissoes?.nome || (
                          <span className="text-white/25">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.is_master ? (
                          <span className="text-sm text-white/40">
                            Todos os setores
                          </span>
                        ) : setorNames.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {setorNames.slice(0, 2).map((nome) => (
                              <Badge key={nome} className="glass-badge bg-cyan-500/10 text-cyan-400/70 border-cyan-500/15 text-xs">
                                {nome}
                              </Badge>
                            ))}
                            {setorNames.length > 2 && (
                              <Badge className="glass-badge bg-white/5 text-white/40 border-white/10 text-xs">
                                +{setorNames.length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-white/25">Nenhum</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            user.ativo
                              ? 'glass-badge bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                              : 'glass-badge bg-white/5 text-white/30 border-white/10'
                          }
                        >
                          {user.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-white/40 hover:text-white hover:bg-white/5"
                            onClick={() => openEditModal(user)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
                            onClick={() => setDeletingUser(user)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent className="bg-[#0e1019] border border-white/8 rounded-2xl">
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
        <DialogContent className="max-w-2xl bg-[#0e1019] border border-white/8 rounded-2xl flex flex-col max-h-[88vh] p-0 gap-0">
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
