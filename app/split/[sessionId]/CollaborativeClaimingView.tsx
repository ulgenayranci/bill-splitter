'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Check, X, Plus, Pencil, Share2 } from 'lucide-react'
import { parseCents } from '@/lib/billMath'
import type { SessionPayload } from '@/lib/sessionSchema'
import type { ItemId, PersonId, Person } from '@/stores/useBillStore'
import { IdentityModal } from '@/components/split/IdentityModal'
import { BillViewHeader } from '@/components/split/BillViewHeader'
import { UnclaimedBanner } from '@/components/split/UnclaimedBanner'
import { ClaimableItemCard } from '@/components/split/ClaimableItemCard'
import { SessionExpiredScreen } from '@/components/split/SessionExpiredScreen'
import { TipScreen } from '@/components/split/TipScreen'
import { PersonResultsScreen } from '@/components/split/PersonResultsScreen'
import { computePersonShareFromClaims } from '@/lib/billMath'

type InlineForm =
  | { kind: 'add'; name: string; price: string; qty: string; error: string | null }
  | { kind: 'edit'; itemId: ItemId; name: string; price: string; qty: string; originalName: string; originalPrice: string; originalQty: string; error: string | null }

class SessionNotFoundError extends Error {}

function claimErrorMessage(err: unknown, type: 'save' | 'submit'): string {
  if (!navigator.onLine || err instanceof TypeError) {
    return "You're offline — reconnect and tap to retry"
  }
  return type === 'save' ? "Couldn't save — tap to retry" : "Couldn't submit — tap to retry"
}

const fetcher = (url: string): Promise<SessionPayload> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new SessionNotFoundError('session_not_found')
    return r.json()
  })

interface CollaborativeClaimingViewProps {
  sessionId: string
}

type Phase = 'claiming' | 'tip' | 'results'

/** Count items whose total claimed qty is below their quantity (mirrors UnclaimedBanner). */
function getUnclaimedCounts(session: SessionPayload): { unclaimed: number; total: number } {
  let unclaimed = 0
  for (const item of session.items) {
    const entries = session.claims?.items?.[item.id] ?? {}
    const totalClaimed = Object.values(entries).reduce((sum, e) => sum + (e?.qty ?? 0), 0)
    if (totalClaimed < (item.quantity ?? 1)) unclaimed++
  }
  return { unclaimed, total: session.items.length }
}

/** Derive which phase a returning guest should land on based on persisted server state.
 *  D-12: no 'waiting' branch — results are reachable regardless of unclaimed items. */
function derivePhase(personId: PersonId, session: SessionPayload): Phase {
  if (session.tips?.[personId] !== undefined) return 'results'
  if (session.claims?.donePeople?.[personId]) {
    return 'tip'
  }
  return 'claiming'
}

