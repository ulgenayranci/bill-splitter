import { create } from 'zustand'

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
  priceCents: number
}

interface BillState {
  step: 1 | 2 | 3 | 4 | 5
  people: Person[]
  items: Item[]
  assignments: Record<ItemId, PersonId[]>
  tipPercent: number
  nextColorIndex: number
  setStep: (step: BillState['step']) => void
  addPerson: (name: string) => void
  removePerson: (id: PersonId) => void
  addItem: (name: string, priceCents: number) => void
  removeItem: (id: ItemId) => void
  updateItem: (id: ItemId, name: string, priceCents: number) => void
  setAssignment: (itemId: ItemId, personIds: PersonId[]) => void
  setTipPercent: (percent: number) => void
  reset: () => void
}

const INITIAL_STATE = {
  step: 1 as const,
  people: [],
  items: [],
  assignments: {},
  tipPercent: 18,
  nextColorIndex: 0,
}

export const useBillStore = create<BillState>()((set) => ({
  ...INITIAL_STATE,
  setStep: (step) => set({ step }),
  addPerson: (name) =>
    set((s) => ({
      people: [
        ...s.people,
        { id: crypto.randomUUID(), name, colorIndex: s.nextColorIndex % 6 },
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
  addItem: (name, priceCents) =>
    set((s) => ({
      items: [...s.items, { id: crypto.randomUUID(), name, priceCents }],
    })),
  removeItem: (id) =>
    set((s) => {
      const { [id]: _removed, ...rest } = s.assignments
      return { items: s.items.filter((i) => i.id !== id), assignments: rest }
    }),
  updateItem: (id, name, priceCents) =>
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, name, priceCents } : i)),
    })),
  setAssignment: (itemId, personIds) =>
    set((s) => ({
      assignments: { ...s.assignments, [itemId]: personIds },
    })),
  setTipPercent: (percent) => set({ tipPercent: percent }),
  reset: () => set({ ...INITIAL_STATE }),
}))
