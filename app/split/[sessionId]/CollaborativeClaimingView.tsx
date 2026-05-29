'use client'

import { useState, useMemo, useEffect } from 'react'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Check, X, Plus, ClipboardList, Clock, Pencil } from 'lucide-react'
import { AVATAR_COLORS } from '@/stores/useBillStore'
import { parseCents, formatCents } from '@/lib/billMath'
import type { PublicSessionPayload, SessionPayload } from '@/lib/sessionSchema'
import type { ItemId, PersonId, Person } from '@/stores/useBillStore'
import { PersonSlotPicker } from '@/components/split/PersonSlotPicker'
import { ClaimableItemCard } from '@/components/split/ClaimableItemCard'
import { SessionExpiredScreen } from '@/components/split/SessionExpiredScreen'
import { HostPanel } from '@/components/split/HostPanel'
import { ReviewHostAssignedScreen } from '@/components/split/ReviewHostAssignedScreen'
import { TipScreen } from '@/components/split/TipScreen'
import { PersonResultsScreen } from '@/components/split/PersonResultsScreen'
import { computePersonShareFromClaims } from '@/lib/billMath'

type InlineForm =
  | { kind: 'add'; name: string; price: string; qty: string; error: string | null }
  | { kind: 'edit'; itemId: ItemId; name: string; price: string; qty: string; originalName: string; originalPrice: string; originalQty: string; error: string | null }

const fetcher = (url: string): Promise<PublicSessionPayload> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('session_not_found')
    return r.json()
  })

interface CollaborativeClaimingViewProps {
  sessionId: string
}

type Phase = 'claiming' | 'review' | 'tip' | 'results'

