'use client'

import { useState, useMemo, useTransition, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  MessageCircle,
  Search,
  Plus,
  Loader2,
  Headphones,
  Phone,
  Mail,
  Users,
  Building2,
  Briefcase,
  ShoppingCart,
  Heart,
  Star,
  Zap,
  Globe,
  Smile,
  ThumbsUp,
  Bell,
  Calendar,
  Target,
  Award,
  Coffee,
  Rocket,
  Shield,
  Truck,
  CreditCard,
  HelpCircle,
  Tag,
  Pencil,
  Trash2,
  X,
  ChevronRight,
  LayoutList,
  Wifi,
  Hash,
  AlertTriangle,
  MoreVertical,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Skeleton } from '@/components/ui/skeleton'
import { useColaborador, useSetores } from '@/lib/hooks/use-data'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// Available icons for sectors
const AVAILABLE_ICONS = [
  { name: 'MessageCircle', icon: MessageCircle },
  { name: 'Headphones', icon: Headphones },
  { name: 'Phone', icon: Phone },
  { name: 'Mail', icon: Mail },
  { name: 'Users', icon: Users },
  { name: 'Building2', icon: Building2 },
  { name: 'Briefcase', icon: Briefcase },
  { name: 'ShoppingCart', icon: ShoppingCart },
  { name: 'Heart', icon: Heart },
  { name: 'Star', icon: Star },
  { name: 'Zap', icon: Zap },
  { name: 'Globe', icon: Globe },
  { name: 'Smile', icon: Smile },
  { name: 'ThumbsUp', icon: ThumbsUp },
  { name: 'Bell', icon: Bell },
  { name: 'Calendar', icon: Calendar },
  { name: 'Target', icon: Target },
  { name: 'Award', icon: Award },
  { name: 'Coffee', icon: Coffee },
  { name: 'Rocket', icon: Rocket },
  { name: 'Shield', icon: Shield },
  { name: 'Truck', icon: Truck },
  { name: 'CreditCard', icon: CreditCard },
  { name: 'HelpCircle', icon: HelpCircle },
]

// Available colors - emerald/cyan focused palette
const AVAILABLE_COLORS = [
  { name: 'Esmeralda', value: '#10b981' },
  { name: 'Ciano', value: '#06b6d4' },
  { name: 'Azul', value: '#3B82F6' },
  { name: 'Verde', value: '#22C55E' },
  { name: 'Amarelo', value: '#EAB308' },
  { name: 'Laranja', value: '#F97316' },
  { name: 'Vermelho', value: '#EF4444' },
  { name: 'Rosa', value: '#EC4899' },
  { name: 'Roxo', value: '#8B5CF6' },
]

// Canal badge config - dark glassmorphism style
const CANAL_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  whatsapp: { label: 'WhatsApp', icon: '💬', color: '#ffffff', bg: 'rgba(16, 185, 129, 0.7)' },
  evolution_api: { label: 'Evolution', icon: '🔗', color: '#ffffff', bg: 'rgba(6, 182, 212, 0.7)' },
}

// Get icon component by name
function getIconComponent(iconName: string | null) {
  if (!iconName) return MessageCircle
  const found = AVAILABLE_ICONS.find((i) => i.name === iconName)
  return found ? found.icon : MessageCircle
}

// Helper: lighten a hex color for glass tinting
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

interface TagItem {
  id: string
  nome: string
  cor: string
  ordem: number
}

interface Setor {
  id: string
  nome: string
  descricao: string | null
  cor: string | null
  icon_url: string | null
  tag_id: string | null
  tags?: TagItem | null
  setor_canais?: Array<{ tipo: string; ativo: boolean }>
}

