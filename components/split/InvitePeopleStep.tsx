'use client'

import { useState } from 'react'
import { Share2, Copy, Check, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface InvitePeopleStepProps {
  sessionId: string
  /** Advance to the claiming phase (marks the invite step as seen). */
  onContinue: () => void
}

/** Build the shareable guest URL, matching BillViewHeader's pattern. */
function buildShareUrl(sessionId: string): string {
  const origin =
    typeof window !== 'undefined'
      ? process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
      : ''
  return `${origin}/split/${sessionId}`
}

/**
 * G4: "Invite your group" — the host sees this once, right after creating the
 * bill, so sharing the link is the prominent first action (not buried in the
 * header). Copy link + native Share, with a clear skip into claiming.
 */
export function InvitePeopleStep({ sessionId, onContinue }: InvitePeopleStepProps) {
  const [copied, setCopied] = useState(false)
  const url = buildShareUrl(sessionId)

  // 3-tier copy: Clipboard API → execCommand fallback (non-secure/local dev).
  async function copyToClipboard(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url)
        return true
      } catch {
        // fall through to execCommand
      }
    }
    const el = document.createElement('textarea')
    el.value = url
    el.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
    document.body.appendChild(el)
    el.focus()
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  }

  function flashCopied() {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Native share sheet first (mobile), falling back to copy.
  async function handleShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ url, title: 'Split the bill' })
        return
      } catch {
        // user cancelled or unsupported — fall through to copy
      }
    }
    if (await copyToClipboard()) flashCopied()
  }

  async function handleCopy() {
    if (await copyToClipboard()) flashCopied()
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[480px] flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
        <Users size={32} className="text-amber-600" aria-hidden="true" />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-[24px] font-semibold text-zinc-900">Invite your group</h1>
        <p className="text-[16px] text-zinc-500">
          Send everyone the link so they can claim what they had. You can also share it later from the bill.
        </p>
      </div>

      {/* Link preview */}
      <div className="w-full select-all break-all rounded-md bg-zinc-100 px-3 py-2 text-[13px] text-zinc-600">
        {url}
      </div>

      <div className="flex w-full flex-col gap-3">
        <Button
          onClick={handleShare}
          className="h-12 w-full bg-amber-600 hover:bg-amber-700"
        >
          <Share2 size={18} className="mr-2" aria-hidden="true" /> Share link
        </Button>
        <Button
          variant="outline"
          onClick={handleCopy}
          className="h-12 w-full"
          aria-label="Copy link"
        >
          {copied ? (
            <><Check size={18} className="mr-2" aria-hidden="true" /> Copied!</>
          ) : (
            <><Copy size={18} className="mr-2" aria-hidden="true" /> Copy link</>
          )}
        </Button>
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="text-[15px] font-medium text-zinc-500 underline-offset-4 hover:underline"
      >
        Skip → claim items
      </button>
    </main>
  )
}
