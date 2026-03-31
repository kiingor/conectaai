import { createServiceClient } from '@/lib/supabase/service'
import { type NextRequest } from 'next/server'

export const ORG_ID_HEADER = 'x-org-id'
export const ORG_ID_COOKIE = 'org_id'

/**
 * Extrai o slug do subdomínio a partir do hostname.
 * "empresa1.softcomhub.com" → "empresa1"
 * "softcomhub.com" (sem subdomínio) → null
 * "localhost" → null
 * "empresa1.localhost" → "empresa1" (dev local)
 */
export function extractSlugFromHost(host: string): string | null {
  // Remove porta
  const hostname = host.split(':')[0]

  // Localhost puro sem subdomínio
  if (hostname === 'localhost' || hostname === '127.0.0.1') return null

  const parts = hostname.split('.')

  // Dev local: empresa1.localhost → 2 partes
  if (parts.length === 2 && parts[1] === 'localhost') {
    return parts[0] !== 'www' ? parts[0] : null
  }

  // Ignorar domínios de plataforma (Vercel, etc.)
  const rootDomain = parts.slice(-2).join('.')
  const ignoredDomains = ['vercel.app', 'vercel-dns.com', 'now.sh']
  if (ignoredDomains.includes(rootDomain)) return null

  // Produção: empresa1.softcomhub.com → 3+ partes, slug é parts[0]
  if (parts.length >= 3 && parts[0] !== 'www') {
    return parts[0]
  }

  return null
}

/**
 * Resolve organizacao_id a partir de um slug consultando o banco.
 * Retorna null se não encontrado ou org inativa.
 */
export async function resolveOrgBySlug(slug: string): Promise<string | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('organizacoes')
    .select('id')
    .eq('slug', slug)
    .eq('ativo', true)
    .maybeSingle()
  return data?.id ?? null
}

/**
 * Resolve organizacao_id a partir de um phoneNumberId ou instância Evolution.
 * Usado pelos webhooks externos (WhatsApp/Evolution) que chegam sem subdomínio.
 */
export async function resolveOrgByPhoneNumberId(
  phoneNumberId: string
): Promise<string | null> {
  const supabase = createServiceClient()

  // 1. Tenta via phone_number_id (WhatsApp Cloud API)
  const { data: byPhone } = await supabase
    .from('setor_canais')
    .select('organizacao_id')
    .eq('phone_number_id', phoneNumberId)
    .eq('ativo', true)
    .limit(1)
    .maybeSingle()

  if (byPhone?.organizacao_id) return byPhone.organizacao_id

  // 2. Tenta via instância Evolution
  const { data: byInstance } = await supabase
    .from('setor_canais')
    .select('organizacao_id')
    .eq('instancia', phoneNumberId)
    .eq('tipo', 'evolution_api')
    .eq('ativo', true)
    .limit(1)
    .maybeSingle()

  if (byInstance?.organizacao_id) return byInstance.organizacao_id

  // 3. Fallback: tenta via setores.phone_number_id (campo legado)
  const { data: bySetor } = await supabase
    .from('setores')
    .select('organizacao_id')
    .eq('phone_number_id', phoneNumberId)
    .limit(1)
    .maybeSingle()

  return bySetor?.organizacao_id ?? null
}

/**
 * Lê o organizacao_id que foi injetado pelo middleware no header da request.
 * Para uso nas API routes server-side.
 */
export function getOrgIdFromRequest(request: NextRequest | Request): string | null {
  return (request.headers as Headers).get(ORG_ID_HEADER)
}
