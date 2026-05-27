import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useBillStore } from '@/stores/useBillStore'

describe('useBillStore', () => {
  beforeEach(() => {
    useBillStore.getState().reset()
  })

  it('addPerson appends a person with correct name, colorIndex 0, and non-empty id', () => {
    useBillStore.getState().addPerson('Alice')
    const people = useBillStore.getState().people
    expect(people).toHaveLength(1)
    expect(people[0].name).toBe('Alice')
    expect(people[0].colorIndex).toBe(0)
    expect(people[0].id).toBeTruthy()
  })

  it('two consecutive addPerson calls produce colorIndex 0, 1 in order', () => {
    useBillStore.getState().addPerson('Alice')
    useBillStore.getState().addPerson('Bob')
    const people = useBillStore.getState().people
    expect(people[0].colorIndex).toBe(0)
    expect(people[1].colorIndex).toBe(1)
  })

  it('after 6 people, 7th gets colorIndex 0 (cycles via % 6)', () => {
    for (let i = 0; i < 7; i++) {
      useBillStore.getState().addPerson(`Person${i}`)
    }
    const people = useBillStore.getState().people
    expect(people[6].colorIndex).toBe(0)
  })

  it('removePerson removes from people[] AND removes id from every assignments[] array', () => {
    useBillStore.getState().addPerson('Alice')
    const alice = useBillStore.getState().people[0]
    useBillStore.getState().addItem('Salad', 1200)
    const item = useBillStore.getState().items[0]
    useBillStore.getState().setAssignment(item.id, [alice.id])
    expect(useBillStore.getState().assignments[item.id]).toContain(alice.id)
    useBillStore.getState().removePerson(alice.id)
    expect(useBillStore.getState().people).toHaveLength(0)
    expect(useBillStore.getState().assignments[item.id]).not.toContain(alice.id)
  })

  it('addItem appends an item; assignments for that itemId is undefined or empty', () => {
    useBillStore.getState().addItem('Coke', 250)
    const items = useBillStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].name).toBe('Coke')
    expect(items[0].priceCents).toBe(250)
    const assignments = useBillStore.getState().assignments
    const assignment = assignments[items[0].id]
    expect(assignment === undefined || assignment.length === 0).toBe(true)
  })

  it('removeItem removes from items[] AND deletes the entry from assignments', () => {
    useBillStore.getState().addItem('Pizza', 1500)
    const item = useBillStore.getState().items[0]
    useBillStore.getState().setAssignment(item.id, ['some-person'])
    expect(useBillStore.getState().assignments[item.id]).toBeDefined()
    useBillStore.getState().removeItem(item.id)
    expect(useBillStore.getState().items).toHaveLength(0)
    expect(useBillStore.getState().assignments[item.id]).toBeUndefined()
  })

  it('updateItem updates name and priceCents in place; assignments preserved', () => {
    useBillStore.getState().addItem('OldName', 100)
    const item = useBillStore.getState().items[0]
    useBillStore.getState().setAssignment(item.id, ['p1'])
    useBillStore.getState().updateItem(item.id, 'NewName', 999)
    const updated = useBillStore.getState().items[0]
    expect(updated.name).toBe('NewName')
    expect(updated.priceCents).toBe(999)
    expect(updated.id).toBe(item.id)
    expect(useBillStore.getState().assignments[item.id]).toEqual(['p1'])
  })

  it('setAssignment overwrites prior assignment (does not append)', () => {
    useBillStore.getState().addItem('Burger', 1000)
    const item = useBillStore.getState().items[0]
    useBillStore.getState().setAssignment(item.id, ['p1', 'p2'])
    useBillStore.getState().setAssignment(item.id, ['p3'])
    expect(useBillStore.getState().assignments[item.id]).toEqual(['p3'])
  })

  it('setStep updates step to 3; default initial value is 1', () => {
    expect(useBillStore.getState().step).toBe(1)
    useBillStore.getState().setStep(3)
    expect(useBillStore.getState().step).toBe(3)
  })

  it('reset returns store to initial state', () => {
    useBillStore.getState().addPerson('Alice')
    useBillStore.getState().addItem('Pizza', 1000)
    useBillStore.getState().setStep(3)
    useBillStore.getState().reset()
    const state = useBillStore.getState()
    expect(state.step).toBe(1)
    expect(state.people).toEqual([])
    expect(state.items).toEqual([])
    expect(state.assignments).toEqual({})
  })

  // ----- Phase 2 additions -----

  it('billImageUrl initial value is null', () => {
    expect(useBillStore.getState().billImageUrl).toBeNull()
  })

  it('ocrStatus initial value is "idle"', () => {
    expect(useBillStore.getState().ocrStatus).toBe('idle')
  })

  it('setBillImage("blob:abc") sets billImageUrl to "blob:abc"', () => {
    useBillStore.getState().setBillImage('blob:abc')
    expect(useBillStore.getState().billImageUrl).toBe('blob:abc')
  })

  it('setBillImage(null) clears billImageUrl to null', () => {
    useBillStore.getState().setBillImage('blob:abc')
    useBillStore.getState().setBillImage(null)
    expect(useBillStore.getState().billImageUrl).toBeNull()
  })

  it('setOcrStatus transitions through idle -> loading -> done', () => {
    useBillStore.getState().setOcrStatus('loading')
    expect(useBillStore.getState().ocrStatus).toBe('loading')
    useBillStore.getState().setOcrStatus('done')
    expect(useBillStore.getState().ocrStatus).toBe('done')
  })

  it('setOcrStatus("error") sets ocrStatus to "error"', () => {
    useBillStore.getState().setOcrStatus('error')
    expect(useBillStore.getState().ocrStatus).toBe('error')
  })

  it('reset revokes the existing blob URL exactly once when billImageUrl is set', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')
    revokeSpy.mockClear()
    useBillStore.getState().setBillImage('blob:will-be-revoked')
    useBillStore.getState().reset()
    expect(revokeSpy).toHaveBeenCalledTimes(1)
    expect(revokeSpy).toHaveBeenCalledWith('blob:will-be-revoked')
    expect(useBillStore.getState().billImageUrl).toBeNull()
    expect(useBillStore.getState().ocrStatus).toBe('idle')
    revokeSpy.mockRestore()
  })

  it('reset does NOT call revokeObjectURL when billImageUrl is null', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')
    revokeSpy.mockClear()
    useBillStore.getState().reset()
    expect(revokeSpy).not.toHaveBeenCalled()
    revokeSpy.mockRestore()
  })
})

