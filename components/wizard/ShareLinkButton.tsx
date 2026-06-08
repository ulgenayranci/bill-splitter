'use client'

import { useState, useRef, useEffect } from 'react'
import { LoaderCircle, Copy, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useBillStore } from '@/stores/useBillStore'
import { createSession } from '@/lib/createSession'

interface PendingSession {
  guestUrl: string
  sessionId: string
}

export function ShareLinkButton() {
  const setSessionId = useBillStore((s) => s.setSessionId)
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [pendingSession, setPendingSession] = useState<PendingSession | null>(null)
  const [copied, setCopied] = useState(false)
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
      // D-04: currencyCode sent so the session knows what currency to render amounts in.
      const { people, items, currencyCode } = useBillStore.getState()
      abortRef.current?.abort()
      abortRef.current = new AbortController()
      const { sessionId, guestUrl } = await createSession(
        { people, items, currencyCode },
        abortRef.current.signal,
      )
      setSessionId(sessionId)
      setPendingSession({ guestUrl, sessionId })
    } catch (err) {
      console.error(err)
      setSessionError("Couldn't create session. Try again.")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCopyLink() {
    if (!pendingSession) return
    const { guestUrl, sessionId } = pendingSession

    function redirectHost() {
      setPendingSession(null)
      router.push(`/split/${sessionId}`)
    }

    // 1. Native share sheet — works on mobile without HTTPS (iOS Safari, Android Chrome)
    if (navigator.share) {
      try {
        await navigator.share({ url: guestUrl, title: 'Split the bill' })
        setCopied(true)
        setTimeout(redirectHost, 1200)
        return
      } catch {
        // User cancelled share or share not supported — fall through
      }
    }

    // 2. Clipboard API — works on HTTPS / localhost
    let success = false
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(guestUrl)
        success = true
      } catch {
        // Fall through to execCommand
      }
    }

    // 3. execCommand fallback — works in non-secure HTTP contexts (local network dev)
    if (!success) {
      const el = document.createElement('textarea')
      el.value = guestUrl
      el.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
      document.body.appendChild(el)
      el.focus()
      el.select()
      success = document.execCommand('copy')
      document.body.removeChild(el)
    }

    if (success) {
      setCopied(true)
      // After copying, briefly show "Copied!" then redirect host to the session.
      setTimeout(redirectHost, 1200)
    }
  }

  return (
    <>
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

      <Dialog open={!!pendingSession} onOpenChange={(open) => { if (!open) setPendingSession(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Share this link</DialogTitle>
            <DialogDescription>
              Send this to everyone at the table so they can claim their items.
            </DialogDescription>
          </DialogHeader>

          {/* Guest URL display */}
          <div className="rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-700 break-all select-all">
            {pendingSession?.guestUrl}
          </div>

          <DialogFooter>
            <Button
              onClick={handleCopyLink}
              className="w-full bg-amber-600 hover:bg-amber-700"
            >
              {copied ? (
                <><Check size={16} className="mr-2" /> Copied!</>
              ) : (
                <><Copy size={16} className="mr-2" /> Copy link</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
