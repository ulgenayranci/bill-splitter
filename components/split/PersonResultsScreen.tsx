'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { useRouter } from 'next/navigation'
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

const COMMON_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR']

export interface PersonResultsScreenProps {
  session: PublicSessionPayload
  personId: PersonId            // current user — always expanded
  currencyCode: string          // from session.currencyCode ?? 'USD'
  onAddTip: () => void          // opens Tip Dialog in parent (Plan 04 wires this)
  onEditBill: () => void        // parent calls handleBackToClaiming (done:false)
  onCurrencyChange: (code: string) => Promise<void>  // REQUIRED — parent owns the /edit write + mutate(); this screen only calls it
  sessionId: string             // for localStorage clear on New Split + currency POST
}

export function PersonResultsScreen({
  session,
  personId,
  currencyCode,
  onAddTip,
  onEditBill,
  onCurrencyChange,
  sessionId,
}: PersonResultsScreenProps) {
  const router = useRouter()

  // Accordion state: current user always expanded
  const [expandedId, setExpandedId] = useState<string | null>(personId)

  // Copy summary state
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)

  // New Split confirm dialog
  const [showNewSplitConfirm, setShowNewSplitConfirm] = useState(false)

  const grandTotal = computeSubtotalCents(session.items)

  // Build currency options list
  const currencyOptions = COMMON_CURRENCIES.includes(currencyCode)
    ? COMMON_CURRENCIES
    : [currencyCode, ...COMMON_CURRENCIES]

  function handleCardTap(id: string) {
    if (id === personId) return // current user stays expanded
    setExpandedId((prev) => (prev === id ? null : id))
  }

  async function handleCopySummary() {
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

  function handleNewSplit() {
    try {
      localStorage.removeItem(`split:${sessionId}:personId`)
    } catch {
      // localStorage unavailable in private browsing — silently ignore
    }
    router.push('/')
  }

  async function handleCurrencyChange(newCode: string) {
    await onCurrencyChange(newCode)
  }

  return (
    <>
      <main className="mx-auto min-h-screen max-w-[480px] bg-background pb-[200px]">
        <AppHeader />
        <div className="flex flex-col gap-6 px-6 py-8">
          <h1 className="text-[20px] font-semibold leading-[1.2]">You&rsquo;re all set!</h1>

          {/* All-people accordion */}
          <div className="flex flex-col gap-6">
            {session.people.map((person) => {
              const tipCents = person.id === personId ? (session.tips?.[personId] ?? 0) : 0
              const share = computePersonShareFromClaims(
                person.id,
                session.items,
                session.claims?.items ?? {},
                tipCents
              )
              const isCurrentUser = person.id === personId
              // Current user is always expanded; others toggle via expandedId
              const isExpanded = isCurrentUser || expandedId === person.id

              return (
                <div key={person.id} className="rounded-xl border border-border bg-card">
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

                      {/* Current user: tip + total rows */}
                      {isCurrentUser && (
                        <>
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

          {/* Inline currency override (D-06) */}
          <div className="flex items-center gap-2 text-[14px] text-zinc-500">
            <label htmlFor="currency-select" className="shrink-0">Currency:</label>
            <select
              id="currency-select"
              value={currencyCode}
              onChange={(e) => void handleCurrencyChange(e.target.value)}
              className="rounded border border-border bg-background px-2 py-1 text-[14px] text-foreground"
            >
              {currencyOptions.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>

          {/* Add a tip button */}
          <button
            type="button"
            onClick={onAddTip}
            className="text-[14px] text-amber-600 underline self-start"
          >
            Add a tip?
          </button>
        </div>
      </main>

      {/* Fixed bottom CTA bar */}
      <div
        className="fixed bottom-0 left-0 right-0 mx-auto max-w-[480px] border-t border-border bg-background px-6 py-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        <div className="flex flex-col gap-2">
          {/* Copy error inline */}
          {copyError && (
            <p role="alert" className="text-[14px] text-red-600">{copyError}</p>
          )}

          {/* Copy summary */}
          <Button
            type="button"
            className="h-12 w-full bg-amber-600 hover:bg-amber-700"
            onClick={handleCopySummary}
            aria-label={copied ? 'Summary copied' : 'Copy summary to clipboard'}
          >
            {copied ? <Check size={16} aria-hidden="true" className="mr-2" /> : <Copy size={16} aria-hidden="true" className="mr-2" />}
            {copied ? 'Copied!' : 'Copy summary'}
          </Button>

          {/* Edit bill */}
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full"
            onClick={onEditBill}
          >
            Edit bill
          </Button>

          {/* New Split */}
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full"
            onClick={() => setShowNewSplitConfirm(true)}
          >
            New Split
          </Button>
        </div>
      </div>

      {/* New Split confirm dialog */}
      <Dialog open={showNewSplitConfirm} onOpenChange={setShowNewSplitConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a new split?</DialogTitle>
            <DialogDescription>
              This clears your local progress. Other people on this bill are not affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="h-12 w-full bg-amber-600 hover:bg-amber-700"
              onClick={() => {
                setShowNewSplitConfirm(false)
                handleNewSplit()
              }}
            >
              New Split
            </Button>
            <Button
              variant="outline"
              className="h-12 w-full"
              onClick={() => setShowNewSplitConfirm(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
