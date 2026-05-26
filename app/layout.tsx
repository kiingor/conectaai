import React from "react"
import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/toaster'
import { ErrorBoundary } from '@/components/error-boundary'
import { GlobalErrorHandler } from '@/components/global-error-handler'
import './globals.css'

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: 'ConectaAI — Atendimento Inteligente via WhatsApp',
  description: 'Plataforma SaaS de atendimento multicanal com IA. Automatize seu suporte via WhatsApp com inteligencia artificial.',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
}

const themeScript = `
(() => {
  try {
    const theme = localStorage.getItem('theme') || 'system';
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && systemDark));
  } catch (_) {}
})();
`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`} suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ErrorBoundary tela="Global">
          {children}
        </ErrorBoundary>
        <GlobalErrorHandler />
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
