'use client'

import { useState, useRef, useEffect } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Toast } from '@base-ui/react/toast'
import { Button } from '@/components/ui/button'
import { useBillStore } from '@/stores/useBillStore'

export function ShareLinkButton() {
  const setSessionId = useBillStore((s) => s.setSessionId)
  const setSyncStatus = useBillStore((s) => s.setSyncStatus)
  const setStep = useBillStore((s) => s.setStep)
  const toastManager = Toast.useToastManager()
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  async function handleShare() {
    if (isLoading) return
    setIsLoading(true)
    try {
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
      toastManager.add({
        description: "Couldn't create sharing link — try again",
        timeout: 4000,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      onClick={handleShare}
      disabled={isLoading}
      className="h-12 flex-1 bg-amber-600 hover:bg-amber-700"
    >
      {isLoading ? <LoaderCircle size={16} className="animate-spin" /> : 'Share link'}
    </Button>
  )
}
