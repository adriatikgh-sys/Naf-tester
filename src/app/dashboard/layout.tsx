import Link from 'next/link'
import { requireSession, signOut } from '@/lib/auth'

const nav = [
  { href: '/dashboard', label: 'Stock matrix' },
  { href: '/dashboard/alerts', label: 'Alerts' },
  { href: '/dashboard/skus', label: 'Catalog' },
  { href: '/dashboard/stores', label: 'Stores' },
  { href: '/dashboard/emails', label: 'Emails' },
  { href: '/dashboard/settings/chains', label: 'Chains' },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession()

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-lg font-bold">
              Lerke
            </Link>
            <nav className="flex gap-4 text-sm">
              {nav.map((item) => (
                <Link key={item.href} href={item.href} className="text-zinc-600 hover:text-zinc-900">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <form
            action={async () => {
              'use server'
              await signOut({ redirectTo: '/login' })
            }}
          >
            <button className="text-sm text-zinc-600 hover:text-zinc-900">
              Sign out ({user.name.split(' ')[0]})
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  )
}
