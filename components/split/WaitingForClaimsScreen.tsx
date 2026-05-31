'use client'

import { Loader2 } from 'lucide-react'

export function WaitingForClaimsScreen() {
  return (
    <main
      role="status"
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <Loader2 size={48} className="animate-spin text-zinc-400" aria-hidden="true" />
      <h1 className="text-[20px] font-semibold">Waiting for all items to be claimed…</h1>
      <p className="text-[16px] text-zinc-500">
        Your results will appear automatically once every item has been claimed.
      </p>
    </main>
  )
}
