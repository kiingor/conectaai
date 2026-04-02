'use client'

import React from "react"

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import {
  Building2,
  BarChart3,
  MessageCircle,
  X,
  UserCog,
  Loader2,
  Activity,
  HelpCircle,
  ExternalLink,
  Bug,
  Briefcase,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { motion } from 'framer-motion'
import { useColaborador } from '@/lib/hooks/use-data'

const baseNavigation = [
  { name: 'Empresa', href: '/dashboard/empresa', icon: Briefcase },
  { name: 'Monitoramento', href: '/dashboard/monitoramento', icon: Activity },
  { name: 'Dashboard Geral', href: '/dashboard/metricas', icon: BarChart3 },
]

const masterNavigation = [
  { name: 'Organizações', href: '/dashboard', icon: Building2 },
  { name: 'Usuarios Master', href: '/dashboard/usuarios', icon: UserCog },
  { name: 'Logs de Erros', href: '/dashboard/logs', icon: Bug },
]

interface DashboardSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [loadingHref, setLoadingHref] = useState<string | null>(null)
  const { data: colaborador } = useColaborador()

  const navigation = colaborador?.is_master
    ? [...baseNavigation, ...masterNavigation]
    : baseNavigation

  const handleNavClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault()
    if (pathname === href) return
    setLoadingHref(href)
    onClose?.()
    startTransition(() => {
      router.push(href)
    })
  }

  return (
    <div className="flex h-full flex-col relative z-10">
      {/* Brand Section */}
      <div className="flex h-16 items-center justify-between px-5">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl brand-gradient shadow-lg shadow-emerald-500/20 transition-transform duration-300 group-hover:scale-105">
            <Zap className="h-5 w-5 text-white drop-shadow-sm" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold brand-gradient-text tracking-tight text-base leading-tight">
              ConectaAI
            </span>
            <span className="text-[10px] text-white/30 font-medium tracking-wide uppercase">
              Gestao de atendimento
            </span>
          </div>
        </Link>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="lg:hidden rounded-xl hover:bg-white/5 transition-colors"
          >
            <X className="h-5 w-5 text-white/60" />
            <span className="sr-only">Fechar menu</span>
          </Button>
        )}
      </div>

      {/* Separator */}
      <div className="mx-5 h-px bg-white/6" />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/25">
          Menu
        </p>
        {navigation.map((item) => {
          const isActive = pathname === item.href || (item.href === '/dashboard/empresa' && pathname.startsWith('/setor/'))
          const isLoading = loadingHref === item.href && isPending
          return (
            <a
              key={item.name}
              href={item.href}
              onClick={(e) => handleNavClick(e, item.href)}
              className={cn(
                'group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all cursor-pointer select-none active:scale-[0.97]',
                isActive
                  ? 'text-white'
                  : 'text-white/45 glass-nav-hover hover:text-white/80',
                isLoading && 'opacity-70'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute inset-0 rounded-2xl glass-nav-active"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}

              <div
                className={cn(
                  'relative z-10 flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-300',
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'text-white/40 group-hover:text-white/70'
                )}
              >
                {isLoading ? (
                  <Loader2 className="h-[18px] w-[18px] animate-spin" />
                ) : (
                  <item.icon className="h-[18px] w-[18px]" />
                )}
              </div>

              <span className="relative z-10 flex-1">{item.name}</span>

              {isActive && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="relative z-10 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50"
                />
              )}
            </a>
          )
        })}
      </nav>

      {/* Separator */}
      <div className="mx-5 h-px bg-white/6" />

      {/* Footer - Support Card */}
      <div className="p-4">
        <div className="glass-card-elevated rounded-2xl p-4 overflow-hidden">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
              <HelpCircle className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white/90">
                Precisa de ajuda?
              </p>
              <p className="mt-0.5 text-[11px] text-white/35 leading-relaxed">
                Acesse nossa central de suporte
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-3 h-8 rounded-xl text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 gap-1.5"
          >
            Central de Ajuda
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function DashboardSidebar({ open, onOpenChange }: DashboardSidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="inset-y-0 left-0 z-50 hidden w-64 lg:block glass-panel"
        style={{ position: 'fixed', top: 0, bottom: 0, left: 0, width: '16rem' }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-72 p-0 glass-panel border-r-0">
          <SheetTitle className="sr-only">Menu de navegacao</SheetTitle>
          <SidebarContent onClose={() => onOpenChange(false)} />
        </SheetContent>
      </Sheet>
    </>
  )
}
