'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { AVATAR_COLORS } from '@/stores/useBillStore'
import type { PersonId } from '@/stores/useBillStore'
import type { SessionPayload } from '@/lib/sessionSchema'

/** Maximum number of "other people" circles shown before the +N overflow badge. */
const MAX_STRIP_AVATARS = 3

/**
 * Format a Unix-ms timestamp as "Mon DD" — e.g. "Jun 26".
 * RESEARCH Pitfall 7: no merchant field in schema; always falls back to "Bill — {Mon DD}".
 */
export function formatBillDate(createdAt: number): string {
  return new Date(createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

interface BillViewHeaderProps {
  session: SessionPayload
  myPersonId: PersonId | null
  onStripTap: () => void
  sessionId: string
}

/**
 * Bill View chrome header.
 *
 * Row 1: bill title ("Bill — Jun 26") + date line + receipt/share icons right-aligned.
 * Row 2: people strip — own-identity as amber expanded pill; others as compact circles;
 *         overflow "+N" badge when more than MAX_STRIP_AVATARS=3 others.
 * The entire people strip is tappable (D-03 change-identity via onStripTap).
 */
export function BillViewHeader({
  session,
  myPersonId,
  onStripTap,
  sessionId,
}: BillViewHeaderProps) {
  const [copied, setCopied] = useState(false)

  const myPerson = myPersonId
    ? session.people.find((p) => p.id === myPersonId) ?? null
    : null

  const otherPeople = session.people.filter((p) => p.id !== myPersonId)
  const visibleOthers = otherPeople.slice(0, MAX_STRIP_AVATARS)
  const overflowCount = Math.max(0, otherPeople.length - MAX_STRIP_AVATARS)

  const billTitle = `Bill — ${formatBillDate(session.createdAt)}`

  // Full date line (e.g. "26 Jun 2025") for the secondary row
  const dateLineFull = new Date(session.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  async function handleShare() {
    const origin =
      typeof window !== 'undefined'
        ? process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
        : ''
    const url = `${origin}/split/${sessionId}`

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ url, title: 'Split the bill' })
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        return
      } catch {
        // fall through
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        return
      } catch {
        // fall through
      }
    }

    // execCommand fallback
    const el = document.createElement('textarea')
    el.value = url
    el.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
    document.body.appendChild(el)
    el.focus()
    el.select()
    const success = document.execCommand('copy')
    document.body.removeChild(el)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="bg-white border-b border-zinc-100 px-4 pt-3 pb-2">
      {/* Row 1: bill title + date (left) + Share button (right) */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h1 className="text-[20px] font-semibold text-zinc-900 leading-[1.2]">
            {billTitle}
          </h1>
          <p className="text-[14px] text-zinc-400 mt-0.5">{dateLineFull}</p>
        </div>
        {/* Share button — top-right */}
        <button
          type="button"
          aria-label="Share bill link"
          onClick={handleShare}
          className="flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 text-white hover:bg-amber-700 transition-colors"
        >
          {copied ? (
            <Check size={18} aria-hidden="true" />
          ) : (
            <Share2 size={18} aria-hidden="true" />
          )}
          <span className="text-[13px] font-medium">{copied ? 'Copied!' : 'Share'}</span>
        </button>
      </div>

      {/* Row 2: people strip alone */}
      <div className="mt-2 pb-1">
        {/* People facepile — tappable to change identity */}
        <div
          role="button"
          tabIndex={0}
          aria-label="People — tap to change identity"
          onClick={onStripTap}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onStripTap()
          }}
          className="flex items-center cursor-pointer"
        >
        {/* Own-identity expanded pill — leftmost, highest z-index, no negative margin */}
        {myPerson && (
          <div
            className="flex items-center gap-2 h-8 rounded-full bg-amber-50 border border-amber-400 px-3"
            style={{ zIndex: otherPeople.length + 2, position: 'relative' }}
          >
            {/* Avatar circle inside the pill */}
            <span
              className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ${AVATAR_COLORS[(myPerson.colorIndex ?? 0) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]}`}
              aria-hidden="true"
            >
              {myPerson.name.charAt(0).toUpperCase()}
            </span>
            <span className="text-[14px] font-semibold text-zinc-900 whitespace-nowrap">
              {myPerson.name}
            </span>
          </div>
        )}

        {/* Other people — compact circles overlapping with negative margin + white ring */}
        {visibleOthers.map((person, i) => {
          const colorClass =
            AVATAR_COLORS[(person.colorIndex ?? 0) % AVATAR_COLORS.length] ??
            AVATAR_COLORS[0]
          return (
            <span
              key={person.id}
              title={person.name}
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-white -ml-3 ${colorClass}`}
              style={{ zIndex: otherPeople.length + 1 - i, position: 'relative' }}
              aria-hidden="true"
            >
              {person.name.charAt(0).toUpperCase()}
            </span>
          )
        })}

        {/* Overflow badge — overlapping, lowest z-index */}
        {overflowCount > 0 && (
          <span
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[14px] font-semibold text-zinc-500 ring-2 ring-white -ml-3"
            style={{ zIndex: 0, position: 'relative' }}
          >
            +{overflowCount}
          </span>
        )}
        </div>
      </div>
    </div>
  )
}
