import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { gerarEmbedding, toPgVector } from '@/lib/gemini-embedding'

export const runtime = 'nodejs'
export const maxDuration = 60

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/setor/[id]/rag/buscar
 * Body: { pergunta: string, limite?: number, threshold?: number }
 *
 * Endpoint consumido pelo agente retaguarda (n8n):
 *  1. gera embedding da pergunta usando a api key do setor
 *  2. chama RPC buscar_base_conhecimento
 *  3. devolve { prompt, resultados }
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: setorId } = await params
    const body = (await request.json().catch(() => ({}))) as {
      pergunta?: string
      limite?: number
      threshold?: number
    }

    if (!body.pergunta || !body.pergunta.trim()) {
      return NextResponse.json({ error: 'Campo "pergunta" é obrigatório' }, { status: 400 })
    }

    const limite = Math.max(1, Math.min(body.limite ?? 5, 20))
    const threshold = typeof body.threshold === 'number' ? body.threshold : 0.7

    const supabase = createServiceClient()

    const { data: setor, error: setorErr } = await supabase
      .from('setores')
      .select('id, organizacao_id, agente_prompt, rag_ativo')
      .eq('id', setorId)
      .maybeSingle()

    if (setorErr || !setor) {
      return NextResponse.json({ error: 'Setor não encontrado' }, { status: 404 })
    }

    if (!setor.rag_ativo) {
      return NextResponse.json({
        rag_ativo: false,
        prompt: setor.agente_prompt || null,
        resultados: [],
        aviso: 'RAG desativado para este setor',
      })
    }

    const { data: org } = await supabase
      .from('organizacoes')
      .select('google_ai_api_key, google_ai_modelo')
      .eq('id', setor.organizacao_id)
      .maybeSingle()

    if (!org?.google_ai_api_key) {
      return NextResponse.json(
        { error: 'google_ai_api_key não configurada na organização (Dashboard → Configurações de IA)' },
        { status: 400 },
      )
    }

    const modelo = org.google_ai_modelo || 'text-embedding-004'

    const embedding = await gerarEmbedding(body.pergunta, org.google_ai_api_key, modelo)

    const { data, error } = await supabase.rpc('buscar_base_conhecimento', {
      p_setor_id: setorId,
      p_embedding: toPgVector(embedding),
      p_limite: limite,
      p_threshold: threshold,
    })

    if (error) {
      console.error('[rag/buscar] RPC error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      rag_ativo: true,
      prompt: setor.agente_prompt || null,
      resultados: data || [],
    })
  } catch (error) {
    console.error('[rag/buscar][POST]', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Erro interno' },
      { status: 500 },
    )
  }
}