describe('Phase 3 store extensions', () => {
  beforeEach(() => {
    useBillStore.getState().reset()
  })

  it('addItem produces an Item with confidence and rawName both undefined', () => {
    useBillStore.getState().addItem('Coke', 250)
    const item = useBillStore.getState().items[0]
    expect(item.confidence).toBeUndefined()
    expect(item.rawName).toBeUndefined()
  })

  it('setItems replaces state.items with the supplied array exactly', () => {
    const newItems = [{ id: 'i1', name: 'Burger', priceCents: 1299, rawName: 'CK', confidence: 'low' as const }]
    useBillStore.getState().setItems(newItems)
    const items = useBillStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe('i1')
    expect(items[0].name).toBe('Burger')
    expect(items[0].priceCents).toBe(1299)
    expect(items[0].rawName).toBe('CK')
    expect(items[0].confidence).toBe('low')
  })

  it('updateItem sets confidence to "high" (clears Review badge)', () => {
    useBillStore.getState().setItems([{ id: 'i1', name: 'Burger', priceCents: 1299, confidence: 'low' }])
    useBillStore.getState().updateItem('i1', 'Burger', 1299)
    expect(useBillStore.getState().items[0].confidence).toBe('high')
  })

  it('setExpandStatus("loading") updates expandStatus to "loading"; initial value is "idle"', () => {
    expect(useBillStore.getState().expandStatus).toBe('idle')
    useBillStore.getState().setExpandStatus('loading')
    expect(useBillStore.getState().expandStatus).toBe('loading')
  })

  it('reset() returns expandStatus to "idle"', () => {
    useBillStore.getState().setBillImage('blob:abc')
    useBillStore.getState().setExpandStatus('loading')
    useBillStore.getState().reset()
    expect(useBillStore.getState().expandStatus).toBe('idle')
  })
})

describe('syncStatus + sessionId (Phase 4)', () => {
  beforeEach(() => {
    useBillStore.getState().reset()
  })

  it('initial syncStatus is "idle" and sessionId is null', () => {
    expect(useBillStore.getState().syncStatus).toBe('idle')
    expect(useBillStore.getState().sessionId).toBeNull()
  })

  it('setSyncStatus("results") updates syncStatus to "results"', () => {
    useBillStore.getState().setSyncStatus('results')
    expect(useBillStore.getState().syncStatus).toBe('results')
  })

  it('setSessionId("abc123") updates sessionId to "abc123"', () => {
    useBillStore.getState().setSessionId('abc123')
    expect(useBillStore.getState().sessionId).toBe('abc123')
  })

  it('setSessionId(null) clears sessionId', () => {
    useBillStore.getState().setSessionId('abc123')
    useBillStore.getState().setSessionId(null)
    expect(useBillStore.getState().sessionId).toBeNull()
  })

  it('after setSyncStatus("results") + setSessionId("abc"), reset() returns both to idle/null', () => {
    useBillStore.getState().setSyncStatus('results')
    useBillStore.getState().setSessionId('abc')
    useBillStore.getState().reset()
    expect(useBillStore.getState().syncStatus).toBe('idle')
    expect(useBillStore.getState().sessionId).toBeNull()
  })
})
