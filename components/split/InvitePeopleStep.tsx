'use client'

import { useState } from 'react'
import { Share2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppHeader } from '@/components/wizard/AppHeader'
import { ProgressStrip } from '@/components/wizard/ProgressStrip'

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
 * header). Sits under the app header + 3-step progress strip (step 1 of 3:
 * invite → claim → results). Skip and Share link are the only two actions;
 * `handleShare` clipboard-copies when the native share sheet is unavailable, so
 * copying stays covered without a separate button.
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

  // Native share sheet first (mobile), falling back to clipboard copy.
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

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <ProgressStrip filled={1} />

      <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col items-center gap-6 px-6 pt-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-coral-100">
          <Users size={32} className="text-coral-600" aria-hidden="true" />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-[24px] font-semibold text-zinc-900">Invite your group</h1>
          <p className="text-[16px] text-zinc-500">
            Send everyone the link so they can claim what they had. You can also share it later from the bill.
          </p>
        </div>

        <div className="mt-2 flex w-full gap-3">
          <Button variant="outline" onClick={onContinue} className="h-12 flex-1">
            Skip
          </Button>
          <Button onClick={handleShare} className="h-12 flex-1 bg-coral-500">
            <Share2 size={18} className="mr-2" aria-hidden="true" />
            {copied ? 'Copied!' : 'Share link'}
          </Button>
        </div>
      </main>
    </div>
  )
}
