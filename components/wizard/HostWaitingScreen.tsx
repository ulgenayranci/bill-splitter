'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Check, Copy, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useBillStore, AVATAR_COLORS } from '@/stores/useBillStore'
import type { SessionPayload } from '@/lib/sessionSchema'
import { SessionExpiredScreen } from '@/components/split/SessionExpiredScreen'

const fetcher = (url: string): Promise<SessionPayload> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('session_not_found')
    return r.json()
  })

interface HostWaitingScreenProps { sessionId: string }

export function HostWaitingScreen({ sessionId }: HostWaitingScreenProps) {
  const setSyncStatus = useBillStore((s) => s.setSyncStatus)
  const setAssignment = useBillStore((s) => s.setAssignment)
  const [copied, setCopied] = useState(false)
  const { data: session, error } = useSWR<SessionPayload>(
    `/api/session/${sessionId}`,
    fetcher,
    { refreshInterval: 3000, revalidateOnFocus: false },
  )

  if (error) return <SessionExpiredScreen />
  if (!session) return <div role="status" className="p-6">Loading…</div>

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/split/${sessionId}`
      : `/split/${sessionId}`

  const allDone =
    session.people.length > 0 &&
    session.people.every((p) => session.claims?.donePeople?.[p.id] === true)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Silent fallback per UI-SPEC mobile constraints
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      <div>
        <h1 className="text-[20px] font-semibold leading-[1.2]">
          Waiting for everyone…
        </h1>
        <p className="mt-1 text-[14px] text-zinc-500">
          Share this link. Watch the list update as each person claims their items.
        </p>
      </div>

      <Card className="flex items-center gap-3 px-4 py-3">
        <span className="flex-1 break-all font-mono text-[14px]">{shareUrl}</span>
        <button
          type="button"
          aria-label="Copy link"
          onClick={handleCopy}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md hover:bg-zinc-100"
        >
          {copied ? (
            <Check size={20} className="text-emerald-500" aria-label="Copied" />
          ) : (
            <Copy size={20} aria-hidden="true" />
          )}
        </button>
      </Card>

      {allDone && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[14px] text-emerald-700">
          Everyone has claimed their items.
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {session.people.map((person) => {
          const done = session.claims?.donePeople?.[person.id] === true
          return (
            <li
              key={person.id}
              className="flex h-14 items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-4"
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full text-white font-semibold ${AVATAR_COLORS[person.colorIndex]}`}
                aria-hidden="true"
              >
                {person.name.charAt(0).toUpperCase()}
              </div>
              <span className="flex-1 text-[16px]">{person.name}</span>
              {done ? (
                <Check
                  size={20}
                  className="text-emerald-500"
                  data-testid="check-icon"
                  aria-label="Done"
                />
              ) : (
                <LoaderCircle
                  size={20}
                  className="text-zinc-400 animate-spin"
                  data-testid="spinner-icon"
                  aria-label="Waiting"
                />
              )}
            </li>
          )
        })}
      </ul>

      <div
        className="fixed bottom-0 left-0 right-0 border-t border-border bg-background p-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        <Button
          onClick={() => {
            // D-13: hydrate Zustand assignments from session.claims.items
            // so ResultsStep computes per-person totals from actual claims
            for (const [itemId, personId] of Object.entries(session.claims?.items ?? {})) {
              setAssignment(itemId as string, [personId as string])
            }
            setSyncStatus('results')
          }}
          className="h-12 w-full bg-amber-600 hover:bg-amber-700"
        >
          View results
        </Button>
      </div>
    </div>
  )
}
