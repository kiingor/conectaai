'use client'

import React from "react"

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import {
  Building2,
  BarChart3,
  X,
  UserCog,
  Loader2,
  Activity,
  Zap,
  Brain,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { motion } from 'framer-motion'
import { useColaborador } from '@/lib/hooks/use-data'

const baseNavigation = [
  { name: 'Monitoramento', href: '/dashboard/monitoramento', icon: Activity },
  { name: 'Dashboard Geral', href: '/dashboard/metricas', icon: BarChart3 },
  { name: 'Configuracoes de IA', href: '/dashboard/ia-config', icon: Brain },
]

const masterNavigationEnd = [
  { name: 'Usuarios', href: '/dashboard/usuarios', icon: UserCog },
]

interface DashboardSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function SidebarContent({ onClose, collapsed }: { onClose?: () => void; collapsed?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [loadingHref, setLoadingHref] = useState<string | null>(null)
  const { data: colaborador } = useColaborador()

  const menuNavigation = colaborador?.is_master
    ? [
        { name: 'Setores', href: '/dashboard', icon: Building2 },
        ...baseNavigation,
      ]
    : baseNavigation

  const adminNavigation = colaborador?.is_master ? masterNavigationEnd : []

  const handleNavClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault()
    if (pathname === href) return
    setLoadingHref(href)
    onClose?.()
    startTransition(() => {
      router.push(href)
    })
  }

  const renderNavItem = (item: { name: string; href: string; icon: React.ComponentType<{ className?: string }> }) => {
    const isActive = pathname === item.href || (item.href === '/dashboard' && pathname.startsWith('/setor/'))
    const isLoading = loadingHref === item.href && isPending
    return (
      <a
        key={item.name}
        href={item.href}
        onClick={(e) => handleNavClick(e, item.href)}
        title={collapsed ? item.name : undefined}
        className={cn(
          'group/item relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all cursor-pointer select-none active:scale-[0.97]',
          collapsed && 'justify-center px-0',
          isActive
            ? 'text-white'
            : 'text-muted-foreground glass-nav-hover hover:text-foreground/80',
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
            'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-300',
            isActive
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'text-muted-foreground/80 group-hover/item:text-foreground/70'
          )}
        >
          {isLoading ? (
            <Loader2 className="h-[18px] w-[18px] animate-spin" />
          ) : (
            <item.icon className="h-[18px] w-[18px]" />
          )}
        </div>

        {!collapsed && (
          <span className="relative z-10 flex-1 whitespace-nowrap">{item.name}</span>
        )}

        {isActive && !collapsed && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="relative z-10 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50"
          />
        )}
      </a>
    )
  }

  return (
    <div className="flex h-full flex-col relative z-10">
      {/* Brand Section */}
      <div className={cn('flex h-16 items-center justify-between', collapsed ? 'px-0 justify-center' : 'px-5')}>
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl brand-gradient shadow-lg shadow-emerald-500/20 transition-transform duration-300 group-hover:scale-105">
            <Zap className="h-5 w-5 text-white drop-shadow-sm" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold brand-gradient-text tracking-tight text-base leading-tight whitespace-nowrap">
                ConectaAI
              </span>
              <span className="text-[10px] text-muted-foreground/60 font-medium tracking-wide uppercase whitespace-nowrap">
                Gestao de atendimento
              </span>
            </div>
          )}
        </Link>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="lg:hidden rounded-xl hover:bg-foreground/5 transition-colors"
          >
            <X className="h-5 w-5 text-foreground/60" />
            <span className="sr-only">Fechar menu</span>
          </Button>
        )}
      </div>

      {/* Separator */}
      <div className={cn('h-px bg-foreground/6', collapsed ? 'mx-3' : 'mx-5')} />

      {/* Navigation */}
      <nav className={cn('flex-1 space-y-1 py-4', collapsed ? 'px-2' : 'px-3')}>
        {!collapsed && (
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            Menu
          </p>
        )}
        {menuNavigation.map(renderNavItem)}

        {adminNavigation.length > 0 && (
          <>
            <div className={cn('my-3 h-px bg-foreground/6', collapsed ? 'mx-1' : 'mx-3')} />
            {!collapsed && (
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Admin
              </p>
            )}
            {adminNavigation.map(renderNavItem)}
          </>
        )}
      </nav>
    </div>
  )
}

export function DashboardSidebar({ open, onOpenChange }: DashboardSidebarProps) {
  return (
    <>
      {/* Desktop sidebar - collapsed by default, expands on hover */}
      <aside
        className="group/sidebar inset-y-0 left-0 z-50 hidden lg:block glass-panel transition-all duration-300 ease-in-out w-[72px] hover:w-64 overflow-hidden"
        style={{ position: 'fixed', top: 0, bottom: 0, left: 0 }}
      >
        {/* Collapsed content (icon-only) - visible by default, hidden on hover */}
        <div className="absolute inset-0 group-hover/sidebar:opacity-0 group-hover/sidebar:pointer-events-none transition-opacity duration-300">
          <SidebarContent collapsed />
        </div>
        {/* Expanded content (icon+text) - hidden by default, visible on hover */}
        <div className="absolute inset-0 opacity-0 pointer-events-none group-hover/sidebar:opacity-100 group-hover/sidebar:pointer-events-auto transition-opacity duration-300">
          <SidebarContent />
        </div>
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