export default function DashboardPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newSetor, setNewSetor] = useState({
    nome: '',
    descricao: '',
    cor: '#10b981',
    icon_url: 'MessageCircle',
    tag_id: '' as string,
  })
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  // Tags state
  const [tags, setTags] = useState<TagItem[]>([])
  const [loadingTags, setLoadingTags] = useState(false)
  const [isTagsDialogOpen, setIsTagsDialogOpen] = useState(false)
  const [tagForm, setTagForm] = useState({ nome: '', cor: '#10b981', ordem: 0 })
  const [editingTag, setEditingTag] = useState<TagItem | null>(null)
  const [savingTag, setSavingTag] = useState(false)
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null)

  const { data: colaborador, isLoading: loadingColab } = useColaborador()
  const { data: setores = [], isLoading: loadingSetores, mutate } = useSetores(
    colaborador?.id,
    colaborador?.is_master,
    colaborador?.organizacao_id
  )

  // Excluir setor (somente master)
  const [deleteSetorTarget, setDeleteSetorTarget] = useState<Setor | null>(null)
  const [deleteSetorConfirmText, setDeleteSetorConfirmText] = useState('')
  const [deletingSetor, setDeletingSetor] = useState(false)

  const handleDeleteSetor = useCallback(async () => {
    if (!deleteSetorTarget) return
    if (deleteSetorConfirmText !== deleteSetorTarget.nome) {
      toast.error('Digite o nome do setor corretamente para confirmar')
      return
    }
    setDeletingSetor(true)
    try {
      const res = await fetch(`/api/setor/${deleteSetorTarget.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Erro ao excluir setor')
      }
      toast.success('Setor excluido com sucesso!')
      setDeleteSetorTarget(null)
      setDeleteSetorConfirmText('')
      mutate()
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao excluir setor')
    } finally {
      setDeletingSetor(false)
    }
  }, [deleteSetorTarget, deleteSetorConfirmText, mutate])

  const fetchTags = useCallback(async () => {
    if (!colaborador?.organizacao_id) return
    setLoadingTags(true)
    const { data } = await supabase.from('tags').select('*').eq('organizacao_id', colaborador?.organizacao_id).order('ordem').order('nome')
    if (data) setTags(data)
    setLoadingTags(false)
  }, [supabase, colaborador?.organizacao_id])

  useEffect(() => {
    if (colaborador?.organizacao_id) fetchTags()
  }, [fetchTags, colaborador?.organizacao_id])

  const handleSetorClick = useCallback(
    (setorId: string) => {
      setNavigatingTo(setorId)
      startTransition(() => {
        router.push(`/setor/${setorId}`)
      })
    },
    [router]
  )

  const filteredSetores = useMemo(() => {
    let all = setores as Setor[]
    if (searchTerm) {
      all = all.filter((s) =>
        s.nome.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    if (activeTagFilter) {
      if (activeTagFilter === 'untagged') {
        all = all.filter((s) => !s.tag_id)
      } else {
        all = all.filter((s) => s.tag_id === activeTagFilter)
      }
    }
    return all
  }, [searchTerm, setores, activeTagFilter])

  // Stats derived from data
  const stats = useMemo(() => {
    const allSetores = setores as Setor[]
    return {
      totalSetores: allSetores.length,
      totalTags: tags.length,
      totalCanais: allSetores.reduce((acc, s) => {
        const active = (s.setor_canais ?? []).filter((c) => c.ativo)
        return acc + active.length
      }, 0),
    }
  }, [setores, tags])

  // Group sectors by tag
  const groupedSetores = useMemo(() => {
    const groups: { tag: TagItem | null; setores: Setor[] }[] = []
    const tagMap = new Map<string, { tag: TagItem; setores: Setor[] }>()

    for (const setor of filteredSetores) {
      if (setor.tag_id && setor.tags) {
        const existing = tagMap.get(setor.tag_id)
        if (existing) {
          existing.setores.push(setor)
        } else {
          tagMap.set(setor.tag_id, { tag: setor.tags, setores: [setor] })
        }
      }
    }

    // Sort tag groups by ordem, then by name
    const tagGroups = Array.from(tagMap.values()).sort((a, b) => {
      const ordemDiff = (a.tag.ordem ?? 0) - (b.tag.ordem ?? 0)
      return ordemDiff !== 0 ? ordemDiff : a.tag.nome.localeCompare(b.tag.nome)
    })
    groups.push(...tagGroups)

    // Untagged setores
    const untagged = filteredSetores.filter((s) => !s.tag_id)
    if (untagged.length > 0) {
      groups.push({ tag: null, setores: untagged })
    }

    return groups
  }, [filteredSetores])

  async function handleCreateSetor() {
    if (!newSetor.nome.trim()) return
    setSaving(true)
    try {
      const { data: setorCriado, error: setorError } = await supabase
        .from('setores')
        .insert({
          nome: newSetor.nome,
          descricao: newSetor.descricao || null,
          cor: newSetor.cor,
          icon_url: newSetor.icon_url,
          tag_id: newSetor.tag_id || null,
          organizacao_id: colaborador?.organizacao_id,
        })
        .select('id')
        .single()

      if (setorError || !setorCriado) throw setorError

      // Inserir horarios padrao: segunda a sexta, 08:00-18:00
      const horariosDefault = [0, 1, 2, 3, 4, 5, 6].map((dia) => ({
        setor_id: setorCriado.id,
        dia_semana: dia,
        hora_inicio: '08:00',
        hora_fim: '18:00',
        ativo: dia >= 1 && dia <= 5,
      }))
      await supabase.from('horarios_atendimento').insert(horariosDefault)

      setIsCreateOpen(false)
      setNewSetor({ nome: '', descricao: '', cor: '#10b981', icon_url: 'MessageCircle', tag_id: '' })
      mutate()
    } catch {
      toast.error('Erro ao criar setor')
    } finally {
      setSaving(false)
    }
  }

  // Tag CRUD
  async function handleSaveTag() {
    if (!tagForm.nome.trim()) {
      toast.error('Digite um nome para a tag')
      return
    }
    setSavingTag(true)
    try {
      if (editingTag) {
        const { error } = await supabase
          .from('tags')
          .update({ nome: tagForm.nome.trim(), cor: tagForm.cor, ordem: tagForm.ordem })
          .eq('id', editingTag.id)
        if (error) throw error
        toast.success('Tag atualizada!')
      } else {
        const { error } = await supabase
          .from('tags')
          .insert({ nome: tagForm.nome.trim(), cor: tagForm.cor, ordem: tagForm.ordem, organizacao_id: colaborador?.organizacao_id })
        if (error) throw error
        toast.success('Tag criada!')
      }
      setEditingTag(null)
      setTagForm({ nome: '', cor: '#10b981', ordem: 0 })
      await fetchTags()
      mutate()
    } catch {
      toast.error('Erro ao salvar tag')
    } finally {
      setSavingTag(false)
    }
  }

  async function handleDeleteTag(tag: TagItem) {
    setDeletingTagId(tag.id)
    try {
      const { error } = await supabase.from('tags').delete().eq('id', tag.id)
      if (error) throw error
      toast.success('Tag excluida!')
      await fetchTags()
      mutate()
    } catch {
      toast.error('Erro ao excluir tag')
    } finally {
      setDeletingTagId(null)
    }
  }

  const isLoading = loadingColab || (colaborador && loadingSetores)
  const PreviewIcon = getIconComponent(newSetor.icon_url)

  // --- Sector Row (list view) ---
  function SetorRow({ setor, index }: { setor: Setor; index: number }) {
    const SetorIcon = getIconComponent(setor.icon_url)
    const setorColor = setor.cor || '#10b981'
    const isNavigating = navigatingTo === setor.id && isPending
    const activeCanais: Array<{ tipo: string; ativo: boolean }> =
      (setor.setor_canais ?? []).filter((c) => c.ativo)

    return (
      <motion.div
        key={setor.id}
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 12 }}
        transition={{ delay: index * 0.03, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        layout
      >
        <div
          className={cn(
            'group relative glass-card glass-shimmer-hover rounded-2xl overflow-hidden cursor-pointer',
            'active:scale-[0.995] transition-all duration-150',
            'border-l-[3px]',
            isNavigating && 'opacity-70 pointer-events-none'
          )}
          style={{ borderLeftColor: setorColor }}
          onClick={() => handleSetorClick(setor.id)}
          role="button"
          tabIndex={0}
          aria-label={`Acessar setor ${setor.nome}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleSetorClick(setor.id)
          }}
        >
          {/* Subtle color tint overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.02] group-hover:opacity-[0.05] transition-opacity duration-500"
            style={{ background: `linear-gradient(90deg, ${setorColor} 0%, transparent 40%)` }}
          />

          <div className="relative flex items-center gap-4 px-4 py-3.5 sm:px-5">
            {/* Icon */}
            <div
              className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl shadow-md"
              style={{
                backgroundColor: setorColor,
                boxShadow: `0 3px 12px ${hexToRgba(setorColor, 0.25)}`,
              }}
            >
              <SetorIcon className="h-5 w-5 text-white drop-shadow-sm" />
            </div>

            {/* Name + Description */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm leading-snug line-clamp-1 tracking-tight text-foreground/90">
                {setor.nome}
              </h3>
              {setor.descricao ? (
                <p className="text-xs text-muted-foreground/60 mt-0.5 line-clamp-1 leading-relaxed">
                  {setor.descricao}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground/30 mt-0.5 italic">Sem descricao</p>
              )}
            </div>

            {/* Tag badge */}
            <div className="hidden md:flex items-center shrink-0">
              {setor.tags ? (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold text-foreground/90"
                  style={{ backgroundColor: hexToRgba(setor.tags.cor, 0.6) }}
                >
                  <Tag className="h-2.5 w-2.5" />
                  {setor.tags.nome}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-foreground/5 text-muted-foreground/50">
                  Sem tag
                </span>
              )}
            </div>

            {/* Channel badges */}
            <div className="hidden lg:flex items-center gap-1.5 shrink-0">
              {activeCanais.length > 0 ? (
                activeCanais.map((canal, idx) => {
                  const cfg = CANAL_CONFIG[canal.tipo]
                  if (!cfg) return null
                  return (
                    <span
                      key={idx}
                      className="glass-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{ backgroundColor: cfg.bg, color: cfg.color }}
                    >
                      <span className="text-[9px]">{cfg.icon}</span>
                      {cfg.label}
                    </span>
                  )
                })
              ) : (
                <span className="text-[10px] text-muted-foreground/30 italic">Sem canal</span>
              )}
            </div>

            {/* Actions menu — somente master */}
            {colaborador?.is_master && (
              <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Acoes do setor ${setor.nome}`}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground/5 hover:bg-foreground/10 transition-colors"
                    >
                      <MoreVertical className="h-3.5 w-3.5 text-muted-foreground/80" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenuItem
                      className="text-red-400 focus:text-red-400"
                      onSelect={() => {
                        setDeleteSetorConfirmText('')
                        setDeleteSetorTarget(setor)
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir setor
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Navigation chevron */}
            <div
              className={cn(
                'shrink-0 h-7 w-7 rounded-lg flex items-center justify-center',
                'bg-foreground/5 group-hover:bg-foreground/10',
                'transition-all duration-300',
              )}
            >
              {isNavigating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground/60" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/80 group-hover:text-foreground/70 transition-colors" />
              )}
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header — title + action buttons */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10">
              <LayoutList className="h-4 w-4 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight brand-gradient-text">Setores</h1>
          </div>
          <p className="text-muted-foreground/70 text-sm ml-[42px]">
            Gerencie e acesse todos os setores da sua organizacao
          </p>
        </div>

        {colaborador?.is_master && (
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="gap-2 h-10 rounded-2xl btn-glow self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            Novo Setor
          </Button>
        )}
      </div>

      {/* Stats Strip */}
      {!isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-2 sm:grid-cols-3 gap-3"
        >
          <div className="glass-card rounded-2xl px-5 py-4 flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <Building2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground/90 tabular-nums">{stats.totalSetores}</p>
              <p className="text-[11px] text-muted-foreground/70 font-medium">Setores</p>
            </div>
          </div>
          <div className="glass-card rounded-2xl px-5 py-4 flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10">
              <Hash className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground/90 tabular-nums">{stats.totalTags}</p>
              <p className="text-[11px] text-muted-foreground/70 font-medium">Tags</p>
            </div>
          </div>
          <div className="glass-card rounded-2xl px-5 py-4 flex items-center gap-3.5 col-span-2 sm:col-span-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
              <Wifi className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground/90 tabular-nums">{stats.totalCanais}</p>
              <p className="text-[11px] text-muted-foreground/70 font-medium">Canais Ativos</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Filter / Search Bar */}
      <div className="glass-card rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            placeholder="Buscar setor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 rounded-xl glass-input text-sm placeholder:text-muted-foreground/50 border-foreground/8"
          />
        </div>

        {/* Tag filter chips */}
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <button
            type="button"
            onClick={() => setActiveTagFilter(null)}
            className={cn(
              'px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-200',
              activeTagFilter === null
                ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'
                : 'bg-foreground/5 text-muted-foreground/80 hover:bg-foreground/8 hover:text-foreground/60'
            )}
          >
            Todos
          </button>
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => setActiveTagFilter(activeTagFilter === tag.id ? null : tag.id)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-200',
                activeTagFilter === tag.id
                  ? 'text-white'
                  : 'text-muted-foreground hover:text-foreground/70'
              )}
              style={{
                backgroundColor: activeTagFilter === tag.id ? hexToRgba(tag.cor, 0.25) : 'rgba(255,255,255,0.04)',
                boxShadow: activeTagFilter === tag.id ? `0 0 0 1px ${hexToRgba(tag.cor, 0.4)}` : undefined,
              }}
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: tag.cor }}
              />
              {tag.nome}
            </button>
          ))}
          {(setores as Setor[]).some((s) => !s.tag_id) && (
            <button
              type="button"
              onClick={() => setActiveTagFilter(activeTagFilter === 'untagged' ? null : 'untagged')}
              className={cn(
                'px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-200',
                activeTagFilter === 'untagged'
                  ? 'bg-foreground/10 text-foreground/70 ring-1 ring-foreground/20'
                  : 'bg-foreground/5 text-muted-foreground/80 hover:bg-foreground/8 hover:text-foreground/60'
              )}
            >
              Sem Tag
            </button>
          )}

          {/* Spacer + Tags management button */}
          <div className="flex-1" />
          {colaborador?.is_master && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingTag(null)
                setTagForm({ nome: '', cor: '#10b981', ordem: 0 })
                setIsTagsDialogOpen(true)
              }}
              className="gap-1.5 h-8 rounded-xl text-muted-foreground/80 hover:text-foreground/70 hover:bg-foreground/5 text-xs"
            >
              <Tag className="h-3.5 w-3.5" />
              Gerenciar Tags
            </Button>
          )}
        </div>
      </div>

      {/* Content — List View */}
      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl px-5 py-4 flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-xl shrink-0 bg-foreground/5" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-36 bg-foreground/5" />
                <Skeleton className="h-3 w-56 bg-foreground/5" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full bg-foreground/5 hidden md:block" />
              <Skeleton className="h-6 w-20 rounded-full bg-foreground/5 hidden lg:block" />
              <Skeleton className="h-7 w-7 rounded-lg bg-foreground/5" />
            </div>
          ))}
        </div>
      ) : filteredSetores.length === 0 ? (
        <div className="glass-card-elevated rounded-2xl p-16">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl glass-card">
              <MessageCircle className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-semibold text-foreground/80">Nenhum setor encontrado</h3>
            <p className="mt-1.5 text-sm text-muted-foreground/70 max-w-xs">
              {searchTerm || activeTagFilter
                ? 'Nenhum setor corresponde aos filtros aplicados'
                : colaborador?.is_master
                  ? 'Crie seu primeiro setor para comecar a organizar seus atendimentos'
                  : 'Voce nao tem setores atribuidos no momento'}
            </p>
            {(searchTerm || activeTagFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm('')
                  setActiveTagFilter(null)
                }}
                className="mt-3 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-xl"
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </div>
      ) : activeTagFilter ? (
        /* Flat list (filtered by specific tag) */
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filteredSetores.map((setor, index) => (
              <SetorRow key={setor.id} setor={setor as Setor} index={index} />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        /* Grouped by tag */
        <div className="space-y-6">
          {groupedSetores.map((group, gi) => (
            <div key={group.tag?.id ?? 'sem-tag'}>
              {/* Group header */}
              <div className="flex items-center gap-3 mb-2.5">
                <div className="flex items-center gap-2">
                  {group.tag ? (
                    <>
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-foreground/90"
                        style={{ backgroundColor: hexToRgba(group.tag.cor, 0.5) }}
                      >
                        <Tag className="h-2.5 w-2.5" />
                        {group.tag.nome}
                      </span>
                      <span className="text-[11px] text-muted-foreground/40 tabular-nums">
                        {group.setores.length}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-foreground/5 text-muted-foreground/70">
                        <Tag className="h-2.5 w-2.5" />
                        Sem Tag
                      </span>
                      <span className="text-[11px] text-muted-foreground/40 tabular-nums">
                        {group.setores.length}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex-1 h-px bg-foreground/5" />
              </div>

              {/* Sector rows */}
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {group.setores.map((setor, index) => (
                    <SetorRow key={setor.id} setor={setor} index={index + gi * 4} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Setor Dialog — redesigned with 2-column layout */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="glass-card-elevated rounded-2xl max-w-2xl border-0">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl shadow-lg"
                style={{
                  backgroundColor: newSetor.cor,
                  boxShadow: `0 4px 16px ${hexToRgba(newSetor.cor, 0.3)}`,
                }}
              >
                <PreviewIcon className="h-5.5 w-5.5 text-white drop-shadow-sm" />
              </div>
              <div>
                <DialogTitle className="text-lg text-foreground/90">
                  {newSetor.nome || 'Novo Setor'}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground/70">
                  Preencha os dados abaixo para criar um novo setor
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Scrollable content area */}
          <div className="overflow-y-auto max-h-[65vh] -mx-6 px-6">
            <div className="space-y-5 pb-2">
              {/* Top fields: Name + Description + Tag */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome" className="text-foreground/60">Nome do Setor</Label>
                  <Input
                    id="nome"
                    value={newSetor.nome}
                    onChange={(e) => setNewSetor((prev) => ({ ...prev, nome: e.target.value }))}
                    placeholder="Ex: Suporte Tecnico"
                    className="rounded-xl glass-input"
                  />
                </div>

                {/* Tag selector */}
                {tags.length > 0 ? (
                  <div className="space-y-2">
                    <Label className="text-foreground/60">Tag</Label>
                    <Select
                      value={newSetor.tag_id || 'none'}
                      onValueChange={(v) => setNewSetor((prev) => ({ ...prev, tag_id: v === 'none' ? '' : v }))}
                    >
                      <SelectTrigger className="rounded-xl glass-input">
                        <SelectValue placeholder="Selecionar tag..." />
                      </SelectTrigger>
                      <SelectContent className="glass-dropdown rounded-xl border-foreground/8">
                        <SelectItem value="none">Sem tag</SelectItem>
                        {tags.map((tag) => (
                          <SelectItem key={tag.id} value={tag.id}>
                            <div className="flex items-center gap-2">
                              <span
                                className="h-3 w-3 rounded-full shrink-0"
                                style={{ backgroundColor: tag.cor }}
                              />
                              {tag.nome}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao" className="text-foreground/60">Descricao</Label>
                <Textarea
                  id="descricao"
                  value={newSetor.descricao}
                  onChange={(e) => setNewSetor((prev) => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Descricao do setor..."
                  rows={2}
                  className="rounded-xl glass-input"
                />
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />

              {/* 2-column: Color Picker + Icon Picker side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Color Picker */}
                <div className="space-y-2.5">
                  <Label className="text-foreground/60">Cor do Setor</Label>
                  <div className="glass-card rounded-xl p-3 border border-foreground/6">
                    <div className="grid grid-cols-5 gap-2.5">
                      {AVAILABLE_COLORS.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => setNewSetor((prev) => ({ ...prev, cor: color.value }))}
                          className={cn(
                            'h-8 w-8 rounded-full border-2 transition-all duration-200 mx-auto',
                            newSetor.cor === color.value
                              ? 'border-white scale-110 ring-2 ring-offset-2 ring-offset-[#06080f] ring-foreground/20'
                              : 'border-transparent hover:scale-110'
                          )}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Icon Picker */}
                <div className="space-y-2.5">
                  <Label className="text-foreground/60">Icone do Setor</Label>
                  <div className="glass-card rounded-xl p-3 border border-foreground/6">
                    <div className="grid grid-cols-6 gap-1.5">
                      {AVAILABLE_ICONS.map((iconItem) => (
                        <button
                          key={iconItem.name}
                          type="button"
                          onClick={() => setNewSetor((prev) => ({ ...prev, icon_url: iconItem.name }))}
                          className={cn(
                            'flex h-9 w-9 items-center justify-center rounded-lg border transition-all duration-200',
                            newSetor.icon_url === iconItem.name
                              ? 'border-emerald-500/60 bg-emerald-500/10 shadow-sm shadow-emerald-500/20'
                              : 'border-foreground/6 hover:border-emerald-500/30 hover:bg-foreground/5'
                          )}
                          title={iconItem.name}
                        >
                          <iconItem.icon className="h-4 w-4 text-foreground/60" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
              disabled={saving}
              className="rounded-xl border-foreground/10 hover:bg-foreground/5 text-foreground/60"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateSetor}
              disabled={saving || !newSetor.nome.trim()}
              className="rounded-xl btn-glow"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Criando...
                </>
              ) : (
                'Criar Setor'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tags Management Dialog */}
      <Dialog open={isTagsDialogOpen} onOpenChange={setIsTagsDialogOpen}>
        <DialogContent className="glass-card-elevated rounded-2xl max-w-md border-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg text-foreground/90">
              <Tag className="h-5 w-5 text-emerald-400" />
              Gerenciar Tags
            </DialogTitle>
            <DialogDescription className="text-muted-foreground/70">
              Crie tags para organizar e agrupar seus setores
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Tag form */}
            <div className="glass-card rounded-xl p-4 space-y-3 border border-foreground/8">
              <p className="text-sm font-medium text-foreground/70">
                {editingTag ? 'Editar Tag' : 'Nova Tag'}
              </p>
              <div className="flex gap-3">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="tag-nome" className="text-muted-foreground">Nome</Label>
                  <Input
                    id="tag-nome"
                    placeholder="Ex: Comercial, Suporte..."
                    value={tagForm.nome}
                    onChange={(e) => setTagForm((prev) => ({ ...prev, nome: e.target.value }))}
                    className="glass-input rounded-xl"
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveTag()}
                  />
                </div>
                <div className="w-20 space-y-2">
                  <Label htmlFor="tag-ordem" className="text-muted-foreground">Ordem</Label>
                  <Input
                    id="tag-ordem"
                    type="number"
                    min={0}
                    placeholder="0"
                    value={tagForm.ordem}
                    onChange={(e) =>
                      setTagForm((prev) => ({ ...prev, ordem: parseInt(e.target.value, 10) || 0 }))
                    }
                    className="glass-input rounded-xl text-center"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Cor</Label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setTagForm((prev) => ({ ...prev, cor: color.value }))}
                      className={cn(
                        'h-7 w-7 rounded-full border-2 transition-all duration-200',
                        tagForm.cor === color.value
                          ? 'border-white scale-110 ring-2 ring-offset-2 ring-offset-[#06080f] ring-foreground/20'
                          : 'border-transparent hover:scale-110'
                      )}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                {editingTag && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingTag(null)
                      setTagForm({ nome: '', cor: '#10b981', ordem: 0 })
                    }}
                    className="text-muted-foreground hover:text-foreground/70 hover:bg-foreground/5"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancelar
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleSaveTag}
                  disabled={savingTag || !tagForm.nome.trim()}
                  className="ml-auto btn-glow rounded-xl"
                >
                  {savingTag ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : editingTag ? (
                    'Salvar'
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Tags list */}
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {loadingTags ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                </div>
              ) : tags.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground/60">
                  <Tag className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma tag criada ainda</p>
                </div>
              ) : (
                tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-foreground/6 bg-foreground/3"
                  >
                    <span
                      className="h-4 w-4 rounded-full shrink-0 shadow-sm"
                      style={{
                        backgroundColor: tag.cor,
                        boxShadow: `0 0 8px ${hexToRgba(tag.cor, 0.3)}`,
                      }}
                    />
                    <span className="flex-1 text-sm font-medium text-foreground/70">{tag.nome}</span>
                    <span className="text-xs text-muted-foreground/50 tabular-nums w-8 text-center">
                      #{tag.ordem ?? 0}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:bg-foreground/5"
                        onClick={() => {
                          setEditingTag(tag)
                          setTagForm({ nome: tag.nome, cor: tag.cor, ordem: tag.ordem ?? 0 })
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground/80" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-400 hover:text-red-400 hover:bg-red-500/10"
                        disabled={deletingTagId === tag.id}
                        onClick={() => handleDeleteTag(tag)}
                      >
                        {deletingTagId === tag.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsTagsDialogOpen(false)}
              className="rounded-xl border-foreground/10 hover:bg-foreground/5 text-foreground/60"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Excluir Setor (somente master) */}
      <Dialog
        open={!!deleteSetorTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteSetorTarget(null)
            setDeleteSetorConfirmText('')
          }
        }}
      >
        <DialogContent className="glass-card-elevated rounded-2xl max-w-md border-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Excluir setor permanentemente
            </DialogTitle>
            <DialogDescription>
              Esta acao nao pode ser desfeita. Serao excluidos permanentemente:
            </DialogDescription>
          </DialogHeader>

          <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground/80 -mt-1">
            <li>Todos os atendentes vinculados a este setor</li>
            <li>Todas as pausas configuradas</li>
            <li>Todos os templates de mensagem</li>
            <li>Todos os canais conectados (incluindo WhatsApp)</li>
            <li>Configuracoes de distribuicao e transferencia</li>
          </ul>

          <div className="space-y-2">
            <Label htmlFor="confirm-delete-setor">
              Digite <strong className="text-red-400">{deleteSetorTarget?.nome}</strong> para confirmar:
            </Label>
            <Input
              id="confirm-delete-setor"
              placeholder="Nome do setor"
              value={deleteSetorConfirmText}
              onChange={(e) => setDeleteSetorConfirmText(e.target.value)}
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteSetorTarget(null)
                setDeleteSetorConfirmText('')
              }}
              disabled={deletingSetor}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSetor}
              disabled={
                deletingSetor ||
                deleteSetorConfirmText !== (deleteSetorTarget?.nome || '___')
              }
              className="rounded-xl gap-2"
            >
              {deletingSetor ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Excluir setor
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
