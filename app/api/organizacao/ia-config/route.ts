import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ORG_ID_HEADER } from '@/lib/tenant'

export const runtime = 'nodejs'

/**
 * GET /api/organizacao/ia-config
 * Retorna a config de IA da organizacao (google_ai_api_key mascarada, openai mascarada, modelo).
 */
export async function GET(request: NextRequest) {
  try {
    const orgId = request.headers.get(ORG_ID_HEADER)
    if (!orgId) {
      return NextResponse.json({ error: 'org nao identificada' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('organizacoes')
      .select('google_ai_api_key, google_ai_modelo, openai_api_key')
      .eq('id', orgId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      google_ai_api_key: data?.google_ai_api_key || '',
      google_ai_modelo: data?.google_ai_modelo || 'text-embedding-004',
      openai_api_key: data?.openai_api_key || '',
    })
  } catch (error) {
    console.error('[ia-config][GET]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * PUT /api/organizacao/ia-config
 * Body: { google_ai_api_key?, google_ai_modelo?, openai_api_key? }
 */
export async function PUT(request: NextRequest) {
  try {
    const orgId = request.headers.get(ORG_ID_HEADER)
    if (!orgId) {
      return NextResponse.json({ error: 'org nao identificada' }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      google_ai_api_key?: string | null
      google_ai_modelo?: string | null
      openai_api_key?: string | null
    }

    const update: Record<string, unknown> = {}
    if (body.google_ai_api_key !== undefined) update.google_ai_api_key = body.google_ai_api_key || null
    if (body.google_ai_modelo !== undefined) update.google_ai_modelo = body.google_ai_modelo || 'text-embedding-004'
    if (body.openai_api_key !== undefined) update.openai_api_key = body.openai_api_key || null

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('organizacoes')
      .update(update)
      .eq('id', orgId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[ia-config][PUT]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
