import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// randomId() requires a secure context (HTTPS/localhost).
// Plain-HTTP LAN dev (e.g. http://192.168.x.x) exposes an undefined API.
export const randomId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

export type PersonId = string
export type ItemId = string

export const AVATAR_COLORS = [
  'bg-amber-400',
  'bg-sky-400',
  'bg-emerald-400',
  'bg-violet-400',
  'bg-rose-400',
  'bg-orange-400',
] as const

export interface Person {
  id: PersonId
  name: string
  colorIndex: number
}

export interface Item {
  id: ItemId
  name: string
  /**
   * Canonical LINE TOTAL in integer cents (price for ALL units of this line).
   * All billMath consumes this directly; never per-unit. For a 2-qty line at
   * 450 each, priceCents is 900.
   */
  priceCents: number
  quantity: number
  /**
   * Per-single-unit price in integer cents (= round(priceCents / quantity)).
   * Optional for backward-compat: older persisted sessions predate this field
   * and remain valid; display code derives a unit price when it is absent.
   */
  unitPriceCents?: number
  rawName?: string
  confidence?: 'high' | 'low' | 'ambiguous'
}

/**
 * Derive the per-unit price (integer cents) from a canonical LINE TOTAL and
 * quantity. Integer-cents only — Math.round keeps the result an integer with no
 * float leaking into stored state. Quantity is coerced to a positive integer.
 */
export const deriveUnitPriceCents = (priceCents: number, quantity: number): number => {
  const qty = Number.isInteger(quantity) && quantity > 0 ? quantity : 1
  return Math.round(priceCents / qty)
}

// App-default currency used until OCR detects one (CURR-01 / D-02).
export const DEFAULT_CURRENCY_CODE = 'USD'

interface BillState {
  step: 1 | 2 | 3 | 4
  people: Person[]
  items: Item[]
  assignments: Record<ItemId, PersonId[]>
  nextColorIndex: number
  billImageUrl: string | null
  // ISO 4217 code detected from the receipt (CURR-01). Detection + store only this
  // phase; threading through formatCents/displays is Phase 10 (CURR-02/03, D-02).
  currencyCode: string
  ocrStatus: 'idle' | 'loading' | 'done' | 'error'
  expandStatus: 'idle' | 'loading' | 'done' | 'error'
  syncStatus: 'idle' | 'results'
  sessionId: string | null
  setBillImage: (url: string | null) => void
  setCurrencyCode: (code: string) => void
  setOcrStatus: (status: 'idle' | 'loading' | 'done' | 'error') => void
  setExpandStatus: (status: 'idle' | 'loading' | 'done' | 'error') => void
  setSyncStatus: (status: 'idle' | 'results') => void
  setSessionId: (id: string | null) => void
  setItems: (items: Item[]) => void
  setStep: (step: BillState['step']) => void
  // Persistence hydration guard — false until localStorage rehydrates (see persist config).
  _hasHydrated: boolean
  setHasHydrated: (v: boolean) => void
  addPerson: (name: string) => void
  removePerson: (id: PersonId) => void
  addItem: (name: string, priceCents: number, quantity?: number) => void
  removeItem: (id: ItemId) => void
  updateItem: (id: ItemId, name: string, priceCents: number, quantity?: number) => void
  setAssignment: (itemId: ItemId, personIds: PersonId[]) => void
  reset: () => void
}

const INITIAL_STATE = {
  step: 1 as const,
  people: [],
  items: [],
  assignments: {},
  nextColorIndex: 0,
  billImageUrl: null,
  currencyCode: DEFAULT_CURRENCY_CODE,
  ocrStatus: 'idle' as const,
  expandStatus: 'idle' as const,
  syncStatus: 'idle' as const,
  sessionId: null,
}

export const useBillStore = create<BillState>()(
  persist(
    (set) => ({
  ...INITIAL_STATE,
  _hasHydrated: false,
  setHasHydrated: (v) => set({ _hasHydrated: v }),
  setStep: (step) => set({ step }),
  addPerson: (name) =>
    set((s) => ({
      people: [
        ...s.people,
        { id: randomId(), name, colorIndex: s.nextColorIndex % 6 },
      ],
      nextColorIndex: s.nextColorIndex + 1,
    })),
  removePerson: (id) =>
    set((s) => ({
      people: s.people.filter((p) => p.id !== id),
      assignments: Object.fromEntries(
        Object.entries(s.assignments).map(([k, v]) => [
          k,
          v.filter((pid) => pid !== id),
        ])
      ),
    })),
  addItem: (name, priceCents, quantity = 1) =>
    set((s) => ({
      // priceCents is the canonical LINE TOTAL; derive + store the per-unit price.
      items: [
        ...s.items,
        {
          id: randomId(),
          name,
          priceCents,
          quantity,
          unitPriceCents: deriveUnitPriceCents(priceCents, quantity),
        },
      ],
    })),
  removeItem: (id) =>
    set((s) => {
      const { [id]: _removed, ...rest } = s.assignments
      return { items: s.items.filter((i) => i.id !== id), assignments: rest }
    }),
  setItems: (items) => set({ items }),
  updateItem: (id, name, priceCents, quantity) =>
    set((s) => ({
      items: s.items.map((i) => {
        if (i.id !== id) return i
        // priceCents arg is the LINE TOTAL; recompute the per-unit price from the
        // (possibly updated) quantity so unitPriceCents stays consistent.
        const nextQty = quantity ?? i.quantity
        return {
          ...i,
          name,
          priceCents,
          quantity: nextQty,
          unitPriceCents: deriveUnitPriceCents(priceCents, nextQty),
          confidence: 'high' as const,
        }
      }),
    })),
  setAssignment: (itemId, personIds) =>
    set((s) => ({
      assignments: { ...s.assignments, [itemId]: personIds },
    })),
  setBillImage: (url) => set({ billImageUrl: url }),
  setCurrencyCode: (code) => set({ currencyCode: code }),
  setOcrStatus: (status) => set({ ocrStatus: status }),
  setExpandStatus: (status) => set({ expandStatus: status }),
  setSyncStatus: (status) => set({ syncStatus: status }),
  setSessionId: (id) => set({ sessionId: id }),
  reset: () =>
    set((s) => {
      if (s.billImageUrl?.startsWith('blob:')) URL.revokeObjectURL(s.billImageUrl)
      return { ...INITIAL_STATE }
    }),
    }),
    {
      name: 'easy-billsy-bill',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Avoid SSR hydration mismatch: server + first client paint use INITIAL_STATE,
      // then we rehydrate from localStorage after mount (see app/page.tsx).
      skipHydration: true,
      // Persist the working bill session. billImageUrl is persisted as a base64
      // data-URL (set after compression in SetupStep) so the photo survives reload
      // and the "View bill" button works on later screens. Excluded:
      // - ocrStatus/expandStatus: transient request states (must restart at 'idle')
      // - the hydration guard + action fns
      partialize: (s) => ({
        step: s.step,
        people: s.people,
        items: s.items,
        assignments: s.assignments,
        nextColorIndex: s.nextColorIndex,
        billImageUrl: s.billImageUrl,
        currencyCode: s.currencyCode,
        syncStatus: s.syncStatus,
        sessionId: s.sessionId,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)
