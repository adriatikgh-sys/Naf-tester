import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-4xl font-bold">Lerke</h1>
      <p className="max-w-md text-zinc-600">
        Real-time retail inventory monitoring for distributors — catch stockouts
        before they cost you sales.
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-50"
        >
          Register
        </Link>
      </div>
    </main>
  )
}
