'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, Plus, Pencil, UserX, Loader2, Circle, Search, Filter } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
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
  setor_id: string | null
  permissao_id: string | null
  is_online: boolean
  ativo: boolean
  created_at: string
  setor?: Setor | null
  permissao?: Permissao | null
}

export default function ColaboradoresPage() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [setores, setSetores] = useState<Setor[]>([])
  const [permissoes, setPermissoes] = useState<Permissao[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingColaborador, setEditingColaborador] = useState<Colaborador | null>(null)
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false)
  const [colaboradorToDeactivate, setColaboradorToDeactivate] = useState<Colaborador | null>(null)
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    setor_id: '',
    permissao_id: '',
    setores_selecionados: [] as string[],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [setorFilterId, setSetorFilterId] = useState<string>('all')

  const supabase = createClient()
  const { toast } = useToast()
  const { data: colaborador } = useColaborador()

  const [colaboradorSetores, setColaboradorSetores] = useState<{ colaborador_id: string; setor_id: string }[]>([])

  function getSetoresDoColaborador(colaboradorId: string): string[] {
    return colaboradorSetores
      .filter((cs) => cs.colaborador_id === colaboradorId)
      .map((cs) => cs.setor_id)
  }

  async function fetchData() {
    if (!colaborador?.organizacao_id) return

    setLoading(true)

    // Fetch colaboradores with joins
    const { data: colaboradoresData, error: colaboradoresError } = await supabase
      .from('colaboradores')
      .select(`
        *,
        setor:setores(id, nome),
        permissao:permissoes(id, nome)
      `)
      .eq('organizacao_id', colaborador.organizacao_id)
      .order('created_at', { ascending: false })

    if (!colaboradoresError && colaboradoresData) {
      setColaboradores(colaboradoresData)
    }

    // Fetch setores
    const { data: setoresData } = await supabase
      .from('setores')
      .select('id, nome')
      .eq('organizacao_id', colaborador.organizacao_id)
      .order('nome')

    if (setoresData) {
      setSetores(setoresData)
    }

    // Fetch permissoes
    const { data: permissoesData } = await supabase
      .from('permissoes')
      .select('id, nome')
      .eq('organizacao_id', colaborador.organizacao_id)
      .order('nome')

    if (permissoesData) {
      setPermissoes(permissoesData)
    }

    // Fetch colaborador_setores (join table)
    const { data: colabSetoresData } = await supabase
      .from('colaborador_setores')
      .select('colaborador_id, setor_id')

    if (colabSetoresData) {
      setColaboradorSetores(colabSetoresData)
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchData()

    // Subscribe to real-time changes on is_online
    const channel = supabase
      .channel('colaboradores-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'colaboradores',
        },
        (payload) => {
          setColaboradores((current) =>
            current.map((c) =>
              c.id === payload.new.id
                ? { ...c, is_online: payload.new.is_online, ativo: payload.new.ativo }
                : c
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [colaborador?.organizacao_id])

  function openCreateModal() {
    setEditingColaborador(null)
    setFormData({
      nome: '',
      email: '',
      senha: '',
      setor_id: '',
      permissao_id: '',
      setores_selecionados: [],
    })
    setError(null)
    setModalOpen(true)
  }

  function openEditModal(colaborador: Colaborador) {
    setEditingColaborador(colaborador)
    setFormData({
      nome: colaborador.nome,
      email: colaborador.email,
      senha: '',
      setor_id: colaborador.setor_id || '',
      permissao_id: colaborador.permissao_id || '',
      setores_selecionados: getSetoresDoColaborador(colaborador.id),
    })
    setError(null)
    setModalOpen(true)
  }

  function toggleSetorSelection(setorId: string) {
    setFormData((prev) => ({
      ...prev,
      setores_selecionados: prev.setores_selecionados.includes(setorId)
        ? prev.setores_selecionados.filter((id) => id !== setorId)
        : [...prev.setores_selecionados, setorId],
    }))
  }

  function openDeactivateDialog(colaborador: Colaborador) {
    setColaboradorToDeactivate(colaborador)
    setDeactivateDialogOpen(true)
  }

  async function handleSave() {
    if (!formData.nome.trim()) {
      setError('Nome e obrigatorio')
      return
    }

    setSaving(true)
    setError(null)

    if (editingColaborador) {
      // Update existing colaborador
      const { error: updateError } = await supabase
        .from('colaboradores')
        .update({
          nome: formData.nome.trim(),
          setor_id: formData.setor_id || null,
          permissao_id: formData.permissao_id || null,
        })
        .eq('id', editingColaborador.id)

      if (updateError) {
        setError('Erro ao atualizar colaborador: ' + updateError.message)
        setSaving(false)
        return
      }

      // Update colaborador_setores join table
      await supabase
        .from('colaborador_setores')
        .delete()
        .eq('colaborador_id', editingColaborador.id)

      if (formData.setores_selecionados.length > 0) {
        const relations = formData.setores_selecionados.map((setorId) => ({
          colaborador_id: editingColaborador.id,
          setor_id: setorId,
        }))
        await supabase.from('colaborador_setores').insert(relations)
      }

      toast({
        title: 'Colaborador atualizado',
        description: 'As alteracoes foram salvas com sucesso.',
      })
    } else {
      // Create new colaborador
      if (!formData.email.trim() || !formData.senha.trim()) {
        setError('E-mail e senha sao obrigatorios para novos colaboradores')
        setSaving(false)
        return
      }

      // 1. Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.senha,
        options: {
          emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
            `${window.location.origin}/workdesk`,
        },
      })

      if (authError) {
        if (authError.message.includes('already registered')) {
          setError('Este e-mail ja esta cadastrado')
        } else {
          setError('Erro ao criar usuario: ' + authError.message)
        }
        setSaving(false)
        return
      }

      if (!authData.user) {
        setError('Erro ao criar usuario no sistema de autenticacao')
        setSaving(false)
        return
      }

      // 2. Insert into colaboradores table
      const { error: insertError } = await supabase.from('colaboradores').insert({
        id: authData.user.id,
        nome: formData.nome.trim(),
        email: formData.email.trim().toLowerCase(),
        setor_id: formData.setor_id || null,
        permissao_id: formData.permissao_id || null,
        is_online: false,
        ativo: true,
        organizacao_id: colaborador?.organizacao_id,
      })

      if (insertError) {
        setError('Erro ao cadastrar colaborador: ' + insertError.message)
        setSaving(false)
        return
      }

      // 3. Insert into colaborador_setores join table
      if (formData.setores_selecionados.length > 0) {
        const relations = formData.setores_selecionados.map((setorId) => ({
          colaborador_id: authData.user!.id,
          setor_id: setorId,
        }))
        await supabase.from('colaborador_setores').insert(relations)
      }

      toast({
        title: 'Colaborador criado',
        description: 'O novo colaborador foi cadastrado com sucesso.',
      })
    }

    setModalOpen(false)
    fetchData()
    setSaving(false)
  }

  async function handleDeactivate() {
    if (!colaboradorToDeactivate) return

    const newStatus = colaboradorToDeactivate.ativo ? false : true

    const { error } = await supabase
      .from('colaboradores')
      .update({ ativo: newStatus, is_online: false })
      .eq('id', colaboradorToDeactivate.id)

    if (!error) {
      toast({
        title: newStatus ? 'Colaborador reativado' : 'Colaborador desativado',
        description: newStatus
          ? 'O colaborador pode acessar o sistema novamente.'
          : 'O colaborador nao podera mais acessar o sistema.',
      })
      fetchData()
    }

    setDeactivateDialogOpen(false)
    setColaboradorToDeactivate(null)
  }

  const filteredColaboradores = (() => {
    let result = colaboradores
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter((c) =>
        c.nome.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term)
      )
    }
    if (statusFilter === 'active') {
      result = result.filter((c) => c.ativo)
    } else if (statusFilter === 'inactive') {
      result = result.filter((c) => !c.ativo)
    }
    if (setorFilterId !== 'all') {
      result = result.filter((c) => {
        const setorIds = getSetoresDoColaborador(c.id)
        return setorIds.includes(setorFilterId)
      })
    }
    return result
  })()

  return (
    <div className="flex flex-col gap-5 h-[calc(100vh-130px)]">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center border border-white/10">
            <Users className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Colaboradores</h1>
            <p className="text-sm text-white/40">
              Gerencie usuarios, setores e permissoes
            </p>
          </div>
        </div>
        <Button
          onClick={openCreateModal}
          className="btn-glow rounded-xl gap-2 px-5"
        >
          <Plus className="h-4 w-4" />
          Novo Colaborador
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <Input
              placeholder="Buscar por nome ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 rounded-xl glass-input text-white/80 placeholder:text-white/25"
            />
          </div>
          <Select value={setorFilterId} onValueChange={setSetorFilterId}>
            <SelectTrigger className="w-full sm:w-44 glass-input rounded-xl text-white/70">
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent className="bg-[#0e1019] border-white/8">
              <SelectItem value="all">Todos os Setores</SelectItem>
              {setores.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-white/30 shrink-0" />
            <div className="flex rounded-xl border border-white/8 overflow-hidden">
              {(['all', 'active', 'inactive'] as const).map((val) => (
                <button
                  key={val}
                  onClick={() => setStatusFilter(val)}
                  className={cn(
                    'px-3 py-2 text-xs font-medium transition-colors',
                    statusFilter === val
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'text-white/40 hover:bg-white/5 hover:text-white/60'
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
        {loading ? (
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
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-full bg-emerald-500/10 p-4">
              <Users className="h-10 w-10 text-emerald-400" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-white">
              Nenhum colaborador encontrado
            </h3>
            <p className="mt-1 text-sm text-white/40">
              {colaboradores.length === 0 ? 'Comece cadastrando o primeiro colaborador' : 'Tente ajustar os filtros'}
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredColaboradores.map((colab, index) => {
              const setorIds = getSetoresDoColaborador(colab.id)
              const setorNomes = setorIds.map((sid) => setores.find((s) => s.id === sid)?.nome).filter(Boolean)
              const initials = colab.nome
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()

              return (
                <motion.div
                  key={colab.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ delay: index * 0.04, duration: 0.3 }}
                  className={cn(
                    'glass-card rounded-2xl p-4 flex items-center gap-4 border-l-2 transition-all duration-200 hover:bg-white/[0.03] hover:border-l-cyan-500/60 group',
                    colab.ativo ? 'border-l-cyan-500/30' : 'border-l-white/10 opacity-50'
                  )}
                >
                  {/* Online dot + Avatar */}
                  <div className="relative shrink-0">
                    <div className={cn(
                      'h-11 w-11 rounded-full flex items-center justify-center text-sm font-semibold bg-white/[0.06] text-white/50 border border-white/8',
                    )}>
                      {initials}
                    </div>
                    <span
                      className={cn(
                        'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#0a0c14]',
                        colab.is_online && colab.ativo
                          ? 'status-dot-online bg-emerald-500'
                          : 'bg-white/20'
                      )}
                    />
                  </div>

                  {/* Main Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white/90 truncate">{colab.nome}</span>
                      {!colab.ativo && (
                        <Badge className="glass-badge bg-white/5 text-white/30 border-white/10 text-[10px] px-1.5 py-0">
                          Inativo
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-white/40 truncate">{colab.email}</p>
                    {/* Sector badges */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {setorNomes.length > 0 ? (
                        <>
                          {setorNomes.slice(0, 3).map((nome) => (
                            <Badge key={nome} className="glass-badge bg-cyan-500/10 text-cyan-400/60 border-cyan-500/15 text-[10px] px-1.5 py-0">
                              {nome}
                            </Badge>
                          ))}
                          {setorNomes.length > 3 && (
                            <Badge className="glass-badge bg-white/5 text-white/30 border-white/8 text-[10px] px-1.5 py-0">
                              +{setorNomes.length - 3}
                            </Badge>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-white/20">Sem setores</span>
                      )}
                    </div>
                  </div>

                  {/* Permission role */}
                  <div className="hidden md:block text-right shrink-0">
                    <span className="text-[10px] uppercase tracking-wider text-white/25 block">Permissao</span>
                    <span className="text-sm text-white/50">{colab.permissao?.nome || '-'}</span>
                  </div>

                  {/* Online status badge */}
                  <Badge
                    className={cn(
                      'shrink-0',
                      colab.is_online && colab.ativo
                        ? 'glass-badge bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                        : 'glass-badge bg-white/5 text-white/30 border-white/10'
                    )}
                  >
                    {colab.is_online && colab.ativo ? 'Online' : 'Offline'}
                  </Badge>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/5"
                      onClick={() => openEditModal(colab)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'h-8 w-8',
                        colab.ativo
                          ? 'text-red-400/60 hover:text-red-400 hover:bg-red-500/10'
                          : 'text-emerald-400/60 hover:text-emerald-400 hover:bg-emerald-500/10'
                      )}
                      onClick={() => openDeactivateDialog(colab)}
                    >
                      <UserX className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Modal for Create/Edit */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md bg-[#0e1019] border border-white/8 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Users className="h-5 w-5 text-emerald-400" />
              {editingColaborador ? 'Editar Colaborador' : 'Novo Colaborador'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="nome" className="text-foreground">
                Nome *
              </Label>
              <Input
                id="nome"
                placeholder="Nome completo"
                value={formData.nome}
                onChange={(e) =>
                  setFormData({ ...formData, nome: e.target.value })
                }
                className="glass-input rounded-xl text-white/80 placeholder:text-white/25"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email" className="text-foreground">
                E-mail *
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="email@empresa.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                disabled={!!editingColaborador}
                className="glass-input rounded-xl text-white/80 placeholder:text-white/25 disabled:opacity-50"
              />
              {editingColaborador && (
                <p className="text-xs text-muted-foreground">
                  O e-mail nao pode ser alterado
                </p>
              )}
            </div>

            {!editingColaborador && (
              <div className="grid gap-2">
                <Label htmlFor="senha" className="text-foreground">
                  Senha *
                </Label>
                <Input
                  id="senha"
                  type="password"
                  placeholder="Senha de acesso"
                  value={formData.senha}
                  onChange={(e) =>
                    setFormData({ ...formData, senha: e.target.value })
                  }
                  className="glass-input rounded-xl text-white/80 placeholder:text-white/25"
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label className="text-foreground">
                Setores
              </Label>
              <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-card p-3 space-y-2">
                {setores.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum setor cadastrado</p>
                ) : (
                  setores.map((setor) => (
                    <div key={setor.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`setor-${setor.id}`}
                        checked={formData.setores_selecionados.includes(setor.id)}
                        onCheckedChange={() => toggleSetorSelection(setor.id)}
                      />
                      <label
                        htmlFor={`setor-${setor.id}`}
                        className="text-sm text-foreground cursor-pointer"
                      >
                        {setor.nome}
                      </label>
                    </div>
                  ))
                )}
              </div>
              {formData.setores_selecionados.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {formData.setores_selecionados.length} setor(es) selecionado(s)
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="permissao" className="text-foreground">
                Permissao
              </Label>
              <Select
                value={formData.permissao_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, permissao_id: value })
                }
              >
                <SelectTrigger className="glass-input rounded-xl text-white/80 placeholder:text-white/25">
                  <SelectValue placeholder="Selecione uma permissao" />
                </SelectTrigger>
                <SelectContent>
                  {permissoes.map((permissao) => (
                    <SelectItem key={permissao.id} value={permissao.id}>
                      {permissao.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              {editingColaborador ? 'Atualizar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent className="bg-[#0e1019] border border-white/8 rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {colaboradorToDeactivate?.ativo
                ? 'Desativar colaborador?'
                : 'Reativar colaborador?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {colaboradorToDeactivate?.ativo
                ? `O colaborador "${colaboradorToDeactivate?.nome}" nao podera mais acessar o sistema. Voce podera reativa-lo a qualquer momento.`
                : `O colaborador "${colaboradorToDeactivate?.nome}" podera acessar o sistema novamente.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-white/60 hover:bg-white/5">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              className={
                colaboradorToDeactivate?.ativo
                  ? 'bg-destructive text-white hover:bg-destructive/90'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }
            >
              {colaboradorToDeactivate?.ativo ? 'Desativar' : 'Reativar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
