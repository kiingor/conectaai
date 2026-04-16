import { NextRequest } from 'next/server'
import { extractOrgIdFromAuth, getOpenAiKey, openAiErrorResponse } from '@/lib/openai-proxy'

export const runtime = 'nodejs'

/**
 * Lista estática no formato OpenAI — alguns clientes (SDKs, n8n) batem aqui no
 * init da credencial. Mantém a lista curta com os modelos que a gente libera
 * efetivamente no proxy.
 */
const MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4.1',
  'gpt-4.1-mini',
  'text-embedding-3-small',
  'text-embedding-3-large',
]

export async function GET(request: NextRequest) {
  const orgId = extractOrgIdFromAuth(request)
  if (!orgId) {
    return openAiErrorResponse(
      401,
      'Missing bearer token (expected organizacao_id).',
      'invalid_api_key',
    )
  }

  const apiKey = await getOpenAiKey(orgId)
  if (!apiKey) {
    return openAiErrorResponse(
      401,
      'Organização não encontrada ou sem openai_api_key configurada.',
      'invalid_api_key',
    )
  }

  const now = Math.floor(Date.now() / 1000)
  return Response.json({
    object: 'list',
    data: MODELS.map((id) => ({
      id,
      object: 'model',
      created: now,
      owned_by: 'conectaai-proxy',
    })),
  })
}
