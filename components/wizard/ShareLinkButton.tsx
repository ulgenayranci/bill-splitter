'use client'

import { useState, useRef, useEffect } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useBillStore } from '@/stores/useBillStore'

export function ShareLinkButton() {
  const setSessionId = useBillStore((s) => s.setSessionId)
  const setSyncStatus = useBillStore((s) => s.setSyncStatus)
  const setStep = useBillStore((s) => s.setStep)
  const [isLoading, setIsLoading] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  async function handleShare() {
    if (isLoading) return
    setIsLoading(true)
    try {
      setSessionError(null)
      const { people, items, tipPercent } = useBillStore.getState()
      abortRef.current?.abort()
      abortRef.current = new AbortController()
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ people, items, tipPercent }),
        signal: abortRef.current.signal,
      })
      if (!res.ok) throw new Error(`Session creation failed: ${res.status}`)
      const { sessionId } = (await res.json()) as { sessionId: string }
      setSessionId(sessionId)
      setSyncStatus('waiting')
      setStep(5)
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
