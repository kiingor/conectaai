import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Helpers compartilhados entre as rotas `/api/llm/openai/v1/*` que atuam como
 * proxy OpenAI-compatible. O cliente (ex: n8n) manda o `organizacao_id` no
 * header `Authorization: Bearer <uuid>`; nós trocamos pela `openai_api_key`
 * real da organização antes de chamar `api.openai.com`.
 */

export function extractOrgIdFromAuth(request: NextRequest | Request): string | null {
  const header = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!header) return null
  const match = header.match(/^Bearer\s+(.+)$/i)
  if (!match) return null
  const token = match[1].trim()
  return token || null
}

export async function getOpenAiKey(orgId: string): Promise<string | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('organizacoes')
    .select('openai_api_key')
    .eq('id', orgId)
    .maybeSingle()
  if (error || !data?.openai_api_key) return null
  return data.openai_api_key as string
}

/**
 * Resposta de erro no formato exato da OpenAI, pra clients (n8n, SDKs) tratarem
 * igualzinho ao erro real.
 */
export function openAiErrorResponse(
  status: number,
  message: string,
  code: string,
  type = 'invalid_request_error',
): Response {
  return new Response(
    JSON.stringify({ error: { message, type, code, param: null } }),
    {
      status,
      headers: { 'content-type': 'application/json' },
    },
  )
}

/**
 * Detecta `"stream": true` no body sem precisar parsear JSON inteiro.
 * Evita re-serializar o body (preserva bytes originais).
 */
export function isStreamRequest(body: string): boolean {
  return /"stream"\s*:\s*true/.test(body)
}
