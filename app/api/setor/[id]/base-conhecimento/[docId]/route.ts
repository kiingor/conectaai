import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ORG_ID_HEADER } from '@/lib/tenant'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string; docId: string }> }

/**
 * O docId pode ser:
 *  - um UUID de um único chunk
 *  - OU uma "chave de documento" (arquivo_nome ou título) quando a UI
 *    quer agir sobre todos os chunks de um arquivo — neste caso envie
 *    ?scope=arquivo na query string.
 */

/** DELETE — remove o(s) registro(s) do banco (libera o hash para reupload) */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: setorId, docId } = await params
    const orgId = request.headers.get(ORG_ID_HEADER)
    const { searchParams } = new URL(request.url)
    const scope = searchParams.get('scope') // 'arquivo' | null

    const supabase = createServiceClient()

    let q = supabase.from('base_conhecimento').delete().eq('setor_id', setorId)
    if (orgId) q = q.eq('organizacao_id', orgId)

    if (scope === 'arquivo') {
      // docId é a chave (arquivo_nome ou titulo)
      q = q.or(`arquivo_nome.eq.${docId},titulo.eq.${docId}`)
    } else {
      q = q.eq('id', docId)
    }

    const { error, count } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, removidos: count ?? null })
  } catch (error) {
    console.error('[base-conhecimento][DELETE]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/** PATCH — toggle ativo (individual ou por arquivo) */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id: setorId, docId } = await params
    const orgId = request.headers.get(ORG_ID_HEADER)
    const { searchParams } = new URL(request.url)
    const scope = searchParams.get('scope')

    const body = (await request.json().catch(() => ({}))) as { ativo?: boolean }
    if (typeof body.ativo !== 'boolean') {
      return NextResponse.json({ error: 'Campo "ativo" (boolean) obrigatório' }, { status: 400 })
    }

    const supabase = createServiceClient()
    let q = supabase
      .from('base_conhecimento')
      .update({ ativo: body.ativo })
      .eq('setor_id', setorId)
    if (orgId) q = q.eq('organizacao_id', orgId)

    if (scope === 'arquivo') {
      q = q.or(`arquivo_nome.eq.${docId},titulo.eq.${docId}`)
    } else {
      q = q.eq('id', docId)
    }

    const { error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[base-conhecimento][PATCH]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
