'use client'

import { useState, useRef } from 'react'
import { Check, Copy } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { AVATAR_COLORS } from '@/stores/useBillStore'
import {
  computePersonShareFromClaims,
  computeSubtotalCents,
  formatCents,
} from '@/lib/billMath'
import type { PublicSessionPayload } from '@/lib/sessionSchema'
import type { PersonId } from '@/stores/useBillStore'
import { AppHeader } from '@/components/wizard/AppHeader'
import { ProgressStrip } from '@/components/wizard/ProgressStrip'
import { getUnclaimedCounts, getUnclaimedItems } from '@/lib/sessionUtils'

export interface PersonResultsScreenProps {
  session: PublicSessionPayload
  personId: PersonId            // current user — pinned first; their card expanded, others collapsed
  currencyCode: string          // from session.currencyCode ?? 'USD'
  onAddTip: () => void          // opens Tip Dialog in parent (Plan 04 wires this)
  onEditBill: () => void        // parent calls handleBackToClaiming (done:false)
  sessionId: string             // for localStorage clear on New Split
}

export function PersonResultsScreen({
  session,
  personId,
  currencyCode,
  onAddTip,
  onEditBill,
}: PersonResultsScreenProps) {
  // Accordion state (R3-2): the current user's card is expanded by default; everyone
  // else's card starts collapsed. collapsedIds tracks which cards are collapsed, so it
  // is seeded with every OTHER person's id on first render.
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(
    () => new Set(session.people.filter((p) => p.id !== personId).map((p) => p.id))
  )

  // Share summary state
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)

  // G5: Unclaimed confirm dialog
  const [showUnclaimedConfirm, setShowUnclaimedConfirm] = useState(false)

  // R3-4: "I paid" swipe affordance. Swipe right marks a card paid, swipe left reverses.
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set())
  const [paidToast, setPaidToast] = useState<string | null>(null)
  // Single in-flight gesture (touches are sequential), so module-scoped refs are safe:
  // remember where the touch began and whether it became a horizontal swipe so the
  // subsequent click (collapse toggle) can be suppressed.
  const touchStartXRef = useRef(0)
  const touchStartYRef = useRef(0)
  const swipedRef = useRef(false)

  function showPaidToast(message: string) {
    setPaidToast(message)
    setTimeout(() => setPaidToast(null), 2000)
  }

  function setPaid(id: string, name: string, paid: boolean) {
    setPaidIds((prev) => {
      const next = new Set(prev)
      if (paid) next.add(id)
      else next.delete(id)
      return next
    })
    showPaidToast(paid ? `${name} — I have paid ✓` : `${name} — marked unpaid`)
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartXRef.current = e.touches[0]?.clientX ?? 0
    touchStartYRef.current = e.touches[0]?.clientY ?? 0
    swipedRef.current = false
  }

  function handleTouchEnd(e: React.TouchEvent, id: string, name: string) {
    const endX = e.changedTouches[0]?.clientX ?? 0
    const endY = e.changedTouches[0]?.clientY ?? 0
    const dx = endX - touchStartXRef.current
    const dy = endY - touchStartYRef.current
    // Horizontal swipe of >60px that is more horizontal than vertical.
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      swipedRef.current = true
      setPaid(id, name, dx > 0) // right → paid, left → unpaid
    }
  }

  const grandTotal = computeSubtotalCents(session.items)

  // Unclaimed detection (D-03, D-04)
  const { unclaimed: unclaimedCount } = getUnclaimedCounts(session)
  const unclaimedItems = getUnclaimedItems(session)

  // G1: Pin current user's card to top; others after in existing order
  const sortedPeople = [
    ...session.people.filter((p) => p.id === personId),
    ...session.people.filter((p) => p.id !== personId),
  ]

  function handleCardTap(id: string) {
    // R3-4: if the gesture was a horizontal swipe, swallow the synthesized click so a
    // swipe doesn't also toggle the accordion.
    if (swipedRef.current) {
      swipedRef.current = false
      return
    }
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function handleShareSummary() {
    setCopyError(null)
    const lines = session.people.map((p) => {
      const share = computePersonShareFromClaims(
        p.id,
        session.items,
        session.claims?.items ?? {},
        0  // item share only (D-04) — no tip in summary
      )
      return `${p.name} owes ${formatCents(share.itemSubtotal, currencyCode)}`
    })
    lines.push(`Total: ${formatCents(grandTotal, currencyCode)}`)
    const text = lines.join('\n')

    // Try navigator.share first (mobile-friendly), fall back to clipboard
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ text })
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        return
      } catch {
        // fall through to clipboard
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        return
      } catch {
        // fall through to execCommand fallback
      }
    }

    // execCommand fallback (BillViewHeader pattern)
    const el = document.createElement('textarea')
    el.value = text
    el.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
    document.body.appendChild(el)
    el.focus()
    el.select()
    const success = document.execCommand('copy')
    document.body.removeChild(el)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } else {
      setCopyError("Couldn't copy — try again")
    }
  }

  return (
    <>
      <main className="mx-auto min-h-screen max-w-[480px] bg-background pb-[200px]">
        {/* G7: AppHeader + progress strip (results = segment 3) */}
        <AppHeader />
        <ProgressStrip filled={3} />

        <div className="flex flex-col gap-6 px-6 py-8">
          {/* D-04: conditional headline — playful when unclaimed, positive when fully claimed */}
          <h1 className="text-[20px] font-semibold leading-[1.2]">
            {unclaimedCount > 0
              ? `Hold up — ${unclaimedCount} item${unclaimedCount === 1 ? '' : 's'} still up for grabs!`
              : "You're all set!"}
          </h1>

          {/* D-03 + G5 + G6: unclaimed items section — only when items remain unclaimed */}
          {unclaimedCount > 0 && (
            <div
              role="button"
              tabIndex={0}
              aria-label="View unclaimed items — tap to edit"
              onClick={() => setShowUnclaimedConfirm(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setShowUnclaimedConfirm(true)
              }}
              className="cursor-pointer rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 hover:bg-amber-100 transition-colors"
            >
              <p className="text-[14px] font-medium text-amber-800 mb-2">Unclaimed items</p>
              {/* R3-5: always list every unclaimed item (no count-collapse). */}
              <ul className="flex flex-col gap-1">
                {unclaimedItems.map((item) => (
                  <li key={item.id} className="text-[14px] text-amber-700">{item.name}</li>
                ))}
              </ul>
            </div>
          )}

          {/* G1: All-people accordion — current user pinned to top, expanded; others collapsed */}
          <div className="flex flex-col gap-6">
            {sortedPeople.map((person) => {
              const tipCents = person.id === personId ? (session.tips?.[personId] ?? 0) : 0
              const share = computePersonShareFromClaims(
                person.id,
                session.items,
                session.claims?.items ?? {},
                tipCents
              )
              const isCurrentUser = person.id === personId
              // Current user expanded by default; everyone else collapsed (R3-2).
              const isExpanded = !collapsedIds.has(person.id)
              const isPaid = paidIds.has(person.id)

              return (
                <div
                  key={person.id}
                  className="relative rounded-xl border border-border bg-card"
                  onTouchStart={handleTouchStart}
                  onTouchEnd={(e) => handleTouchEnd(e, person.id, person.name)}
                >
                  {/* R3-4: "Paid" chip — top-right, shown after a swipe-right */}
                  {isPaid && (
                    <span
                      data-testid={`paid-chip-${person.id}`}
                      className="absolute right-3 top-3 z-10 rounded-full bg-green-100 px-2.5 py-0.5 text-[12px] font-semibold text-green-700"
                    >
                      Paid
                    </span>
                  )}
                  {/* Card header — always visible */}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    aria-label={`${person.name}'s breakdown`}
                    onClick={() => handleCardTap(person.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleCardTap(person.id)
                    }}
                    className="flex cursor-pointer items-center gap-3 p-4"
                  >
                    {/* Avatar */}
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white font-semibold ${AVATAR_COLORS[person.colorIndex % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]}`}
                      aria-hidden="true"
                    >
                      {person.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Name + total */}
                    <div className="flex flex-col">
                      <span className="text-[14px] font-medium text-foreground">{person.name}</span>
                      <span
                        className="text-[28px] font-semibold text-amber-600"
                        data-testid={isCurrentUser ? 'results-total' : undefined}
                      >
                        {isCurrentUser
                          ? formatCents(share.total, currencyCode)
                          : formatCents(share.itemSubtotal, currencyCode)}
                      </span>
                      <span className="text-[14px] text-zinc-500">
                        {isCurrentUser ? 'Your share' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t border-border px-4 pb-4 pt-3">
                      {share.lineItems.length === 0 ? (
                        <p className="text-[14px] text-zinc-400">Nothing claimed yet</p>
                      ) : (
                        <ul className="flex flex-col gap-1" data-testid={isCurrentUser ? 'results-line-items' : undefined}>
                          {share.lineItems.map(({ item, shareCents, claimedQty }) => (
                            <li
                              key={item.id}
                              className="flex justify-between text-[14px]"
                              data-testid={isCurrentUser ? `results-row-${item.id}` : `results-row-${person.id}-${item.id}`}
                            >
                              <span>
                                {item.name}
                                {claimedQty > 1 && (
                                  <span className="ml-1 text-zinc-400">×{claimedQty}</span>
                                )}
                              </span>
                              <span>{formatCents(shareCents, currencyCode)}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Current user: Subtotal (items only) + tip + in-card Total rows */}
                      {isCurrentUser && (
                        <>
                          <div
                            className="mt-1 flex justify-between text-[14px]"
                            data-testid="results-subtotal"
                          >
                            <span>Subtotal</span>
                            <span>{formatCents(share.itemSubtotal, currencyCode)}</span>
                          </div>
                          <Separator className="my-2" />
                          <div className="flex flex-col gap-1">
                            <div
                              className="flex justify-between text-[14px]"
                              data-testid="results-tip"
                            >
                              <span>Your tip</span>
                              <span>{formatCents(share.tip, currencyCode)}</span>
                            </div>
                          </div>
                          <Separator className="my-2" />
                          <div
                            className="flex justify-between text-[14px] font-semibold"
                            data-testid="results-card-total"
                          >
                            <span>Total</span>
                            <span>{formatCents(share.total, currencyCode)}</span>
                          </div>

                          {/* G3: "Add a tip?" as inline clickable text (no button chrome) */}
                          <div className="mt-3">
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={onAddTip}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') onAddTip()
                              }}
                              className="cursor-pointer text-[14px] text-amber-600"
                            >
                              Add a tip?
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Grand total row (items only, D-03) */}
          <div className="my-8 flex justify-between border-t border-border pt-4 text-[16px] font-semibold">
            <span>Total</span>
            <span data-testid="results-grand-total">
              {formatCents(grandTotal, currencyCode)}
            </span>
          </div>
        </div>
      </main>

      {/* R3-4: transient "I have paid" toast triggered by swiping a card */}
      {paidToast && (
        <div
          role="status"
          data-testid="paid-toast"
          className="fixed bottom-[96px] left-1/2 z-50 -translate-x-1/2 rounded-full bg-zinc-900 px-4 py-2 text-[14px] font-medium text-white shadow-lg"
        >
          {paidToast}
        </div>
      )}

      {/* Fixed bottom CTA bar — G2+G4: two half-width buttons */}
      <div
        className="fixed bottom-0 left-0 right-0 mx-auto max-w-[480px] border-t border-border bg-background px-6 py-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        <div className="flex flex-col gap-2">
          {/* Copy error inline */}
          {copyError && (
            <p role="alert" className="text-[14px] text-red-600">{copyError}</p>
          )}

          {/* G2+G4: Two half-width buttons in a row */}
          <div className="flex gap-3">
            {/* Edit bill (outline, left) */}
            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1"
              onClick={onEditBill}
            >
              Edit bill
            </Button>

            {/* Share summary (amber, right) */}
            <Button
              type="button"
              className="h-12 flex-1 bg-amber-600 hover:bg-amber-700"
              onClick={handleShareSummary}
              aria-label={copied ? 'Summary copied' : 'Copy summary to clipboard'}
            >
              {copied ? <Check size={16} aria-hidden="true" className="mr-2" /> : <Copy size={16} aria-hidden="true" className="mr-2" />}
              {copied ? 'Copied!' : 'Share summary'}
            </Button>
          </div>
        </div>
      </div>

      {/* G5: Unclaimed confirm dialog */}
      <Dialog open={showUnclaimedConfirm} onOpenChange={setShowUnclaimedConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add owners for unclaimed items?</DialogTitle>
            <DialogDescription>
              This takes you back to editing the bill.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="h-12 w-full bg-amber-600 hover:bg-amber-700"
              onClick={() => {
                setShowUnclaimedConfirm(false)
                onEditBill()
              }}
            >
              Edit bill
            </Button>
            <Button
              variant="outline"
              className="h-12 w-full"
              onClick={() => setShowUnclaimedConfirm(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
