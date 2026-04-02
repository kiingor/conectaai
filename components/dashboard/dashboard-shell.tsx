'use client'

import React from "react"

import type { User } from '@supabase/supabase-js'
import { useState } from 'react'
import { DashboardSidebar } from './dashboard-sidebar'
import { DashboardHeader } from './dashboard-header'

interface DashboardShellProps {
  children: React.ReactNode
  user: User
}

export function DashboardShell({ children, user }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <>
      {/* Fixed dark background */}
      <div className="fixed inset-0 -z-20" style={{ backgroundColor: '#06080f' }} />

      {/* Sidebar — fixed via glass-panel */}
      <DashboardSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />

      {/* Main content area with ambient glow */}
      <div className="flex min-h-screen flex-col lg:pl-64 ambient-glow">
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="relative z-10 flex-1 px-6 py-8 lg:px-10">
          {children}
        </main>
      </div>
    </>
  )
}
