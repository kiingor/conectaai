// Layout raiz do /admin — sem auth check (login fica aqui)
// A proteção está em app/admin/(protected)/layout.tsx
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
