'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  Ticket,
  LogOut,
  MessageCircle,
  X,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { motion } from 'framer-motion'
import { DisponibilidadePanel } from '@/components/workdesk/disponibilidade-panel'

const navigation = [
  { name: 'Meus Tickets', href: '/workdesk', icon: Ticket },
]

interface WorkdeskSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  colaboradorId: string
  organizacaoId?: string | null
  colaboradorNome?: string
  colaboradorEmail?: string
  isOnline: boolean
  onStatusChange: (status: boolean) => void
  setorIds?: string[]
}

function MobileDrawerContent({
  onClose,
  colaboradorId,
  organizacaoId,
  colaboradorNome,
  colaboradorEmail,
  isOnline,
  onStatusChange,
  setorIds = [],
}: {
  onClose: () => void
  colaboradorId: string
  organizacaoId?: string | null
  colaboradorNome?: string
  colaboradorEmail?: string
  isOnline: boolean
  onStatusChange: (status: boolean) => void
  setorIds?: string[]
}) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase
      .from('colaboradores')
      .update({ is_online: false })
      .eq('id', colaboradorId)
    await supabase.auth.signOut()
    router.push('/workdesk/login')
  }

  return (
    <div className="flex h-full flex-col bg-page-bg">
      {/* Header with logo and close */}
      <div className="flex h-16 items-center justify-between px-5">
        <Link href="/workdesk" className="flex items-center gap-3" onClick={onClose}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl brand-gradient shadow-lg shadow-emerald-500/20">
            <MessageCircle className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="text-sm font-bold brand-gradient-text tracking-tight">ConectaAI</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-muted-foreground/60 hover:text-muted-foreground hover:bg-foreground/5 rounded-full h-8 w-8"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar menu</span>
        </Button>
      </div>

      {/* User info card */}
      {colaboradorNome && (
        <div className="mx-4 mb-4 flex items-center gap-3 rounded-xl bg-foreground/[0.03] p-3 border border-foreground/[0.06]">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-foreground/5 ring-1 ring-foreground/10">
            <User className="h-4.5 w-4.5 text-muted-foreground" />
            <div className={cn(
              'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#06080f]',
              isOnline ? 'status-dot-online' : 'bg-muted-foreground/50'
            )} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground/80 truncate">{colaboradorNome}</p>
            {colaboradorEmail && (
              <p className="text-[11px] text-muted-foreground/60 truncate">{colaboradorEmail}</p>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        <p className="px-3 pb-1.5 text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest">Menu</p>
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className={cn(
                'group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all',
                isActive
                  ? 'glass-nav-active text-emerald-400'
                  : 'text-muted-foreground/80 hover:text-foreground/60 hover:bg-foreground/[0.03]'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeNavWorkdeskMobile"
                  className="absolute inset-0 rounded-xl glass-nav-active"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              <item.icon className={cn(
                'relative z-10 h-4.5 w-4.5 transition-colors',
                isActive ? 'text-emerald-400' : 'text-muted-foreground/60'
              )} />
              <span className="relative z-10">{item.name}</span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom section: status + logout */}
      <div className="p-4 space-y-3">
        {/* Status panel */}
        <div className="rounded-xl bg-foreground/[0.03] p-3 border border-foreground/[0.06]">
          <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest mb-2.5">Status</p>
          <DisponibilidadePanel
            colaboradorId={colaboradorId}
            organizacaoId={organizacaoId}
            isOnline={isOnline}
            onStatusChange={onStatusChange}
            setorIds={setorIds}
          />
        </div>

        {/* Logout */}
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-red-400/40 hover:bg-red-500/8 hover:text-red-400 rounded-xl h-11"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          <span className="text-sm">Sair</span>
        </Button>
      </div>
    </div>
  )
}

export function WorkdeskSidebar({
  open,
  onOpenChange,
  colaboradorId,
  organizacaoId,
  colaboradorNome,
  colaboradorEmail,
  isOnline,
  onStatusChange,
  setorIds = [],
}: WorkdeskSidebarProps) {
  return (
    <>
      {/* Mobile-only drawer (desktop uses vertical icon bar in layout) */}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-72 p-0 bg-page-bg border-r border-foreground/[0.06]">
          <SheetTitle className="sr-only">Menu de navegacao</SheetTitle>
          <MobileDrawerContent
            onClose={() => onOpenChange(false)}
            colaboradorId={colaboradorId}
            organizacaoId={organizacaoId}
            colaboradorNome={colaboradorNome}
            colaboradorEmail={colaboradorEmail}
            isOnline={isOnline}
            onStatusChange={onStatusChange}
            setorIds={setorIds}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
