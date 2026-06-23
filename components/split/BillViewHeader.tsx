'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { AVATAR_COLORS } from '@/stores/useBillStore'
import type { PersonId } from '@/stores/useBillStore'
import type { SessionPayload } from '@/lib/sessionSchema'

/** Maximum number of "other people" circles shown before the +N overflow badge. */
const MAX_STRIP_AVATARS = 3

interface BillViewHeaderProps {
  session: SessionPayload
  myPersonId: PersonId | null
  onStripTap: () => void
  sessionId: string
}

/**
 * Bill View chrome header.
 *
 * Row 1: bill title ("Bill — 23 June 2026") + share button right-aligned.
 * Row 2: people strip — own-identity as coral expanded pill; others as compact circles;
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

  // Active person's own avatar color (raw hex) — used to highlight their pill
  // in their own color instead of coral, so the chip reads as "you" by color.
  const myColorHex = (
    AVATAR_COLORS[(myPerson?.colorIndex ?? 0) % AVATAR_COLORS.length] ??
    AVATAR_COLORS[0]
  )
    .replace('bg-[', '')
    .replace(']', '')

  // Bill name uses the full creation date — OCR has no merchant field (RESEARCH Pitfall 7),
  // so we name it "Bill — {DD Month YYYY}" e.g. "Bill — 23 June 2026".
  const billTitle = `Bill — ${new Date(session.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })}`

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
    <div className="bg-background border-b border-zinc-100 px-4 pt-3 pb-2">
      {/* Row 1: bill title */}
      <div className="min-w-0">
        <h1 className="text-[20px] font-semibold text-zinc-900 leading-[1.2]">
          {billTitle}
        </h1>
      </div>

      {/* Row 2: people strip (left) + Invite button (right), bottom-aligned together */}
      <div className="mt-2 pb-1 flex items-end justify-between gap-2">
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
            className="flex items-center gap-2 h-8 rounded-full border-2 pl-0.5 pr-3"
            style={{
              zIndex: otherPeople.length + 2,
              position: 'relative',
              backgroundColor: '#ffffff',
              borderColor: myColorHex,
            }}
          >
            {/* Avatar circle inside the pill */}
            <span
              className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white ${AVATAR_COLORS[(myPerson.colorIndex ?? 0) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]}`}
              aria-hidden="true"
            >
              {myPerson.name.charAt(0).toUpperCase()}
            </span>
            <span className="text-[14px] font-semibold text-zinc-900 whitespace-nowrap">
              {myPerson.name}
            </span>
          </div>
        )}

        {/* Other people — compact circles overlapping with negative margin + paper ring */}
        {visibleOthers.map((person, i) => {
          const colorClass =
            AVATAR_COLORS[(person.colorIndex ?? 0) % AVATAR_COLORS.length] ??
            AVATAR_COLORS[0]
          return (
            <span
              key={person.id}
              title={person.name}
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-paper -ml-3 ${colorClass}`}
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
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[14px] font-semibold text-zinc-500 ring-2 ring-paper -ml-3"
            style={{ zIndex: 0, position: 'relative' }}
          >
            +{overflowCount}
          </span>
        )}
        </div>

        {/* Invite button — sibling of the strip so it doesn't trigger change-identity */}
        <button
          type="button"
          aria-label="Invite — copy bill link"
          onClick={handleShare}
          className="flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-coral-500 px-3 text-white transition-colors"
        >
          {copied ? (
            <Check size={18} aria-hidden="true" />
          ) : (
            <Share2 size={18} aria-hidden="true" />
          )}
          <span className="text-[13px] font-medium whitespace-nowrap">{copied ? 'Copied!' : 'Invite'}</span>
        </button>
      </div>
    </div>
  )
}
