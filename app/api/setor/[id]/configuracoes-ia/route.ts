import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ORG_ID_HEADER } from '@/lib/tenant'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: setorId } = await params
    const orgId = request.headers.get(ORG_ID_HEADER)
    if (!orgId) {
      return NextResponse.json({ error: 'x-org-id header obrigatório' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data: setor, error } = await supabase
      .from('setores')
      .select('id, organizacao_id, google_ai_api_key, google_ai_modelo')
      .eq('id', setorId)
      .single()

    if (error || !setor) {
      return NextResponse.json({ error: 'Setor não encontrado' }, { status: 404 })
    }
    if (setor.organizacao_id !== orgId) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const rawKey: string = setor.google_ai_api_key || ''
    const maskedKey = rawKey.length > 4 ? `****${rawKey.slice(-4)}` : rawKey ? '****' : ''

    return NextResponse.json({
      google_ai_api_key_masked: maskedKey,
      google_ai_modelo: setor.google_ai_modelo || 'text-embedding-004',
    })
  } catch (err) {
    console.error('[configuracoes-ia GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: setorId } = await params
    const orgId = request.headers.get(ORG_ID_HEADER)
    if (!orgId) {
      return NextResponse.json({ error: 'x-org-id header obrigatório' }, { status: 400 })
    }

    const body = await request.json()
    const { google_ai_api_key, google_ai_modelo } = body

    const supabase = createServiceClient()
    const { data: setor, error: fetchErr } = await supabase
      .from('setores')
      .select('id, organizacao_id')
      .eq('id', setorId)
      .single()

    if (fetchErr || !setor) {
      return NextResponse.json({ error: 'Setor não encontrado' }, { status: 404 })
    }
    if (setor.organizacao_id !== orgId) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const updates: Record<string, string> = {}
    if (google_ai_api_key !== undefined) updates.google_ai_api_key = google_ai_api_key
    if (google_ai_modelo !== undefined) updates.google_ai_modelo = google_ai_modelo

    const { error: updateErr } = await supabase
      .from('setores')
      .update(updates)
      .eq('id', setorId)

    if (updateErr) throw updateErr

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[configuracoes-ia PATCH]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
