'use client'

import { Link2Off } from 'lucide-react'

export function SessionExpiredScreen() {
  return (
    <main
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <Link2Off size={48} className="text-zinc-400" aria-hidden="true" />
      <h1 className="text-[20px] font-semibold">This session has expired</h1>
      <p className="text-[16px] text-zinc-500">
        The link you opened is no longer active. Ask the person who shared it to create a new one.
      </p>
    </main>
  )
}
