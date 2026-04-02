import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ConectaAI API - Documentacao',
  description: 'Documentacao da API do painel de atendimentos ConectaAI',
}

export default function DocLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#06080f] text-gray-100">
      {children}
    </div>
  )
}
