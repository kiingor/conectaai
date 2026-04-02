'use client'

import { ReactNode } from 'react'

export default function SetorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#06080f]">
      {children}
    </div>
  )
}
