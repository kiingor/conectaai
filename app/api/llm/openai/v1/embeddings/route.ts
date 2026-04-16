import { NextRequest } from 'next/server'
import {
  extractOrgIdFromAuth,
  getOpenAiKey,
  openAiErrorResponse,
} from '@/lib/openai-proxy'

export const runtime = 'nodejs'
export const maxDuration = 60

const UPSTREAM = 'https://api.openai.com/v1/embeddings'

/**
 * Proxy OpenAI-compatible para `embeddings`.
 * Mesma auth do chat/completions; sem streaming.
 */
export async function POST(request: NextRequest) {
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
      'Organização não encontrada ou sem openai_api_key configurada (Dashboard → Configurações de IA).',
      'invalid_api_key',
    )
  }

  const body = await request.text()

  let upstream: Response
  try {
    upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body,
    })
  } catch (err) {
    console.error('[llm-proxy][embeddings] upstream fetch failed', err)
    return openAiErrorResponse(
      502,
      (err as Error).message || 'Upstream fetch failed',
      'upstream_error',
      'api_error',
    )
  }

  console.log('[llm-proxy][embeddings]', { orgId, status: upstream.status })

  const text = await upstream.text()
  return new Response(text, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'application/json',
    },
  })
}
