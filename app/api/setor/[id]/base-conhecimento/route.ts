import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ORG_ID_HEADER } from '@/lib/tenant'
import { parseArquivo, chunkTexto, hashConteudo } from '@/lib/document-parser'
import { gerarEmbedding } from '@/lib/gemini-embeddings'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['application/pdf', 'text/plain']

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: setorId } = await params
    const orgId = request.headers.get(ORG_ID_HEADER)
    if (!orgId) {
      return NextResponse.json({ error: 'x-org-id header obrigatório' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const offset = (page - 1) * limit

    const supabase = createServiceClient()

    // Validate setor belongs to org
    const { data: setor, error: setorErr } = await supabase
      .from('setores')
      .select('id, organizacao_id')
      .eq('id', setorId)
      .single()

    if (setorErr || !setor) {
      return NextResponse.json({ error: 'Setor não encontrado' }, { status: 404 })
    }
    if (setor.organizacao_id !== orgId) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { data: docs, error, count } = await supabase
      .from('base_conhecimento')
      .select('id, titulo, arquivo_nome, chunk_index, tipo, criado_em', { count: 'exact' })
      .eq('setor_id', setorId)
      .eq('organizacao_id', orgId)
      .eq('ativo', true)
      .order('criado_em', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({ docs: docs || [], total: count ?? 0, page, limit })
  } catch (err) {
    console.error('[base-conhecimento GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: setorId } = await params
    const orgId = request.headers.get(ORG_ID_HEADER)
    if (!orgId) {
      return NextResponse.json({ error: 'x-org-id header obrigatório' }, { status: 400 })
    }

    const formData = await request.formData()
    const arquivo = formData.get('arquivo') as File | null
    if (!arquivo) {
      return NextResponse.json({ error: 'Campo "arquivo" obrigatório' }, { status: 400 })
    }

    if (arquivo.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Arquivo excede o limite de 10MB' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(arquivo.type)) {
      return NextResponse.json({ error: 'Tipo de arquivo não suportado. Use PDF ou TXT.' }, { status: 400 })
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
      return NextResponse.json({ error: 'Configure a Google AI API Key nas configurações de IA do setor antes de fazer upload.' }, { status: 400 })
    }

    const buffer = Buffer.from(await arquivo.arrayBuffer())
    const texto = await parseArquivo(buffer, arquivo.type)
    const chunks = chunkTexto(texto)

    let inseridos = 0
    let duplicados = 0

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const hash = hashConteudo(chunk)
      const titulo = arquivo.name

      const { error: insertErr, data: inserted } = await supabase
        .from('base_conhecimento')
        .insert({
          setor_id: setorId,
          organizacao_id: orgId,
          titulo,
          conteudo: chunk,
          conteudo_hash: hash,
          tipo: 'documento',
          arquivo_nome: arquivo.name,
          chunk_index: i,
        })
        .select('id')
        .single()

      if (insertErr) {
        // Unique constraint violation = duplicate
        if (insertErr.code === '23505') {
          duplicados++
          continue
        }
        throw insertErr
      }

      // Generate and store embedding
      try {
        const embedding = await gerarEmbedding(chunk, setor.google_ai_api_key)
        await supabase
          .from('base_conhecimento')
          .update({ embedding: JSON.stringify(embedding) })
          .eq('id', inserted.id)
      } catch (embErr) {
        console.error(`[base-conhecimento] Falha ao gerar embedding chunk ${i}:`, embErr)
      }

      inseridos++
    }

    return NextResponse.json({ inseridos, duplicados })
  } catch (err) {
    console.error('[base-conhecimento POST]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