export function CollaborativeClaimingView({
  sessionId,
}: CollaborativeClaimingViewProps) {
  const [selectedPersonId, setSelectedPersonId] = useState<PersonId | null>(null)
  const [itemErrors, setItemErrors] = useState<Record<ItemId, string>>({})
  const [doneError, setDoneError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('claiming')

  // Identity modal state (IDENT-01/03): changingIdentity controls dismissibility.
  const [identityModalOpen, setIdentityModalOpen] = useState(false)
  const [changingIdentity, setChangingIdentity] = useState(false)

  // Warn-but-allow done flow (D-09): dialog open state.
  const [showUnclaimedWarning, setShowUnclaimedWarning] = useState(false)
  const [warningLinkCopied, setWarningLinkCopied] = useState(false)

  const swrKey = `/api/session/${sessionId}`
  const { data: session, error, mutate } = useSWR<SessionPayload>(swrKey, fetcher, {
    refreshInterval: 3000,
    revalidateOnFocus: false,
  })

  // WR-06: one-shot guard for the identity-restore effect. Using a ref (instead of an
  // eslint-disable that omits selectedPersonId from deps) ensures the restore/modal-trigger
  // runs exactly once on the session's first arrival, not on every 3s refreshInterval poll
  // while selectedPersonId is still null.
  const restoreAttempted = useRef(false)

  // Persist guest's chosen identity to localStorage so page refresh can restore it (IDENT-04).
  // The key is scoped to the sessionId so multiple sessions don't interfere.
  useEffect(() => {
    if (selectedPersonId !== null) {
      try {
        localStorage.setItem(`split:${sessionId}:personId`, selectedPersonId)
      } catch {
        // localStorage may be unavailable in private browsing — silently ignore.
      }
    }
  }, [selectedPersonId, sessionId])

  // Identity restore / modal trigger (IDENT-01/02): when session loads and no identity
  // is selected, restore from localStorage if the stored slot is still locked on the
  // server; otherwise open the Who-are-you modal.
  useEffect(() => {
    if (!session) return
    // WR-06: run once on first session arrival. The ref (not an exhaustive-deps suppression)
    // prevents re-running on every refreshInterval poll while no identity is selected, which
    // previously re-read localStorage and could re-open the modal on each poll tick.
    if (restoreAttempted.current) return
    restoreAttempted.current = true

    let stored: string | null = null
    try {
      stored = localStorage.getItem(`split:${sessionId}:personId`)
    } catch {
      // localStorage unavailable — cannot restore
    }

    if (stored && session.claims?.personSlots?.[stored] === true) {
      setSelectedPersonId(stored as PersonId)
      setPhase(derivePhase(stored as PersonId, session))
    } else {
      setIdentityModalOpen(true) // no (valid) stored identity — show modal
    }
  }, [session, sessionId])

  const peopleById = useMemo<Record<PersonId, Person>>(() => {
    if (!session) return {}
    return Object.fromEntries(session.people.map((p) => [p.id, p]))
  }, [session])

  const [inlineForm, setInlineForm] = useState<InlineForm | null>(null)
  const [inlineSubmitting, setInlineSubmitting] = useState(false)

  if (error instanceof SessionNotFoundError) return <SessionExpiredScreen />
  if (!session) return <div role="status" className="p-6">Loading…</div>

  async function handleSelect(personId: PersonId) {
    try {
      const body: Record<string, unknown> = { personId, action: 'slot' }
      const res = await fetch(`/api/session/${sessionId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        await mutate()
        return
      }
      const data = (await res.json()) as { ok: boolean; reason?: string }
      if (data.ok) {
        setSelectedPersonId(personId)
        setIdentityModalOpen(false)
        setChangingIdentity(false)
      } else {
        await mutate()
      }
    } catch {
      await mutate()
    }
  }

  // IDENT-03: "I'm not listed" — create a person via /edit add_person and adopt that identity.
  async function handleAddPerson(name: string) {
    try {
      const res = await fetch(`/api/session/${sessionId}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'add_person', name }),
      })
      if (!res.ok) {
        await mutate()
        return
      }
      const data = (await res.json()) as { ok: boolean; personId?: string }
      if (data.ok && data.personId) {
        // Refresh session first so the new person exists locally before we adopt the identity.
        await mutate()
        setSelectedPersonId(data.personId as PersonId)
        try {
          localStorage.setItem(`split:${sessionId}:personId`, data.personId)
        } catch {
          // private browsing — ignore
        }
        setIdentityModalOpen(false)
        setChangingIdentity(false)
      } else {
        await mutate()
      }
    } catch {
      await mutate()
    }
  }

  async function handleQtyChange(itemId: ItemId, newQty: number) {
    if (!selectedPersonId || !session) return
    const personId = selectedPersonId

    // Build optimistic SessionPayload snapshot
    const claimsForItem = { ...(session.claims?.items?.[itemId] ?? {}) }
    if (newQty === 0) {
      delete claimsForItem[personId]
    } else {
      claimsForItem[personId] = { qty: newQty }
    }
    const nextItems: SessionPayload['claims']['items'] = { ...session.claims?.items }
    if (Object.keys(claimsForItem).length === 0) {
      delete nextItems[itemId]
    } else {
      nextItems[itemId] = claimsForItem
    }
    const optimistic: SessionPayload = {
      ...session,
      claims: {
        items: nextItems,
        personSlots: session.claims?.personSlots ?? {},
        donePeople: session.claims?.donePeople ?? {},
      },
    }

    try {
      await mutate(
        async () => {
          const res = await fetch(`/api/session/${sessionId}/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ personId, itemId, qty: newQty, action: 'qty' }),
          })
          if (!res.ok) throw new Error('claim_failed')
          // Re-fetch ground truth (server may have new state from other claimants)
          return fetcher(swrKey)
        },
        {
          optimisticData: optimistic,
          rollbackOnError: true,
          revalidate: true,
        }
      )
      setItemErrors((prev) => {
        if (!prev[itemId]) return prev
        const next = { ...prev }
        delete next[itemId]
        return next
      })
    } catch (err) {
      setItemErrors((prev) => ({ ...prev, [itemId]: claimErrorMessage(err, 'save') }))
    }
  }

  // CLAIM-02 (D-13): tap-to-join/leave a single-qty item via the bounds-check-free share action.
  // Mirrors handleQtyChange's optimistic mutate + rollbackOnError.
  async function handleShareChange(itemId: ItemId, joining: boolean) {
    if (!selectedPersonId || !session) return
    const personId = selectedPersonId

    const claimsForItem = { ...(session.claims?.items?.[itemId] ?? {}) }
    if (joining) {
      claimsForItem[personId] = { qty: 1 }
    } else {
      delete claimsForItem[personId]
    }
    const nextItems: SessionPayload['claims']['items'] = { ...session.claims?.items }
    if (Object.keys(claimsForItem).length === 0) {
      delete nextItems[itemId]
    } else {
      nextItems[itemId] = claimsForItem
    }
    const optimistic: SessionPayload = {
      ...session,
      claims: {
        items: nextItems,
        personSlots: session.claims?.personSlots ?? {},
        donePeople: session.claims?.donePeople ?? {},
      },
    }

    try {
      await mutate(
        async () => {
          const res = await fetch(`/api/session/${sessionId}/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ personId, itemId, action: 'share', joining }),
          })
          if (!res.ok) throw new Error('share_failed')
          return fetcher(swrKey)
        },
        {
          optimisticData: optimistic,
          rollbackOnError: true,
          revalidate: true,
        }
      )
      setItemErrors((prev) => {
        if (!prev[itemId]) return prev
        const next = { ...prev }
        delete next[itemId]
        return next
      })
    } catch (err) {
      setItemErrors((prev) => ({ ...prev, [itemId]: claimErrorMessage(err, 'save') }))
    }
  }

  // D-10: scroll the first unclaimed item into view (banner tap target).
  function scrollToFirstUnclaimed() {
    if (!session) return
    const first = session.items.find((item) => {
      const entries = session.claims?.items?.[item.id] ?? {}
      const totalClaimed = Object.values(entries).reduce((sum, e) => sum + (e?.qty ?? 0), 0)
      return totalClaimed < (item.quantity ?? 1)
    })
    if (first) {
      document.getElementById(`item-${first.id}`)?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // The original done submission — runs directly when everything is claimed,
  // or via "Continue anyway" from the unclaimed warning dialog (D-12).
  async function submitDone() {
    if (!selectedPersonId || !session) return
    setDoneError(null)
    try {
      const res = await fetch(`/api/session/${sessionId}/done`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId: selectedPersonId, done: true }),
      })
      if (!res.ok) throw new Error(`done route returned ${res.status}`)
      await mutate(() => fetcher(swrKey))
      setPhase('tip')
    } catch (err) {
      console.error('Done submission failed:', err)
      setDoneError(claimErrorMessage(err, 'submit'))
    }
  }

  // D-09: warn-but-allow — with unclaimed items, open the warning dialog instead of advancing.
  async function handleDone() {
    if (!selectedPersonId || !session) return
    const { unclaimed } = getUnclaimedCounts(session)
    if (unclaimed > 0) {
      setShowUnclaimedWarning(true)
      return
    }
    await submitDone()
  }

  // D-11: share-link CTA inside the warning dialog (same link semantics as the header icon).
  async function handleWarningShare() {
    const origin =
      typeof window !== 'undefined'
        ? process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
        : ''
    const url = `${origin}/split/${sessionId}`

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ url, title: 'Split the bill' })
        setWarningLinkCopied(true)
        setTimeout(() => setWarningLinkCopied(false), 2000)
        return
      } catch {
        // fall through
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url)
        setWarningLinkCopied(true)
        setTimeout(() => setWarningLinkCopied(false), 2000)
      } catch {
        // ignore
      }
    }
  }

  async function handleBackToClaiming() {
    if (!selectedPersonId) return
    try {
      // CR-04: send `done: false` (not `undone: true`). The route requires a boolean `done`
      // field and returns 400 if it is absent. Sending `undone: true` silently failed,
      // leaving the server state as donePeople[personId]=true while the UI showed 'claiming'.
      const res = await fetch(`/api/session/${sessionId}/done`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId: selectedPersonId, done: false }),
      })
      if (!res.ok) {
        console.error('handleBackToClaiming: done route returned', res.status)
      }
      await mutate()
    } catch (err) {
      console.error('handleBackToClaiming failed:', err)
    }
    setPhase('claiming')
  }

  async function handleInlineSubmit() {
    if (!inlineForm || !selectedPersonId) return
    setInlineSubmitting(true)
    try {
      if (inlineForm.kind === 'add') {
        const trimmed = inlineForm.name.trim()
        if (!trimmed) { setInlineForm({ ...inlineForm, error: 'Enter a name' }); return }
        const priceCents = parseCents(inlineForm.price)
        if (!priceCents || priceCents <= 0) { setInlineForm({ ...inlineForm, error: 'Enter a valid price' }); return }
        const res = await fetch(`/api/session/${sessionId}/edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op: 'add',
            name: trimmed, priceCents, quantity: Math.max(1, parseInt(inlineForm.qty, 10) || 1) }),
        })
        if (!res.ok) { setInlineForm({ ...inlineForm, error: "Couldn't save — try again" }); return }
      } else {
        // Send edit_name and/or edit_price/edit_quantity for whatever changed
        const trimmedName = inlineForm.name.trim()
        if (!trimmedName) { setInlineForm({ ...inlineForm, error: 'Enter a name' }); return }
        const newPriceCents = parseCents(inlineForm.price)
        if (!newPriceCents || newPriceCents <= 0) { setInlineForm({ ...inlineForm, error: 'Enter a valid price' }); return }
        const nameChanged = trimmedName !== inlineForm.originalName
        const priceChanged = inlineForm.price.trim() !== inlineForm.originalPrice
        const newQty = Math.max(1, Math.min(99, parseInt(inlineForm.qty, 10) || 1))
        const qtyChanged = String(newQty) !== inlineForm.originalQty
        if (!nameChanged && !priceChanged && !qtyChanged) { setInlineForm(null); return }

        // WR-01: these are three independent POSTs (the server has no combined op). If a later
        // one fails after an earlier one committed, the earlier change is already persisted.
        // Track what actually saved so we can (a) re-sync the UI to server truth via mutate()
        // and (b) report which fields did NOT save, instead of a misleading "nothing saved".
        const saved: string[] = []
        const failed: string[] = []
        const sendOp = async (op: string, extra: Record<string, unknown>, label: string) => {
          const r = await fetch(`/api/session/${sessionId}/edit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ op, itemId: inlineForm.itemId, ...extra }),
          })
          if (r.ok) saved.push(label)
          else failed.push(label)
          return r.ok
        }

        if (nameChanged) await sendOp('edit_name', { newName: trimmedName }, 'name')
        // Continue attempting the remaining fields even if one failed, so the partial-failure
        // report is complete and a transient single-field error doesn't silently skip the rest.
        if (priceChanged) await sendOp('edit_price', { newPriceCents }, 'price')
        if (qtyChanged) await sendOp('edit_quantity', { newQuantity: newQty }, 'quantity')

        if (failed.length > 0) {
          // Re-sync to server truth so the form/list reflects what actually persisted.
          await mutate()
          const savedMsg = saved.length > 0 ? ` Saved: ${saved.join(', ')}.` : ''
          setInlineForm((f) =>
            f ? { ...f, error: `Couldn't save ${failed.join(', ')} — try again.${savedMsg}` } : f
          )
          return
        }
      }
      await mutate()
      setInlineForm(null)
    } catch {
      setInlineForm((f) => f ? { ...f, error: "Couldn't save — try again" } : f)
    } finally {
      setInlineSubmitting(false)
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!session) return
    const claimantCount = Object.keys(session.claims?.items?.[itemId] ?? {}).length
    const itemName = session.items.find((i) => i.id === itemId)?.name ?? 'this item'
    const confirmMessage = claimantCount > 0
      ? `${claimantCount} ${claimantCount === 1 ? 'person has' : 'people have'} claimed ${itemName} — delete anyway?`
      : `Delete ${itemName}?`
    if (!window.confirm(confirmMessage)) return
    try {
      const res = await fetch(`/api/session/${sessionId}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'remove', itemId }),
      })
      if (!res.ok) {
        console.error('Delete failed:', res.status)
        return
      }
      await mutate()
    } catch (err) {
      console.error('Delete request failed:', err)
    }
  }

  // No identity yet — bill view is gated behind the Who-are-you modal (IDENT-01).
  // The full-page PersonSlotPicker gate is gone; the modal overlays a blank shell.
  if (selectedPersonId === null) {
    return (
      <main className="mx-auto min-h-screen max-w-[480px] bg-background">
        <IdentityModal
          open={identityModalOpen}
          allowClose={false}
          session={session}
          onSelect={handleSelect}
          onAddPerson={handleAddPerson}
          onOpenChange={setIdentityModalOpen}
        />
      </main>
    )
  }

  const me = session.people.find((p) => p.id === selectedPersonId)
  if (!me) return <SessionExpiredScreen />

  // Compute the person's itemSubtotal once (used by TipScreen and PersonResultsScreen)
  const personalShare = computePersonShareFromClaims(
    selectedPersonId,
    session.items,
    session.claims?.items ?? {},
    session.tips?.[selectedPersonId] ?? 0
  )

  if (phase === 'tip') {
    return (
      <TipScreen
        sessionId={sessionId}
        personId={selectedPersonId}
        itemSubtotalCents={personalShare.itemSubtotal}
        onTipConfirmed={() => setPhase('results')}
        onBack={() => void handleBackToClaiming()}
        mutate={mutate}
      />
    )
  }

  if (phase === 'results') {
    return <PersonResultsScreen session={session} personId={selectedPersonId} onBack={() => setPhase('tip')} />
  }

  const { unclaimed: unclaimedCount } = getUnclaimedCounts(session)

  return (
    <main className="mx-auto min-h-screen max-w-[480px] bg-background">
      {/* Bill View chrome: header (title/date, people strip, receipt + share icons) */}
      <BillViewHeader
        session={session}
        myPersonId={selectedPersonId}
        onStripTap={() => {
          setChangingIdentity(true)
          setIdentityModalOpen(true)
        }}
        sessionId={sessionId}
      />

      {/* Live unclaimed counter — hidden when everything is claimed (CLAIM-05 / D-10) */}
      <UnclaimedBanner session={session} onTap={scrollToFirstUnclaimed} />

      {/* Item list */}
      <ul className="flex flex-col gap-2 px-6 py-4 pb-[160px]">
        {session.items.map((item) => {
          const claimsForItem = session.claims?.items?.[item.id] ?? {}
          const isEditing = inlineForm?.kind === 'edit' && inlineForm.itemId === item.id
          const originalPrice = (item.priceCents / 100).toFixed(2)
          const isSingleQty = (item.quantity ?? 1) <= 1
          return (
            <li key={item.id} id={`item-${item.id}`} className="flex flex-col gap-1">
              {isEditing ? (
                <Card className="flex flex-row items-start gap-2 px-4 py-3">
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Item name"
                        aria-label="Item name"
                        value={inlineForm.name}
                        onChange={(e) => setInlineForm({ ...inlineForm, name: e.target.value, error: null })}
                        className="flex-1 h-10 text-base"
                        maxLength={100}
                        autoFocus
                      />
                      <Input
                        placeholder="Price"
                        aria-label="New price"
                        value={inlineForm.price}
                        inputMode="decimal"
                        onChange={(e) => setInlineForm({ ...inlineForm, price: e.target.value, error: null })}
                        onKeyDown={(e) => { if (e.key === 'Enter') void handleInlineSubmit() }}
                        className="h-10 w-24 text-base"
                        maxLength={9}
                      />
                      <Input
                        type="number"
                        placeholder="Qty"
                        aria-label="Quantity"
                        value={inlineForm.qty}
                        inputMode="numeric"
                        min={1}
                        max={99}
                        onChange={(e) => setInlineForm({ ...inlineForm, qty: e.target.value, error: null })}
                        onKeyDown={(e) => { if (e.key === 'Enter') void handleInlineSubmit() }}
                        className="h-10 w-14 text-base text-center"
                      />
                      <button type="button" aria-label="Confirm edit" onClick={() => void handleInlineSubmit()} disabled={inlineSubmitting}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100">
                        <Check size={18} />
                      </button>
                      <button type="button" aria-label="Cancel edit" onClick={() => setInlineForm(null)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100">
                        <X size={18} />
                      </button>
                    </div>
                    {inlineForm.error && <p className="text-[13px] text-red-600">{inlineForm.error}</p>}
                  </div>
                </Card>
              ) : (
                <div className="flex items-stretch gap-2">
                  <div className="flex-1">
                    <ClaimableItemCard
                      item={item}
                      claimsForItem={claimsForItem}
                      myPersonId={selectedPersonId}
                      peopleById={peopleById}
                      onQtyChange={(newQty) => handleQtyChange(item.id, newQty)}
                      onShareChange={isSingleQty ? (joining) => handleShareChange(item.id, joining) : undefined}
                      errorMessage={itemErrors[item.id]}
                    />
                  </div>
                  <button
                    type="button"
                    aria-label={`Edit ${item.name}`}
                    onClick={() => setInlineForm({ kind: 'edit', itemId: item.id,
                      name: item.name, price: originalPrice, qty: String(item.quantity ?? 1),
                      originalName: item.name, originalPrice, originalQty: String(item.quantity ?? 1), error: null })}
                    className="flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-md border border-border text-zinc-500 hover:bg-zinc-100"
                    data-testid={`edit-pencil-${item.id}`}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${item.name}`}
                    onClick={() => void handleDeleteItem(item.id)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-md border border-border text-zinc-500 hover:bg-zinc-100"
                    data-testid={`delete-item-${item.id}`}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </li>
          )
        })}

        {/* Inline add form or dashed add button */}
        {inlineForm?.kind === 'add' ? (
          <li>
            <Card className="flex flex-row items-start gap-2 px-4 py-3">
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex gap-2">
                  <Input
                    placeholder="Item name"
                    aria-label="Item name"
                    value={inlineForm.name}
                    onChange={(e) => setInlineForm({ ...inlineForm, name: e.target.value, error: null })}
                    className="flex-1 h-10 text-base"
                    maxLength={100}
                    autoFocus
                  />
                  <Input
                    placeholder="Price"
                    value={inlineForm.price}
                    inputMode="decimal"
                    onChange={(e) => setInlineForm({ ...inlineForm, price: e.target.value, error: null })}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleInlineSubmit() }}
                    className="h-10 w-24 text-base"
                    maxLength={9}
                  />
                  <Input
                    type="number"
                    placeholder="Qty"
                    value={inlineForm.qty}
                    inputMode="numeric"
                    min={1}
                    max={99}
                    onChange={(e) => setInlineForm({ ...inlineForm, qty: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleInlineSubmit() }}
                    className="h-10 w-14 text-center text-base"
                    aria-label="Quantity"
                  />
                  <button type="button" aria-label="Confirm" onClick={() => void handleInlineSubmit()} disabled={inlineSubmitting}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100">
                    <Check size={18} />
                  </button>
                  <button type="button" aria-label="Cancel" onClick={() => setInlineForm(null)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100">
                    <X size={18} />
                  </button>
                </div>
                {inlineForm.error && (
                  <p className="text-[13px] text-red-600">{inlineForm.error}</p>
                )}
              </div>
            </Card>
          </li>
        ) : (
          <li>
            <button
              type="button"
              onClick={() => setInlineForm({ kind: 'add', name: '', price: '', qty: '1', error: null })}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border text-[14px] text-zinc-600 hover:bg-zinc-50"
              data-testid="add-item-button"
            >
              <Plus size={16} /> Add item
            </button>
          </li>
        )}
      </ul>

      {/* Fixed "I'm done" bar */}
      <div
        className="fixed bottom-0 left-0 right-0 border-t border-border bg-background px-6 py-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        {doneError && (
          <p className="mb-2 text-center text-sm text-red-600">{doneError}</p>
        )}
        <Button onClick={handleDone} className="h-12 w-full bg-amber-600 hover:bg-amber-700">
          I&rsquo;m done
        </Button>
      </div>

      {/* Change-identity modal (D-03/IDENT-03): dismissible when an identity already exists */}
      <IdentityModal
        open={identityModalOpen}
        allowClose={changingIdentity}
        session={session}
        onSelect={handleSelect}
        onAddPerson={handleAddPerson}
        onOpenChange={(open) => {
          setIdentityModalOpen(open)
          if (!open) setChangingIdentity(false)
        }}
      />

      {/* Unclaimed warning dialog (D-09/D-11/D-12): warn-but-allow done flow */}
      <Dialog open={showUnclaimedWarning} onOpenChange={setShowUnclaimedWarning}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-[20px] font-semibold leading-[1.2]">
              {unclaimedCount} {unclaimedCount === 1 ? 'item' : 'items'} still unclaimed
            </DialogTitle>
            <DialogDescription className="text-[16px] text-zinc-500">
              Totals will only reflect what&rsquo;s been claimed. Share the link so others can add their items.
            </DialogDescription>
          </DialogHeader>
          <button
            type="button"
            aria-label="Share bill link"
            onClick={() => void handleWarningShare()}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border text-[14px] text-zinc-700 hover:bg-zinc-50"
          >
            {warningLinkCopied ? <Check size={16} /> : <Share2 size={16} />}
            {warningLinkCopied ? 'Link copied!' : 'Share bill link'}
          </button>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              onClick={() => {
                setShowUnclaimedWarning(false)
                void submitDone()
              }}
              className="h-12 w-full bg-amber-600 hover:bg-amber-700"
            >
              Continue anyway
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowUnclaimedWarning(false)}
              className="h-12 w-full"
            >
              Go back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
