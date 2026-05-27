'use client'

import { useState, useMemo } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { AVATAR_COLORS } from '@/stores/useBillStore'
import { formatCents } from '@/lib/billMath'
import type {
  PublicSessionPayload,
  EditRequest,
  EditPayload,
  Dispute,
} from '@/lib/sessionSchema'
import type { ItemId, PersonId, Person } from '@/stores/useBillStore'

type TabId = 'edit_requests' | 'unclaimed' | 'disputes'

export interface HostPanelProps {
  session: PublicSessionPayload
  sessionId: string
  hostToken: string
  peopleById: Record<PersonId, Person>
  mutate: () => Promise<unknown>
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface UnclaimedItemRow {
  itemId: ItemId
  itemName: string
  totalQty: number
  claimedQty: number
  remaining: number
}

// Largest-remainder split of `remaining` units across `n` assignees: every assignee
// gets floor(remaining/n) and the first (remaining % n) assignees get +1.
// Source: same algorithm as lib/billMath.ts:computePersonTotals largest-remainder.
function splitProportional(remaining: number, n: number): number[] {
  if (n <= 0 || remaining <= 0) return []
  const base = Math.floor(remaining / n)
  const rem = remaining % n
  return Array.from({ length: n }, (_, idx) => base + (idx < rem ? 1 : 0))
}

export function HostPanel({
  session,
  sessionId,
  hostToken,
  peopleById,
  mutate,
  open,
  onOpenChange,
}: HostPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('edit_requests')
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)
  const [errorByActionId, setErrorByActionId] = useState<Record<string, string>>({})
  const [rejectConfirmId, setRejectConfirmId] = useState<string | null>(null)
  const [assignPickerForItem, setAssignPickerForItem] = useState<ItemId | null>(null)
  const [assignSelection, setAssignSelection] = useState<Record<PersonId, boolean>>({})
  const [reassignPickerForDispute, setReassignPickerForDispute] = useState<string | null>(null)
  const [reassignSelection, setReassignSelection] = useState<PersonId | null>(null)

  const pendingEditRequests = useMemo(
    () =>
      Object.entries(session.editRequests ?? {})
        .filter(([, r]) => r.status === 'pending')
        .sort(([, a], [, b]) => a.createdAt - b.createdAt),
    [session.editRequests]
  )

  const pendingDisputes = useMemo(
    () =>
      Object.entries(session.disputes ?? {})
        .filter(([, d]) => d.status === 'pending')
        .sort(([, a], [, b]) => a.createdAt - b.createdAt),
    [session.disputes]
  )

  const unclaimedRows = useMemo<UnclaimedItemRow[]>(() => {
    const rows: UnclaimedItemRow[] = []
    for (const item of session.items) {
      const claimsForItem = session.claims?.items?.[item.id] ?? {}
      const claimedQty = Object.values(claimsForItem).reduce(
        (sum, e) => sum + (e?.qty ?? 0),
        0
      )
      const totalQty = item.quantity ?? 1
      if (claimedQty < totalQty) {
        rows.push({
          itemId: item.id,
          itemName: item.name,
          totalQty,
          claimedQty,
          remaining: totalQty - claimedQty,
        })
      }
    }
    return rows
  }, [session.items, session.claims])

  // ---- Action handlers ----------------------------------------------------

