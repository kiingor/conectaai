import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { gerarSlugUnico, slugify } from '@/lib/slug'

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
 * GET /api/super-admin/organizacoes
 * Lista todas as organizações com stats básicos
 */
export async function GET() {
  const user = await verifySuperAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  const { data: orgs, error } = await service
    .from('organizacoes')
    .select('id, slug, nome, plano, ativo, admin_email, logo_url, cor_primaria, onboarding_completo, criado_em')
    .order('criado_em', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Stats por org
  const orgIds = (orgs || []).map(o => o.id)
  const [colabRes, ticketRes, canalRes] = await Promise.all([
    service.from('colaboradores').select('organizacao_id').in('organizacao_id', orgIds).eq('ativo', true),
    service.from('tickets').select('organizacao_id').in('organizacao_id', orgIds).in('status', ['aberto', 'em_atendimento']),
    service.from('setor_canais').select('organizacao_id').in('organizacao_id', orgIds).eq('ativo', true),
  ])

  const stats = (orgs || []).map(org => {
    const colaboradores = (colabRes.data || []).filter(c => c.organizacao_id === org.id).length
    const tickets_ativos = (ticketRes.data || []).filter(t => t.organizacao_id === org.id).length
    const canais = (canalRes.data || []).filter(c => c.organizacao_id === org.id).length
    return { ...org, stats: { colaboradores, tickets_ativos, canais } }
  })

  return NextResponse.json({ organizacoes: stats })
}

/**
 * POST /api/super-admin/organizacoes
 * Cria nova organização + setor + usuário admin
 * Body: { nome, slug?, plano?, admin_email, admin_nome, admin_senha }
 *
 * O slug e OPCIONAL: se nao vier (ou vier vazio), gera automaticamente a
 * partir do nome usando lib/slug.ts. Se vier, valida o formato.
 */
export async function POST(request: NextRequest) {
  const user = await verifySuperAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { slug: slugInput, nome, plano = 'basic', admin_email, admin_nome, admin_senha } = body

  if (!nome || !admin_email || !admin_nome || !admin_senha) {
    return NextResponse.json({ error: 'nome, admin_email, admin_nome e admin_senha são obrigatórios' }, { status: 400 })
  }

  const service = createServiceClient()

  // Resolver slug: usa o fornecido (se valido e livre) ou gera automatico
  let slug: string
  if (slugInput && typeof slugInput === 'string' && slugInput.trim() !== '') {
    const normalized = slugify(slugInput)
    if (!/^[a-z0-9-]+$/.test(normalized) || normalized.length === 0) {
      return NextResponse.json({ error: 'Slug inválido. Use apenas letras minúsculas, números e hífens.' }, { status: 400 })
    }
    const { data: existing } = await service
      .from('organizacoes')
      .select('id')
      .eq('slug', normalized)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ error: 'Este slug já está em uso' }, { status: 409 })
    }
    slug = normalized
  } else {
    slug = await gerarSlugUnico(nome, service)
  }

  // 1. Criar organização (trigger cria o setor automaticamente)
  const { data: org, error: orgError } = await service
    .from('organizacoes')
    .insert({ slug, nome, plano, admin_email })
    .select('id, slug, nome')
    .single()

  if (orgError || !org) {
    return NextResponse.json({ error: orgError?.message || 'Erro ao criar organização' }, { status: 500 })
  }

  // 2. Buscar permissão padrão (can_view_dashboard) ou criar uma
  let permissaoId: string | null = null
  const { data: permDefault } = await service
    .from('permissoes')
    .select('id')
    .eq('organizacao_id', org.id)
    .maybeSingle()
  permissaoId = permDefault?.id ?? null

  if (!permissaoId) {
    const { data: novaPerm } = await service
      .from('permissoes')
      .insert({
        nome: 'Admin',
        organizacao_id: org.id,
        can_view_dashboard: true,
        can_manage_setores: true,
        can_manage_colaboradores: true,
      })
      .select('id')
      .single()
    permissaoId = novaPerm?.id ?? null
  }

  // 3. Criar usuário no Supabase Auth com senha definida e email confirmado
  const { data: authUser, error: authError } = await service.auth.admin.createUser({
    email: admin_email,
    password: admin_senha,
    email_confirm: true,
    user_metadata: { nome: admin_nome },
  })

  if (authError || !authUser.user) {
    // Rollback: deletar org
    await service.from('organizacoes').delete().eq('id', org.id)
    return NextResponse.json({ error: authError?.message || 'Erro ao criar usuário' }, { status: 500 })
  }

  // 4. Inserir colaborador
  const { error: colabError } = await service.from('colaboradores').insert({
    user_id: authUser.user.id,
    nome: admin_nome,
    email: admin_email,
    organizacao_id: org.id,
    permissao_id: permissaoId,
    ativo: true,
    is_master: true,
  })

  if (colabError) {
    console.error('[super-admin] Erro ao criar colaborador:', colabError)
  }

  return NextResponse.json({
    success: true,
    organizacao: org,
    admin: { email: admin_email },
    login_url: `https://${slug}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'conectaai.net'}/login`,
  }, { status: 201 })
}
