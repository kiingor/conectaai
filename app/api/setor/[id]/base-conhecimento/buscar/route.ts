import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ORG_ID_HEADER } from '@/lib/tenant'
import { gerarEmbedding } from '@/lib/gemini-embeddings'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: setorId } = await params
    const orgId = request.headers.get(ORG_ID_HEADER)
    if (!orgId) {
      return NextResponse.json({ error: 'x-org-id header obrigatório' }, { status: 400 })
    }

    const body = await request.json()
    const { query, limite = 5, threshold = 0.7 } = body

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ error: 'Campo "query" obrigatório' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Validate setor and get API key
    const { data: setor, error: setorErr } = await supabase
      .from('setores')
      .select('id, organizacao_id, google_ai_api_key')
      .eq('id', setorId)
      .single()

    if (setorErr || !setor) {
      return NextResponse.json({ error: 'Setor não encontrado' }, { status: 404 })
    }
    if (setor.organizacao_id !== orgId) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    if (!setor.google_ai_api_key) {
      return NextResponse.json({ error: 'API Key de IA não configurada para este setor' }, { status: 400 })
    }

    const embedding = await gerarEmbedding(query.trim(), setor.google_ai_api_key)

    const { data: resultados, error: rpcErr } = await supabase.rpc('buscar_base_conhecimento', {
      p_setor_id: setorId,
      p_embedding: JSON.stringify(embedding),
      p_limite: Math.min(20, Math.max(1, Number(limite))),
      p_threshold: Math.min(1, Math.max(0, Number(threshold))),
    })

    if (rpcErr) throw rpcErr

    return NextResponse.json({ resultados: resultados || [] })
  } catch (err) {
    console.error('[base-conhecimento buscar]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
