import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * /dashboard/empresa
 *
 * Resolve o setorId da organização atual (cada org tem exatamente 1 setor)
 * e redireciona para a página de configuração da empresa.
 */
export default async function EmpresaPage() {
  const cookieStore = await cookies()
  const orgId = cookieStore.get('org_id')?.value

  if (!orgId) {
    redirect('/login')
  }

  const supabase = createServiceClient()
  const { data: setor } = await supabase
    .from('setores')
    .select('id')
    .eq('organizacao_id', orgId)
    .single()

  if (!setor) {
    redirect('/dashboard')
  }

  redirect(`/setor/${setor.id}?mode=empresa`)
}
