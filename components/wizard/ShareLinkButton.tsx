'use client'

import { useState, useRef, useEffect } from 'react'
import { LoaderCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useBillStore } from '@/stores/useBillStore'

export function ShareLinkButton() {
  const setSessionId = useBillStore((s) => s.setSessionId)
  const setHostToken = useBillStore((s) => s.setHostToken)
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  async function handleShare() {
    if (isLoading) return
    setIsLoading(true)
    try {
      setSessionError(null)
      // Phase 6: tipPercent is NOT sent — per D-07 tip is per-person, set after claiming.
      // Items now carry a required `quantity` field (Plan 01).
      const { people, items } = useBillStore.getState()
      abortRef.current?.abort()
      abortRef.current = new AbortController()
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ people, items }),
        signal: abortRef.current.signal,
      })
      if (!res.ok) throw new Error(`Session creation failed: ${res.status}`)
      const { sessionId, hostToken } = (await res.json()) as {
        sessionId: string
        hostToken: string
      }
      setSessionId(sessionId)
      setHostToken(hostToken)
      // D-01 + D-02: host navigates to the live /split page with the token in the URL.
      // Guests get the same URL WITHOUT the token (handled inside the split page UI's "share guest link" affordance — out of scope here).
      router.push(`/split/${sessionId}?hostToken=${hostToken}`)
    } catch (err) {
      console.error(err)
      setSessionError("Couldn't create session. Try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <Button
        onClick={handleShare}
        disabled={isLoading}
        className="h-12 w-full bg-amber-600 hover:bg-amber-700"
      >
        {isLoading ? <LoaderCircle size={16} className="animate-spin" /> : 'Share link'}
      </Button>
      {sessionError && (
        <span className="mt-1 text-red-600 text-sm">{sessionError}</span>
      )}
    </div>
  )
}
