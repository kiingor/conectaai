"use client"

import { useRef } from "react"
import Link from "next/link"
import {
  MessageCircle,
  Sparkles,
  BarChart3,
  Users,
  Building2,
  Send,
  Zap,
  Clock,
  Bot,
  ArrowRight,
  Check,
  Menu,
  X,
} from "lucide-react"
import { motion, useInView } from "framer-motion"
import { useState } from "react"

/* ──────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────── */

function FadeIn({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }}
      transition={{ duration: 0.6, delay, ease: [0.23, 1, 0.32, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ──────────────────────────────────────────────
   Data
   ────────────────────────────────────────────── */

const features = [
  {
    icon: MessageCircle,
    title: "Atendimento via WhatsApp",
    description:
      "Centralize todas as conversas do WhatsApp em um unico painel. Responda rapido, organize filas e nunca perca uma mensagem.",
  },
  {
    icon: Sparkles,
    title: "IA Integrada",
    description:
      "Respostas automaticas inteligentes, sugestoes em tempo real e resumos de conversa gerados por IA.",
  },
  {
    icon: BarChart3,
    title: "Painel de Metricas",
    description:
      "Acompanhe tempo de resposta, volume de atendimentos, satisfacao do cliente e produtividade da equipe.",
  },
  {
    icon: Users,
    title: "Multi-atendentes",
    description:
      "Distribua conversas entre atendentes automaticamente. Gerencie permissoes e acompanhe cada membro.",
  },
  {
    icon: Building2,
    title: "Setores e Departamentos",
    description:
      "Organize sua equipe por setores. Direcione atendimentos para o departamento certo automaticamente.",
  },
  {
    icon: Send,
    title: "Disparos em Massa",
    description:
      "Envie mensagens para listas segmentadas de contatos. Ideal para campanhas, avisos e promocoes.",
  },
]

const steps = [
  {
    number: "01",
    title: "Conecte seu WhatsApp",
    description:
      "Escaneie o QR Code e em segundos seu WhatsApp esta integrado ao ConectaAI.",
  },
  {
    number: "02",
    title: "Configure a IA",
    description:
      "Defina respostas automaticas, fluxos de atendimento e treine a IA com a base de conhecimento da sua empresa.",
  },
  {
    number: "03",
    title: "Comece a atender",
    description:
      "Sua equipe ja pode atender com produtividade maxima. Acompanhe tudo pelo painel em tempo real.",
  },
]

const plans = [
  {
    name: "Basic",
    price: "97",
    description: "Para pequenos negocios que estao comecando.",
    features: [
      "1 numero de WhatsApp",
      "2 atendentes",
      "500 mensagens IA/mes",
      "Painel de metricas basico",
      "Suporte por e-mail",
    ],
    highlighted: false,
  },
  {
    name: "Pro",
    price: "247",
    description: "Para equipes em crescimento que precisam de mais.",
    features: [
      "3 numeros de WhatsApp",
      "10 atendentes",
      "5.000 mensagens IA/mes",
      "Metricas avancadas",
      "Setores ilimitados",
      "Disparos em massa",
      "Suporte prioritario",
    ],
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "497",
    description: "Para operacoes de grande escala com suporte dedicado.",
    features: [
      "Numeros ilimitados",
      "Atendentes ilimitados",
      "Mensagens IA ilimitadas",
      "API & Webhooks",
      "Integracao customizada",
      "SLA garantido",
      "Gerente de conta dedicado",
    ],
    highlighted: false,
  },
]

/* ──────────────────────────────────────────────
   Page Component
   ────────────────────────────────────────────── */

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="ambient-glow min-h-screen bg-[#06080f] text-white">
      {/* ── Navigation ─────────────────────────── */}
      <nav className="glass-header fixed top-0 z-50 w-full">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="brand-gradient flex h-8 w-8 items-center justify-center rounded-lg">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Conecta<span className="brand-gradient-text">AI</span>
            </span>
          </Link>

          {/* Desktop menu */}
          <div className="hidden items-center gap-8 md:flex">
            <a
              href="#features"
              className="text-sm text-white/60 transition-colors hover:text-white"
            >
              Funcionalidades
            </a>
            <a
              href="#como-funciona"
              className="text-sm text-white/60 transition-colors hover:text-white"
            >
              Como funciona
            </a>
            <a
              href="#precos"
              className="text-sm text-white/60 transition-colors hover:text-white"
            >
              Precos
            </a>
            <Link
              href="/login"
              className="btn-glow rounded-lg px-5 py-2 text-sm"
            >
              Entrar
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-white/70"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-dropdown md:hidden border-t border-white/5 px-4 py-4"
          >
            <div className="flex flex-col gap-4">
              <a
                href="#features"
                className="text-sm text-white/60 transition-colors hover:text-white"
                onClick={() => setMobileMenuOpen(false)}
              >
                Funcionalidades
              </a>
              <a
                href="#como-funciona"
                className="text-sm text-white/60 transition-colors hover:text-white"
                onClick={() => setMobileMenuOpen(false)}
              >
                Como funciona
              </a>
              <a
                href="#precos"
                className="text-sm text-white/60 transition-colors hover:text-white"
                onClick={() => setMobileMenuOpen(false)}
              >
                Precos
              </a>
              <Link
                href="/login"
                className="btn-glow rounded-lg px-5 py-2 text-center text-sm"
              >
                Entrar
              </Link>
            </div>
          </motion.div>
        )}
      </nav>

      {/* ── Hero ───────────────────────────────── */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 pt-20">
        {/* Extra ambient orbs */}
        <div className="pointer-events-none absolute left-1/4 top-1/3 h-[500px] w-[500px] rounded-full bg-emerald-500/5 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-cyan-500/5 blur-[100px]" />

        <div className="relative z-10 mx-auto max-w-7xl text-center">
          <FadeIn>
            <div className="glass-badge mb-6 inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm text-white/70">
              <Bot className="h-4 w-4 text-emerald-400" />
              Plataforma de atendimento com IA
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <h1 className="mx-auto max-w-4xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              Atendimento inteligente via WhatsApp{" "}
              <span className="brand-gradient-text">com IA</span>
            </h1>
          </FadeIn>

          <FadeIn delay={0.2}>
            <p className="mx-auto mt-6 max-w-2xl text-base text-white/50 sm:text-lg md:text-xl">
              Automatize seu suporte, encante seus clientes e escale seu
              atendimento com inteligencia artificial integrada ao WhatsApp.
            </p>
          </FadeIn>

          <FadeIn delay={0.3}>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/login"
                className="btn-glow inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-base font-semibold"
              >
                Comece Gratis
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#como-funciona"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-8 py-3.5 text-base font-semibold text-white/80 transition-all hover:border-white/20 hover:bg-white/5"
              >
                Ver Demo
              </a>
            </div>
          </FadeIn>

          {/* Floating glass cards */}
          <FadeIn delay={0.5}>
            <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
              <div className="glass-card rounded-2xl p-5 text-left">
                <div className="mb-3 flex items-center gap-3">
                  <div className="brand-gradient flex h-10 w-10 items-center justify-center rounded-xl">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-white/90">
                    Tempo de Resposta
                  </span>
                </div>
                <p className="text-2xl font-bold brand-gradient-text">
                  &lt; 30s
                </p>
                <p className="mt-1 text-xs text-white/40">
                  Tempo medio de primeira resposta com IA
                </p>
              </div>

              <div className="glass-card rounded-2xl p-5 text-left">
                <div className="mb-3 flex items-center gap-3">
                  <div className="brand-gradient flex h-10 w-10 items-center justify-center rounded-xl">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-white/90">
                    Respostas com IA
                  </span>
                </div>
                <p className="text-2xl font-bold brand-gradient-text">85%</p>
                <p className="mt-1 text-xs text-white/40">
                  Das perguntas respondidas automaticamente
                </p>
              </div>

              <div className="glass-card rounded-2xl p-5 text-left">
                <div className="mb-3 flex items-center gap-3">
                  <div className="brand-gradient flex h-10 w-10 items-center justify-center rounded-xl">
                    <MessageCircle className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-white/90">
                    Multi-canal
                  </span>
                </div>
                <p className="text-2xl font-bold brand-gradient-text">
                  WhatsApp
                </p>
                <p className="mt-1 text-xs text-white/40">
                  Atendimento unificado num so painel
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Features ───────────────────────────── */}
      <section id="features" className="relative z-10 px-4 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl">
          <FadeIn>
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Tudo que voce precisa para{" "}
                <span className="brand-gradient-text">atender melhor</span>
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base text-white/50 sm:text-lg">
                Funcionalidades poderosas para transformar o atendimento da sua
                empresa.
              </p>
            </div>
          </FadeIn>

          <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <FadeIn key={feature.title} delay={i * 0.08}>
                <div className="glass-card group relative rounded-2xl p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/15 to-cyan-500/15 transition-colors group-hover:from-emerald-500/25 group-hover:to-cyan-500/25">
                    <feature.icon className="h-6 w-6 text-emerald-400" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-white/50">
                    {feature.description}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it Works ───────────────────────── */}
      <section
        id="como-funciona"
        className="relative z-10 px-4 py-24 sm:py-32"
      >
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Como{" "}
                <span className="brand-gradient-text">funciona</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base text-white/50 sm:text-lg">
                Comece em minutos. Sem instalacao complicada.
              </p>
            </div>
          </FadeIn>

          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
            {steps.map((step, i) => (
              <FadeIn key={step.number} delay={i * 0.15}>
                <div className="relative text-center">
                  {/* Numbered circle */}
                  <div className="brand-gradient mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white shadow-lg shadow-emerald-500/20">
                    {step.number}
                  </div>

                  {/* Connector line (desktop only) */}
                  {i < steps.length - 1 && (
                    <div className="absolute left-[calc(50%+40px)] top-8 hidden h-px w-[calc(100%-80px)] bg-gradient-to-r from-emerald-500/30 to-cyan-500/30 md:block" />
                  )}

                  <h3 className="mb-3 text-lg font-semibold">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-white/50">
                    {step.description}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────── */}
      <section id="precos" className="relative z-10 px-4 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl">
          <FadeIn>
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Planos que{" "}
                <span className="brand-gradient-text">cabem no seu bolso</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base text-white/50 sm:text-lg">
                Escolha o plano ideal para o tamanho da sua operacao.
              </p>
            </div>
          </FadeIn>

          <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
            {plans.map((plan, i) => (
              <FadeIn key={plan.name} delay={i * 0.12}>
                <div
                  className={`relative rounded-2xl p-7 ${
                    plan.highlighted
                      ? "glass-card-elevated gradient-border"
                      : "glass-card"
                  }`}
                >
                  {plan.highlighted && (
                    <div className="brand-gradient absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-semibold text-white">
                      Mais popular
                    </div>
                  )}

                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="mt-1 text-sm text-white/40">
                    {plan.description}
                  </p>

                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-sm text-white/50">R$</span>
                    <span className="text-4xl font-extrabold tracking-tight">
                      {plan.price}
                    </span>
                    <span className="text-sm text-white/40">/mes</span>
                  </div>

                  <ul className="mt-6 space-y-3">
                    {plan.features.map((feat) => (
                      <li
                        key={feat}
                        className="flex items-start gap-2 text-sm text-white/60"
                      >
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        {feat}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/login"
                    className={`mt-8 block w-full rounded-xl py-3 text-center text-sm font-semibold transition-all ${
                      plan.highlighted
                        ? "btn-glow"
                        : "border border-white/10 text-white/80 hover:border-white/20 hover:bg-white/5"
                    }`}
                  >
                    Comece agora
                  </Link>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────── */}
      <section className="relative z-10 px-4 py-24 sm:py-32">
        <FadeIn>
          <div className="glass-card-elevated mx-auto max-w-3xl rounded-3xl p-10 text-center sm:p-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Comece a transformar seu{" "}
              <span className="brand-gradient-text">atendimento</span>
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base text-white/50">
              Junte-se a centenas de empresas que ja automatizaram o suporte com
              IA e encantam clientes todos os dias.
            </p>
            <Link
              href="/login"
              className="btn-glow mt-8 inline-flex items-center gap-2 rounded-xl px-10 py-4 text-base font-semibold"
            >
              Comece Gratis
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </FadeIn>
      </section>

      {/* ── Footer ─────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/5 px-4 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="brand-gradient flex h-7 w-7 items-center justify-center rounded-lg">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold tracking-tight">
              Conecta<span className="brand-gradient-text">AI</span>
            </span>
          </div>

          <div className="flex items-center gap-6 text-sm text-white/40">
            <a
              href="#features"
              className="transition-colors hover:text-white/70"
            >
              Funcionalidades
            </a>
            <a
              href="#como-funciona"
              className="transition-colors hover:text-white/70"
            >
              Como funciona
            </a>
            <a
              href="#precos"
              className="transition-colors hover:text-white/70"
            >
              Precos
            </a>
          </div>

          <p className="text-xs text-white/30">
            &copy; {new Date().getFullYear()} ConectaAI. Todos os direitos
            reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}
