import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  const service = createServiceClient()
  const { data: superAdmin } = await service
    .from('super_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!superAdmin) {
    redirect('/admin/login')
  }

  return (
    <div className="ambient-glow min-h-screen relative">
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}
