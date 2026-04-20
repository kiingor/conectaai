import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

/**
 * Verifica se quem faz a chamada esta autenticado e e super-admin.
 * Retorna o user autenticado ou null.
 */
async function verifySuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = createServiceClient()
  const { data } = await service
    .from('super_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  return data ? user : null
}

/**
 * GET /api/super-admin/super-admins
 * Lista todos os super-admins com email e data de criacao.
 */
export async function GET() {
  const user = await verifySuperAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  const { data: registros, error } = await service
    .from('super_admins')
    .select('user_id, criado_em')
    .order('criado_em', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enriquecer com email do auth.users (so service role pode ler)
  const enriched = await Promise.all(
    (registros || []).map(async (r) => {
      const { data: u } = await service.auth.admin.getUserById(r.user_id)
      return {
        user_id: r.user_id,
        email: u?.user?.email ?? null,
        criado_em: r.criado_em,
      }
    }),
  )

  return NextResponse.json({
    super_admins: enriched,
    current_user_id: user.id,
  })
}

/**
 * POST /api/super-admin/super-admins
 * Cria um novo super-admin (novo usuario de auth + insert na tabela super_admins).
 * Body: { nome, email, senha }
 */
export async function POST(request: NextRequest) {
  const actor = await verifySuperAdmin()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { nome, email, senha } = body as { nome?: string; email?: string; senha?: string }

  if (!nome || !email || !senha) {
    return NextResponse.json(
      { error: 'nome, email e senha sao obrigatorios' },
      { status: 400 },
    )
  }
  if (senha.length < 6) {
    return NextResponse.json({ error: 'Senha deve ter pelo menos 6 caracteres' }, { status: 400 })
  }

  const service = createServiceClient()

  // 1. Criar usuario no Supabase Auth
  const { data: authUser, error: authError } = await service.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  })

  if (authError || !authUser?.user) {
    return NextResponse.json(
      { error: authError?.message || 'Erro ao criar usuario' },
      { status: 500 },
    )
  }

  // 2. Inserir na tabela super_admins
  const { error: insertError } = await service
    .from('super_admins')
    .insert({ user_id: authUser.user.id })

  if (insertError) {
    // Rollback: deletar user criado para nao deixar orfao
    await service.auth.admin.deleteUser(authUser.user.id).catch(() => {})
    return NextResponse.json(
      { error: insertError.message || 'Erro ao registrar super-admin' },
      { status: 500 },
    )
  }

  return NextResponse.json(
    {
      success: true,
      super_admin: {
        user_id: authUser.user.id,
        email,
        nome,
      },
      credenciais: {
        email,
        senha,
      },
    },
    { status: 201 },
  )
}

/**
 * DELETE /api/super-admin/super-admins?user_id=<uuid>
 * Remove um super-admin. Bloqueia auto-remocao.
 */
export async function DELETE(request: NextRequest) {
  const actor = await verifySuperAdmin()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = request.nextUrl.searchParams.get('user_id')
  if (!userId) return NextResponse.json({ error: 'user_id obrigatorio' }, { status: 400 })

  if (userId === actor.id) {
    return NextResponse.json(
      { error: 'Voce nao pode remover a si mesmo' },
      { status: 400 },
    )
  }

  const service = createServiceClient()

  // Remove da tabela super_admins
  const { error: delError } = await service
    .from('super_admins')
    .delete()
    .eq('user_id', userId)

  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 })
  }

  // OBS: o usuario de auth NAO e deletado, so perde o privilegio de super-admin.
  // Se precisar tambem deletar conta: service.auth.admin.deleteUser(userId)

  return NextResponse.json({ success: true })
}