export function CollaborativeClaimingView({
  sessionId,
}: CollaborativeClaimingViewProps) {
  // CR-05: hostToken is in the URL fragment (#hostToken=...) so it is never sent to
  // the server. Read it client-side from window.location.hash after mount.
  const [hostTokenParam, setHostTokenParam] = useState<string | null>(null)
  useEffect(() => {
    const hash = window.location.hash // e.g. "#hostToken=abc123"
    const match = hash.match(/[#&]hostToken=([^&]+)/)
    if (match) setHostTokenParam(match[1])
  }, [])
  const [selectedPersonId, setSelectedPersonId] = useState<PersonId | null>(null)
  const [itemErrors, setItemErrors] = useState<Record<ItemId, boolean>>({})
  const [doneError, setDoneError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('claiming')

  const swrKey = `/api/session/${sessionId}`
  const { data: session, error, mutate } = useSWR<PublicSessionPayload>(swrKey, fetcher, {
    refreshInterval: 3000,
    revalidateOnFocus: false,
  })

  // Auto-restore host slot on page re-open: when hostToken is in the URL and
  // the session already has hostPersonId set, skip the PersonSlotPicker entirely.
  // Must be after useSWR so `session` is in scope for the dependency array.
  useEffect(() => {
    if (hostTokenParam && session?.hostPersonId && selectedPersonId === null) {
      setSelectedPersonId(session.hostPersonId)
    }
  }, [hostTokenParam, session?.hostPersonId, selectedPersonId])

  // CR-01: hostToken is no longer returned by the GET endpoint (stripped server-side).
  // Derive isHost from hostPersonId (set by the server when the host claims their slot).
  // hostTokenParam is still used when claiming the slot so the server can set hostPersonId.
  const isHost = useMemo(
    () => hostTokenParam !== null && selectedPersonId !== null && session?.hostPersonId === selectedPersonId,
    [hostTokenParam, selectedPersonId, session?.hostPersonId]
  )

  const peopleById = useMemo<Record<PersonId, Person>>(() => {
    if (!session) return {}
    return Object.fromEntries(session.people.map((p) => [p.id, p]))
  }, [session])

  const pendingCount = useMemo(() => {
    if (!session) return 0
    const editCount = Object.values(session.editRequests ?? {}).filter(
      (r) => r.status === 'pending'
    ).length
    const disputeCount = Object.values(session.disputes ?? {}).filter(
      (d) => d.status === 'pending'
    ).length
    const unclaimedCount = session.items.filter((item) => {
      const claimsForItem = session.claims?.items?.[item.id] ?? {}
      const claimed = Object.values(claimsForItem).reduce(
        (sum, e) => sum + (e?.qty ?? 0),
        0
      )
      return claimed < (item.quantity ?? 1)
    }).length
    return editCount + disputeCount + unclaimedCount
  }, [session])

  const [hostPanelOpen, setHostPanelOpen] = useState(false)
  const [inlineForm, setInlineForm] = useState<InlineForm | null>(null)
  const [inlineSubmitting, setInlineSubmitting] = useState(false)

  if (error) return <SessionExpiredScreen />
  if (!session) return <div role="status" className="p-6">Loading…</div>

  // Helper: check if this person has any host-assigned items not yet accepted
  function hasHostAssignedItems(): boolean {
    if (!session || !selectedPersonId) return false
    return session.items.some((item) => {
      const claim = session.claims?.items?.[item.id]?.[selectedPersonId]
      return claim?.assignedBy === 'host' && claim.qty > 0 && !claim.accepted
    })
  }

  async function handleSelect(personId: PersonId) {
    try {
      const body: Record<string, unknown> = { personId, action: 'slot' }
      if (hostTokenParam) body.hostToken = hostTokenParam
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
        const hasPreAssigned = session?.items.some((item) => {
          const claim = session.claims?.items?.[item.id]?.[personId]
          return claim?.assignedBy === 'host' && claim.qty > 0 && !claim.accepted
        }) ?? false
        if (hasPreAssigned) setPhase('review')
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
      claimsForItem[personId] = { qty: newQty, assignedBy: 'self' as const }
    }
    const nextItems: PublicSessionPayload['claims']['items'] = { ...session.claims?.items }
    if (Object.keys(claimsForItem).length === 0) {
      delete nextItems[itemId]
    } else {
      nextItems[itemId] = claimsForItem
    }
    const optimistic: PublicSessionPayload = {
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
    } catch {
      setItemErrors((prev) => ({ ...prev, [itemId]: true }))
    }
  }

  async function handleDone() {
    if (!selectedPersonId || !session) return
    setDoneError(null)
    try {
      const res = await fetch(`/api/session/${sessionId}/done`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId: selectedPersonId, done: true }),
      })
      if (!res.ok) throw new Error(`done route returned ${res.status}`)
      // WR-07: pass fetcher as the mutation function so SWR calls it and returns
      // fresh data reliably. mutate() with no args can return undefined in production
      // (deduped revalidation), causing hasHostAssigned to always be false and
      // skipping ReviewHostAssignedScreen.
      const updated = await mutate(() => fetcher(swrKey))
      const hasHostAssigned = updated?.items.some((item) => {
        const claim = updated.claims?.items?.[item.id]?.[selectedPersonId]
        return claim?.assignedBy === 'host' && claim.qty > 0 && !claim.accepted
      }) ?? false
      setPhase(hasHostAssigned ? 'review' : 'tip')
    } catch (err) {
      console.error('Done submission failed:', err)
      setDoneError("Couldn't submit — tap to retry")
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

  function handleBackFromTip() {
    if (hasHostAssignedItems()) {
      setPhase('review')
    } else {
      // No host-assigned items — Back from Tip returns all the way to claiming.
      void handleBackToClaiming()
    }
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
        const res = await fetch(`/api/session/${sessionId}/edit-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personId: selectedPersonId, type: 'add',
            payload: { name: trimmed, priceCents, quantity: Math.max(1, parseInt(inlineForm.qty, 10) || 1) } }),
        })
        if (!res.ok) { setInlineForm({ ...inlineForm, error: "Couldn't send — try again" }); return }
      } else {
        // Send edit_name and/or edit_price requests for whatever changed
        const trimmedName = inlineForm.name.trim()
        if (!trimmedName) { setInlineForm({ ...inlineForm, error: 'Enter a name' }); return }
        const newPriceCents = parseCents(inlineForm.price)
        if (!newPriceCents || newPriceCents <= 0) { setInlineForm({ ...inlineForm, error: 'Enter a valid price' }); return }
        const nameChanged = trimmedName !== inlineForm.originalName
        const priceChanged = inlineForm.price.trim() !== inlineForm.originalPrice
        const newQty = Math.max(1, Math.min(99, parseInt(inlineForm.qty, 10) || 1))
        const qtyChanged = String(newQty) !== inlineForm.originalQty
        if (!nameChanged && !priceChanged && !qtyChanged) { setInlineForm(null); return }
        if (nameChanged) {
          const r = await fetch(`/api/session/${sessionId}/edit-request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ personId: selectedPersonId, type: 'edit_name',
              payload: { itemId: inlineForm.itemId, newName: trimmedName } }),
          })
          if (!r.ok) { setInlineForm({ ...inlineForm, error: "Couldn't send — try again" }); return }
        }
        if (priceChanged) {
          const r = await fetch(`/api/session/${sessionId}/edit-request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ personId: selectedPersonId, type: 'edit_price',
              payload: { itemId: inlineForm.itemId, newPriceCents } }),
          })
          if (!r.ok) { setInlineForm({ ...inlineForm, error: "Couldn't send — try again" }); return }
        }
        if (qtyChanged) {
          const r = await fetch(`/api/session/${sessionId}/edit-request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ personId: selectedPersonId, type: 'edit_quantity',
              payload: { itemId: inlineForm.itemId, newQuantity: newQty } }),
          })
          if (!r.ok) { setInlineForm({ ...inlineForm, error: "Couldn't send — try again" }); return }
        }
      }
      await mutate()
      setInlineForm(null)
    } catch {
      setInlineForm((f) => f ? { ...f, error: "Couldn't send — try again" } : f)
    } finally {
      setInlineSubmitting(false)
    }
  }

  // No slot yet — show picker
  if (selectedPersonId === null) {
    return (
      <main className="mx-auto min-h-screen max-w-[480px] bg-background">
        <PersonSlotPicker session={session} onSelect={handleSelect} />
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

  if (phase === 'review') {
    return (
      <ReviewHostAssignedScreen
        session={session}
        sessionId={sessionId}
        personId={selectedPersonId}
        onAcceptAll={() => setPhase('tip')}
        onBack={() => void handleBackToClaiming()}
        mutate={mutate}
      />
    )
  }

  if (phase === 'tip') {
    return (
      <TipScreen
        sessionId={sessionId}
        personId={selectedPersonId}
        itemSubtotalCents={personalShare.itemSubtotal}
        onTipConfirmed={() => setPhase('results')}
        onBack={handleBackFromTip}
        mutate={mutate}
      />
    )
  }

  if (phase === 'results') {
    return <PersonResultsScreen session={session} personId={selectedPersonId} onBack={() => setPhase('tip')} />
  }

  return (
    <main className="mx-auto min-h-screen max-w-[480px] bg-background">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background px-6">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-white font-semibold ${AVATAR_COLORS[me.colorIndex % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]}`}
          aria-hidden="true"
        >
          {me.name.charAt(0).toUpperCase()}
        </div>
        <h1 className="text-[20px] font-semibold">Hi, {me.name}!</h1>
        {isHost && (
          <span className="ml-auto rounded-full bg-amber-100 px-2 py-1 text-[14px] text-amber-700" data-testid="host-badge">
            Host
          </span>
        )}
      </header>

      {/* Item list */}
      <ul className="flex flex-col gap-2 px-6 py-4 pb-[160px]">
        {session.items.map((item) => {
          const claimsForItem = session.claims?.items?.[item.id] ?? {}
          const isEditing = inlineForm?.kind === 'edit' && inlineForm.itemId === item.id
          const pendingEdit = Object.values(session.editRequests ?? {}).find(
            (r) => r.personId === selectedPersonId && r.status === 'pending' &&
              (r.type === 'edit_price' || r.type === 'edit_name' || r.type === 'edit_quantity') &&
              (r.payload as Record<string, unknown>).itemId === item.id
          )
          const originalPrice = (item.priceCents / 100).toFixed(2)
          return (
            <li key={item.id} className="flex flex-col gap-1">
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
                      hasError={!!itemErrors[item.id]}
                    />
                  </div>
                  {!pendingEdit && (
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
                  )}
                </div>
              )}
              {pendingEdit && (
                <div className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-[13px] text-amber-700">
                  <Clock size={13} />
                  Edit pending host approval
                </div>
              )}
            </li>
          )
        })}

        {/* Pending add requests */}
        {Object.values(session.editRequests ?? {})
          .filter((r) => r.personId === selectedPersonId && r.type === 'add' && r.status === 'pending')
          .map((r, i) => {
            const p = r.payload as { name: string; priceCents: number }
            return (
              <li key={`pending-add-${i}`}>
                <Card className="flex items-center justify-between gap-3 border-amber-200 bg-amber-50 px-4 py-3 opacity-80">
                  <span className="flex-1 text-[16px] text-zinc-600">{p.name}</span>
                  <span className="text-[14px] text-zinc-500">{formatCents(p.priceCents)}</span>
                  <div className="flex items-center gap-1 text-[13px] text-amber-700">
                    <Clock size={13} />
                    Pending approval
                  </div>
                </Card>
              </li>
            )
          })
        }

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

      {/* Host FAB */}
      {isHost && (
        <button
          type="button"
          onClick={() => setHostPanelOpen(true)}
          aria-label="Open host controls"
          data-testid="host-panel-fab"
          className="fixed bottom-24 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-amber-600 text-white shadow-lg hover:bg-amber-700"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 88px)' }}
        >
          <ClipboardList size={24} />
          {pendingCount > 0 && (
            <span
              className="absolute -top-1 -right-1 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-amber-700 px-1 text-[14px] font-semibold text-white"
              data-testid="host-panel-fab-badge"
            >
              {pendingCount}
            </span>
          )}
        </button>
      )}

      {/* HostPanel and EditRequestForm */}
      {isHost && (
        <HostPanel
          session={session}
          sessionId={sessionId}
          hostToken={hostTokenParam ?? ''}
          peopleById={peopleById}
          mutate={mutate}
          open={hostPanelOpen}
          onOpenChange={setHostPanelOpen}
        />
      )}
    </main>
  )
}
