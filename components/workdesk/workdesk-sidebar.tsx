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
  colaboradorNome?: string
  colaboradorEmail?: string
  isOnline: boolean
  onStatusChange: (status: boolean) => void
  setorIds?: string[]
}

function MobileDrawerContent({
  onClose,
  colaboradorId,
  colaboradorNome,
  colaboradorEmail,
  isOnline,
  onStatusChange,
  setorIds = [],
}: {
  onClose: () => void
  colaboradorId: string
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
    <div className="flex h-full flex-col bg-[#06080f]">
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
          className="text-white/30 hover:text-white/50 hover:bg-white/5 rounded-full h-8 w-8"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar menu</span>
        </Button>
      </div>

      {/* User info card */}
      {colaboradorNome && (
        <div className="mx-4 mb-4 flex items-center gap-3 rounded-xl bg-white/[0.03] p-3 border border-white/[0.06]">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
            <User className="h-4.5 w-4.5 text-white/50" />
            <div className={cn(
              'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#06080f]',
              isOnline ? 'status-dot-online' : 'bg-white/25'
            )} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white/80 truncate">{colaboradorNome}</p>
            {colaboradorEmail && (
              <p className="text-[11px] text-white/30 truncate">{colaboradorEmail}</p>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        <p className="px-3 pb-1.5 text-[10px] font-semibold text-white/20 uppercase tracking-widest">Menu</p>
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
                  : 'text-white/40 hover:text-white/60 hover:bg-white/[0.03]'
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
                isActive ? 'text-emerald-400' : 'text-white/30'
              )} />
              <span className="relative z-10">{item.name}</span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom section: status + logout */}
      <div className="p-4 space-y-3">
        {/* Status panel */}
        <div className="rounded-xl bg-white/[0.03] p-3 border border-white/[0.06]">
          <p className="text-[10px] font-semibold text-white/20 uppercase tracking-widest mb-2.5">Status</p>
          <DisponibilidadePanel
            colaboradorId={colaboradorId}
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
        <SheetContent side="left" className="w-72 p-0 bg-[#06080f] border-r border-white/[0.06]">
          <SheetTitle className="sr-only">Menu de navegacao</SheetTitle>
          <MobileDrawerContent
            onClose={() => onOpenChange(false)}
            colaboradorId={colaboradorId}
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