  async function resolveEdit(requestId: string, decision: 'approved' | 'rejected') {
    setPendingActionId(requestId)
    setErrorByActionId((prev) => {
      const next = { ...prev }
      delete next[requestId]
      return next
    })
    try {
      const res = await fetch(`/api/session/${sessionId}/resolve-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, decision, hostToken }),
      })
      if (res.status === 409) {
        setErrorByActionId((prev) => ({ ...prev, [requestId]: 'Already resolved' }))
        await mutate()
        return
      }
      if (!res.ok) {
        setErrorByActionId((prev) => ({
          ...prev,
          [requestId]: "Couldn't save — tap to retry",
        }))
        return
      }
      await mutate()
    } catch {
      setErrorByActionId((prev) => ({
        ...prev,
        [requestId]: "Couldn't save — tap to retry",
      }))
    } finally {
      setPendingActionId(null)
      setRejectConfirmId(null)
    }
  }

  async function assignUnclaimed(itemId: ItemId, assignees: PersonId[]) {
    const row = unclaimedRows.find((r) => r.itemId === itemId)
    if (!row || assignees.length === 0) return
    const allocations = splitProportional(row.remaining, assignees.length)
    setPendingActionId(itemId)
    setErrorByActionId((prev) => {
      const next = { ...prev }
      delete next[itemId]
      return next
    })
    try {
      // Sequential to keep error attribution simple. D-05 only requires correct allocation,
      // not parallel writes. Lua eval makes each /claim atomic so the host's loop is safe
      // even if a guest claims the same item concurrently between iterations.
      for (let i = 0; i < assignees.length; i++) {
        const pid = assignees[i]
        const existingQty =
          session.claims?.items?.[itemId]?.[pid]?.qty ?? 0
        const newQty = existingQty + allocations[i]
        const res = await fetch(`/api/session/${sessionId}/claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personId: pid,
            action: 'qty',
            itemId,
            qty: newQty,
          }),
        })
        if (!res.ok) throw new Error(`assign failed: ${res.status}`)
      }
      await mutate()
      setAssignPickerForItem(null)
      setAssignSelection({})
    } catch {
      setErrorByActionId((prev) => ({
        ...prev,
        [itemId]: "Couldn't assign — tap to retry",
      }))
    } finally {
      setPendingActionId(null)
    }
  }

  async function resolveDispute(
    disputeId: string,
    decision: 'resolved' | 'rejected',
    reassignTo?: PersonId
  ) {
    setPendingActionId(disputeId)
    setErrorByActionId((prev) => {
      const next = { ...prev }
      delete next[disputeId]
      return next
    })
    try {
      const body: Record<string, unknown> = { disputeId, decision, hostToken }
      if (reassignTo) body.reassignTo = reassignTo
      const res = await fetch(`/api/session/${sessionId}/resolve-dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.status === 409) {
        setErrorByActionId((prev) => ({ ...prev, [disputeId]: 'Already resolved' }))
        await mutate()
        return
      }
      if (!res.ok) {
        setErrorByActionId((prev) => ({
          ...prev,
          [disputeId]: "Couldn't save — tap to retry",
        }))
        return
      }
      await mutate()
      setReassignPickerForDispute(null)
      setReassignSelection(null)
    } catch {
      setErrorByActionId((prev) => ({
        ...prev,
        [disputeId]: "Couldn't save — tap to retry",
      }))
    } finally {
      setPendingActionId(null)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        role="presentation"
        aria-hidden="true"
        onClick={() => onOpenChange(false)}
        className="fixed inset-0 z-40 bg-black/40"
      />
      {/* Sheet */}
      <div
        role="dialog"
        aria-label="Host controls"
        data-testid="host-panel"
        className="fixed bottom-0 left-0 right-0 z-50 mx-auto h-[70vh] max-w-[480px] overflow-hidden rounded-t-xl border-t border-border bg-background"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-[20px] font-semibold">Host controls</h2>
          <button
            type="button"
            aria-label="Close host panel"
            onClick={() => onOpenChange(false)}
            className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-zinc-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab strip */}
        <div role="tablist" aria-label="Host control sections" className="flex border-b border-border">
          {[
            { id: 'edit_requests' as const, label: 'Edit Requests', count: pendingEditRequests.length },
            { id: 'unclaimed' as const, label: 'Unclaimed', count: unclaimedRows.length },
            { id: 'disputes' as const, label: 'Disputes', count: pendingDisputes.length },
          ].map((tab) => {
            const selected = activeTab === tab.id
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={selected}
                aria-controls={`host-panel-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'flex h-12 flex-1 items-center justify-center gap-2 text-[14px]',
                  selected ? 'border-b-2 border-amber-600 font-semibold text-amber-600' : 'text-zinc-600',
                ].join(' ')}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[14px] text-white">
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Tab content — scrollable */}
        <div className="h-[calc(70vh-110px)] overflow-y-auto px-6 py-4">
          {activeTab === 'edit_requests' && (
            <div role="tabpanel" id="host-panel-tab-edit_requests" className="flex flex-col gap-2">
              {pendingEditRequests.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <h3 className="text-[16px] font-semibold">No edit requests</h3>
                  <p className="text-[14px] text-zinc-500">
                    Requests from participants will appear here.
                  </p>
                </div>
              ) : (
                pendingEditRequests.map(([requestId, req]) => (
                  <EditRequestRow
                    key={requestId}
                    requestId={requestId}
                    request={req}
                    personName={peopleById[req.personId]?.name ?? 'Someone'}
                    sessionItems={session.items}
                    error={errorByActionId[requestId]}
                    isPending={pendingActionId === requestId}
                    rejectConfirming={rejectConfirmId === requestId}
                    onApprove={() => resolveEdit(requestId, 'approved')}
                    onRejectFirstTap={() => setRejectConfirmId(requestId)}
                    onRejectConfirm={() => resolveEdit(requestId, 'rejected')}
                    onRejectCancel={() => setRejectConfirmId(null)}
                  />
                ))
              )}
            </div>
          )}

          {activeTab === 'unclaimed' && (
            <div role="tabpanel" id="host-panel-tab-unclaimed" className="flex flex-col gap-2">
              {unclaimedRows.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <h3 className="text-[16px] font-semibold">All items claimed</h3>
                  <p className="text-[14px] text-zinc-500">Every unit has been claimed.</p>
                </div>
              ) : (
                unclaimedRows.map((row) => (
                  <Card key={row.itemId} className="flex flex-col gap-2 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[16px] font-semibold">{row.itemName}</span>
                      <span className="text-[14px] text-zinc-500">
                        {row.remaining} of {row.totalQty} unclaimed
                      </span>
                    </div>
                    {assignPickerForItem === row.itemId ? (
                      <div className="flex flex-col gap-2" data-testid={`assign-picker-${row.itemId}`}>
                        {session.people.map((person) => (
                          <label
                            key={person.id}
                            className="flex h-11 items-center gap-3 rounded-md border border-border px-3"
                          >
                            <Checkbox
                              checked={!!assignSelection[person.id]}
                              onCheckedChange={(checked) =>
                                setAssignSelection((prev) => ({
                                  ...prev,
                                  [person.id]: checked === true,
                                }))
                              }
                              aria-label={`Assign to ${person.name}`}
                            />
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-full text-white font-semibold ${AVATAR_COLORS[person.colorIndex % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]}`}
                              aria-hidden="true"
                            >
                              {person.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-[16px]">{person.name}</span>
                          </label>
                        ))}
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-11 flex-1"
                            onClick={() => {
                              setAssignPickerForItem(null)
                              setAssignSelection({})
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            className="h-11 flex-1 bg-amber-600 hover:bg-amber-700"
                            disabled={
                              pendingActionId === row.itemId ||
                              !Object.values(assignSelection).some(Boolean)
                            }
                            onClick={() => {
                              const ids = Object.entries(assignSelection)
                                .filter(([, v]) => v)
                                .map(([id]) => id as PersonId)
                              assignUnclaimed(row.itemId, ids)
                            }}
                          >
                            {pendingActionId === row.itemId ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              'Assign'
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        className="h-11 w-full bg-amber-600 hover:bg-amber-700"
                        onClick={() => setAssignPickerForItem(row.itemId)}
                      >
                        Assign
                      </Button>
                    )}
                    {errorByActionId[row.itemId] && (
                      <span className="text-[14px] text-red-600">
                        {errorByActionId[row.itemId]}
                      </span>
                    )}
                  </Card>
                ))
              )}
            </div>
          )}

          {activeTab === 'disputes' && (
            <div role="tabpanel" id="host-panel-tab-disputes" className="flex flex-col gap-2">
              {pendingDisputes.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <h3 className="text-[16px] font-semibold">No disputes</h3>
                  <p className="text-[14px] text-zinc-500">
                    Disputes from participants will appear here.
                  </p>
                </div>
              ) : (
                pendingDisputes.map(([disputeId, d]) => (
                  <DisputeRow
                    key={disputeId}
                    disputeId={disputeId}
                    dispute={d}
                    sessionItems={session.items}
                    sessionPeople={session.people}
                    peopleById={peopleById}
                    error={errorByActionId[disputeId]}
                    isPending={pendingActionId === disputeId}
                    pickerOpen={reassignPickerForDispute === disputeId}
                    pickerSelection={reassignSelection}
                    onOpenPicker={() => {
                      setReassignPickerForDispute(disputeId)
                      setReassignSelection(null)
                    }}
                    onPickerSelect={(pid) => setReassignSelection(pid)}
                    onPickerCancel={() => {
                      setReassignPickerForDispute(null)
                      setReassignSelection(null)
                    }}
                    onPickerConfirm={() => {
                      if (reassignSelection) {
                        resolveDispute(disputeId, 'resolved', reassignSelection)
                      }
                    }}
                    onConfirmOriginal={() => resolveDispute(disputeId, 'rejected')}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ---- Sub-rows -----------------------------------------------------------

function describeEdit(req: EditRequest, sessionItems: PublicSessionPayload['items']): string {
  const p = req.payload as EditPayload
  if (req.type === 'add' && 'name' in p) {
    return `Add "${p.name}" — ${formatCents(p.priceCents)} × ${p.quantity}`
  }
  const itemId = 'itemId' in p ? p.itemId : ''
  const item = sessionItems.find((it) => it.id === itemId)
  const itemName = item?.name ?? '(unknown item)'
  if (req.type === 'remove') return `Remove "${itemName}"`
  if (req.type === 'edit_price' && 'newPriceCents' in p) {
    return `Reprice "${itemName}" → ${formatCents(p.newPriceCents)}`
  }
  if (req.type === 'edit_name' && 'newName' in p) {
    return `Rename "${itemName}" → "${p.newName}"`
  }
  return 'Unknown edit'
}

interface EditRequestRowProps {
  requestId: string
  request: EditRequest
  personName: string
  sessionItems: PublicSessionPayload['items']
  error?: string
  isPending: boolean
  rejectConfirming: boolean
  onApprove: () => void
  onRejectFirstTap: () => void
  onRejectConfirm: () => void
  onRejectCancel: () => void
}

function EditRequestRow({
  requestId,
  request,
  personName,
  sessionItems,
  error,
  isPending,
  rejectConfirming,
  onApprove,
  onRejectFirstTap,
  onRejectConfirm,
  onRejectCancel,
}: EditRequestRowProps) {
  return (
    <Card
      className="flex flex-col gap-2 px-4 py-3"
      data-testid={`edit-request-row-${requestId}`}
    >
      <div className="flex flex-col gap-1">
        <span className="text-[14px] text-zinc-500">{personName} requested:</span>
        <span className="text-[16px] font-semibold">
          {describeEdit(request, sessionItems)}
        </span>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          className="h-11 flex-1 bg-amber-600 hover:bg-amber-700"
          disabled={isPending}
          onClick={onApprove}
          aria-label={`Approve edit request ${requestId}`}
        >
          {isPending ? <Loader2 size={16} className="animate-spin" /> : 'Approve'}
        </Button>
        {rejectConfirming ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 border-red-600 text-red-600 hover:bg-red-50"
              disabled={isPending}
              onClick={onRejectConfirm}
              aria-label={`Confirm reject edit request ${requestId}`}
            >
              Confirm reject?
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11"
              onClick={onRejectCancel}
              aria-label="Cancel reject"
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1"
            disabled={isPending}
            onClick={onRejectFirstTap}
            aria-label={`Reject edit request ${requestId}`}
          >
            Reject
          </Button>
        )}
      </div>
      {error && <span className="text-[14px] text-red-600">{error}</span>}
    </Card>
  )
}

interface DisputeRowProps {
  disputeId: string
  dispute: Dispute
  sessionItems: PublicSessionPayload['items']
  sessionPeople: Person[]
  peopleById: Record<PersonId, Person>
  error?: string
  isPending: boolean
  pickerOpen: boolean
  pickerSelection: PersonId | null
  onOpenPicker: () => void
  onPickerSelect: (pid: PersonId) => void
  onPickerCancel: () => void
  onPickerConfirm: () => void
  onConfirmOriginal: () => void
}

function DisputeRow({
  disputeId,
  dispute,
  sessionItems,
  sessionPeople,
  peopleById,
  error,
  isPending,
  pickerOpen,
  pickerSelection,
  onOpenPicker,
  onPickerSelect,
  onPickerCancel,
  onPickerConfirm,
  onConfirmOriginal,
}: DisputeRowProps) {
  const item = sessionItems.find((it) => it.id === dispute.itemId)
  const disputerName = peopleById[dispute.personId]?.name ?? 'Someone'
  return (
    <Card
      className="flex flex-col gap-2 px-4 py-3"
      data-testid={`dispute-row-${disputeId}`}
    >
      <div className="flex flex-col gap-1">
        <span className="text-[14px] text-zinc-500">{disputerName} disputed:</span>
        <span className="text-[16px] font-semibold">{item?.name ?? '(unknown item)'}</span>
      </div>
      {pickerOpen ? (
        <div className="flex flex-col gap-2" data-testid={`reassign-picker-${disputeId}`}>
          {sessionPeople.map((person) => (
            <label
              key={person.id}
              className="flex h-11 items-center gap-3 rounded-md border border-border px-3"
            >
              <input
                type="radio"
                name={`reassign-${disputeId}`}
                checked={pickerSelection === person.id}
                onChange={() => onPickerSelect(person.id)}
                aria-label={`Reassign to ${person.name}`}
              />
              <span className="text-[16px]">{person.name}</span>
            </label>
          ))}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1"
              onClick={onPickerCancel}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-11 flex-1 bg-amber-600 hover:bg-amber-700"
              disabled={!pickerSelection || isPending}
              onClick={onPickerConfirm}
            >
              {isPending ? <Loader2 size={16} className="animate-spin" /> : 'Reassign'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1"
            disabled={isPending}
            onClick={onOpenPicker}
            aria-label={`Reassign dispute ${disputeId}`}
          >
            Reassign
          </Button>
          <Button
            type="button"
            className="h-11 flex-1 bg-amber-600 hover:bg-amber-700"
            disabled={isPending}
            onClick={onConfirmOriginal}
            aria-label={`Confirm original assignment for dispute ${disputeId}`}
          >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : 'Confirm assignment'}
          </Button>
        </div>
      )}
      {error && <span className="text-[14px] text-red-600">{error}</span>}
    </Card>
  )
}
