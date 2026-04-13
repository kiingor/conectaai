import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ORG_ID_HEADER } from '@/lib/tenant'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  try {
    const { id: setorId, docId } = await params
    const orgId = request.headers.get(ORG_ID_HEADER)
    if (!orgId) {
      return NextResponse.json({ error: 'x-org-id header obrigatório' }, { status: 400 })
    }

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

    const { error } = await supabase
      .from('base_conhecimento')
      .update({ ativo: false })
      .eq('id', docId)
      .eq('setor_id', setorId)
      .eq('organizacao_id', orgId)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[base-conhecimento DELETE]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
