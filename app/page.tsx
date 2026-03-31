import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { cookies } from 'next/headers'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user permissions to redirect to correct area
  const { data: colaborador } = await supabase
    .from('colaboradores')
    .select('permissoes:permissao_id(can_view_dashboard), organizacao_id')
    .eq('email', user.email!)
    .maybeSingle()

  const canViewDashboard = (colaborador?.permissoes as any)?.can_view_dashboard ?? false

  if (!canViewDashboard) {
    redirect('/workdesk')
  }

  // Verificar se o onboarding da empresa foi concluído
  if (colaborador?.organizacao_id) {
    const service = createServiceClient()
    const { data: org } = await service
      .from('organizacoes')
      .select('onboarding_completo')
      .eq('id', colaborador.organizacao_id)
      .maybeSingle()

    if (org && !org.onboarding_completo) {
      redirect('/onboarding')
    }
  }

  redirect('/dashboard')
}
