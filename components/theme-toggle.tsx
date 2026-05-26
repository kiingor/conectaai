'use client'

import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Theme = 'light' | 'dark' | 'system'

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('theme') as Theme | null
    if (stored) {
      setTheme(stored)
      applyTheme(stored)
    } else {
      applyTheme('system')
    }
  }, [])

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement
    
    if (newTheme === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', systemDark)
    } else {
      root.classList.toggle('dark', newTheme === 'dark')
    }
  }

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    applyTheme(newTheme)
  }

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => applyTheme('system')
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-foreground/5">
        <Sun className="h-4 w-4" />
      </Button>
    )
  }

  const CurrentIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-foreground/5"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <CurrentIcon className="h-4 w-4" />
        <span className="sr-only">Alternar tema</span>
      </Button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-36 rounded-xl glass-dropdown p-1.5 shadow-lg" role="menu">
          {[
            { value: 'light' as const, label: 'Claro', icon: Sun },
            { value: 'dark' as const, label: 'Escuro', icon: Moon },
            { value: 'system' as const, label: 'Sistema', icon: Monitor },
          ].map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.value}
                type="button"
                role="menuitem"
                onClick={() => {
                  handleThemeChange(item.value)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-foreground/80 transition-colors hover:bg-foreground/5"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                {item.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
