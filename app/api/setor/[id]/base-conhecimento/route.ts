import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ORG_ID_HEADER } from '@/lib/tenant'
import { gerarEmbedding, sha256, chunkText } from '@/lib/embedding'
import { parseArquivo } from '@/lib/document-parser'

export const runtime = 'nodejs'
export const maxDuration = 300

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/setor/[id]/base-conhecimento
 * Lista documentos do setor agrupados por arquivo/título.
 * Retorna: [{ titulo, arquivo_nome, tipo, total_chunks, ativo, criado_em, ids }]
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: setorId } = await params
    const orgId = request.headers.get(ORG_ID_HEADER)
    const supabase = createServiceClient()

    let q = supabase
      .from('base_conhecimento')
      .select('id, titulo, arquivo_nome, tipo, chunk_index, ativo, criado_em')
      .eq('setor_id', setorId)
      .order('criado_em', { ascending: false })
    if (orgId) q = q.eq('organizacao_id', orgId)

    const { data, error } = await q
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Agrupa por (arquivo_nome || titulo) — um "documento" lógico tem N chunks
    const grupos = new Map<
      string,
      {
        chave: string
        titulo: string
        arquivo_nome: string | null
        tipo: string
        total_chunks: number
        ativo: boolean
        criado_em: string
        ids: string[]
      }
    >()

    for (const row of data || []) {
      const chave = row.arquivo_nome || row.titulo
      const existing = grupos.get(chave)
      if (existing) {
        existing.total_chunks += 1
        existing.ids.push(row.id)
        existing.ativo = existing.ativo && row.ativo
      } else {
        grupos.set(chave, {
          chave,
          titulo: row.titulo,
          arquivo_nome: row.arquivo_nome,
          tipo: row.tipo,
          total_chunks: 1,
          ativo: row.ativo,
          criado_em: row.criado_em,
          ids: [row.id],
        })
      }
    }

    return NextResponse.json({ documentos: Array.from(grupos.values()) })
  } catch (error) {
    console.error('[base-conhecimento][GET]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * POST /api/setor/[id]/base-conhecimento
 * multipart/form-data: file (obrigatório), titulo?, tipo?
 * Extrai texto, faz chunking, gera embedding por chunk e salva.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: setorId } = await params
    const orgIdHeader = request.headers.get(ORG_ID_HEADER)
    const supabase = createServiceClient()

    // Busca o setor (apenas organizacao_id)
    const { data: setor, error: setorErr } = await supabase
      .from('setores')
      .select('id, organizacao_id')
      .eq('id', setorId)
      .maybeSingle()

    if (setorErr || !setor) {
      return NextResponse.json({ error: 'Setor não encontrado' }, { status: 404 })
    }

    const organizacaoId = orgIdHeader || setor.organizacao_id
    if (!organizacaoId) {
      return NextResponse.json({ error: 'Organização não identificada' }, { status: 400 })
    }

    // Chave de IA agora é por organização (OpenAI)
    const { data: org } = await supabase
      .from('organizacoes')
      .select('openai_api_key, google_ai_modelo')
      .eq('id', organizacaoId)
      .maybeSingle()

    if (!org?.openai_api_key) {
      return NextResponse.json(
        { error: 'openai_api_key não configurada na organização (Dashboard → Configurações de IA)' },
        { status: 400 },
      )
    }

    const openaiApiKey = org.openai_api_key
    const modelo = org.google_ai_modelo || 'text-embedding-3-small'

    // Lê multipart
    const form = await request.formData()
    const file = form.get('file')
    const tituloCustom = (form.get('titulo') as string | null) || null
    const tipoCustom = (form.get('tipo') as string | null) || null

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'Campo "file" é obrigatório (multipart)' }, { status: 400 })
    }

    const nomeArquivo = (file as File).name || 'documento'
    const mime = file.type

    const buffer = Buffer.from(await file.arrayBuffer())
    const { texto, tipo: tipoDetectado } = await parseArquivo(buffer, mime, nomeArquivo)

    if (!texto.trim()) {
      return NextResponse.json({ error: 'Arquivo vazio ou sem texto extraível' }, { status: 400 })
    }

    const chunks = chunkText(texto)
    if (chunks.length === 0) {
      return NextResponse.json({ error: 'Nenhum chunk válido gerado' }, { status: 400 })
    }

    const titulo = tituloCustom || nomeArquivo
    let criados = 0
    let duplicados = 0
    const erros: { chunk_index: number; erro: string }[] = []

    for (let i = 0; i < chunks.length; i++) {
      const conteudo = chunks[i]
      const hash = sha256(conteudo)

      try {
        const embedding = await gerarEmbedding(conteudo, openaiApiKey, modelo)

        const { error: insertErr } = await supabase.from('base_conhecimento').insert({
          setor_id: setorId,
          organizacao_id: organizacaoId,
          titulo,
          conteudo,
          conteudo_hash: hash,
          embedding,
          tipo: tipoCustom || tipoDetectado,
          arquivo_nome: nomeArquivo,
          chunk_index: i,
          ativo: true,
        })

        if (insertErr) {
          // Código 23505 = unique_violation (duplicado por hash)
          if ((insertErr as { code?: string }).code === '23505') {
            duplicados++
          } else {
            erros.push({ chunk_index: i, erro: insertErr.message })
          }
        } else {
          criados++
        }
      } catch (e) {
        erros.push({ chunk_index: i, erro: (e as Error).message })
      }
    }

    return NextResponse.json({
      ok: criados > 0,
      total_chunks: chunks.length,
      chunks_criados: criados,
      chunks_duplicados: duplicados,
      erros,
      titulo,
      arquivo_nome: nomeArquivo,
    })
  } catch (error) {
    console.error('[base-conhecimento][POST]', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Erro interno' },
      { status: 500 },
    )
  }
}
