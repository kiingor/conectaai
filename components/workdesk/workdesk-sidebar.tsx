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
  isOnline: boolean
  onStatusChange: (status: boolean) => void
}

function SidebarContent({
  onClose,
  colaboradorId,
  isOnline,
  onStatusChange,
}: {
  onClose?: () => void
  colaboradorId: string
  isOnline: boolean
  onStatusChange: (status: boolean) => void
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
      <div className="flex h-14 items-center justify-between border-b border-white/6 px-4">
        <Link href="/workdesk" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg brand-gradient shadow-lg shadow-emerald-500/20">
            <MessageCircle className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold brand-gradient-text">ConectaAI</span>
        </Link>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="lg:hidden text-white/40 hover:text-white/60 hover:bg-white/5"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Fechar menu</span>
          </Button>
        )}
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'glass-nav-active text-emerald-400'
                  : 'text-white/50 hover:text-white/70 glass-nav-hover'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeNavWorkdesk"
                  className="absolute inset-0 rounded-lg glass-nav-active"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              <item.icon className={cn(
                'relative z-10 h-4.5 w-4.5 transition-colors',
                isActive ? 'text-emerald-400' : 'text-white/40'
              )} />
              <span className="relative z-10">{item.name}</span>
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-white/6 p-3 space-y-3">
        {/* Disponibilidade Panel */}
        <div className="rounded-lg bg-white/3 p-3 border border-white/6">
          <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-2">Status</p>
          <DisponibilidadePanel
            colaboradorId={colaboradorId}
            isOnline={isOnline}
            onStatusChange={onStatusChange}
          />
        </div>

        {/* Logout Button */}
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-red-400/60 hover:bg-red-500/10 hover:text-red-400 rounded-lg"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </div>
  )
}

export function WorkdeskSidebar({
  open,
  onOpenChange,
  colaboradorId,
  isOnline,
  onStatusChange,
}: WorkdeskSidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 glass-panel lg:block">
        <SidebarContent
          colaboradorId={colaboradorId}
          isOnline={isOnline}
          onStatusChange={onStatusChange}
        />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-64 p-0 bg-[#06080f] border-r border-white/6">
          <SheetTitle className="sr-only">Menu de navegacao</SheetTitle>
          <SidebarContent
            onClose={() => onOpenChange(false)}
            colaboradorId={colaboradorId}
            isOnline={isOnline}
            onStatusChange={onStatusChange}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
