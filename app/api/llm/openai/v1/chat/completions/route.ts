import { NextRequest } from 'next/server'
import {
  extractOrgIdFromAuth,
  getOpenAiKey,
  isStreamRequest,
  openAiErrorResponse,
} from '@/lib/openai-proxy'

export const runtime = 'nodejs'
export const maxDuration = 300

const UPSTREAM = 'https://api.openai.com/v1/chat/completions'

/**
 * Proxy OpenAI-compatible para `chat/completions`.
 *
 * Fluxo:
 *  - `Authorization: Bearer <organizacao_id>` → troca pela `openai_api_key`
 *    real da organização
 *  - Repassa o body cru (sem re-serializar) pra não quebrar payloads com
 *    tools/response_format/schemas grandes
 *  - Se `stream: true`, pipe o `ReadableStream` direto (SSE)
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
  const stream = isStreamRequest(body)

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
    console.error('[llm-proxy][chat] upstream fetch failed', err)
    return openAiErrorResponse(
      502,
      (err as Error).message || 'Upstream fetch failed',
      'upstream_error',
      'api_error',
    )
  }

  console.log('[llm-proxy][chat]', {
    orgId,
    status: upstream.status,
    stream,
  })

  if (stream && upstream.body) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
      },
    })
  }

  const text = await upstream.text()
  return new Response(text, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'application/json',
    },
  })
}
