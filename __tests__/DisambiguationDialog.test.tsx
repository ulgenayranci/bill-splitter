import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { useState } from 'react'
import { DisambiguationDialog } from '@/components/wizard/DisambiguationDialog'
import type { Item } from '@/stores/useBillStore'

function lowItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'i1',
    name: 'Chicken Sandwich',
    priceCents: 1299,
    rawName: 'CHKN SAND',
    confidence: 'low',
    ...overrides,
  }
}

function Harness({ initialItem, onSave }: { initialItem: Item | null; onSave: (id: string, name: string) => void }) {
  const [item, setItem] = useState<Item | null>(initialItem)
  const [open, setOpen] = useState(item !== null)
  ;(window as unknown as Record<string, unknown>).__setHarnessItem = (next: Item | null) => {
    setItem(next)
    setOpen(next !== null)
  }
  return (
    <DisambiguationDialog
      item={item}
      open={open}
      onOpenChange={setOpen}
      onSave={onSave}
    />
  )
}

describe('DisambiguationDialog', () => {
  afterEach(() => { cleanup() })

  it('renders nothing when open is false', () => {
    render(
      <DisambiguationDialog item={lowItem()} open={false} onOpenChange={() => {}} onSave={() => {}} />,
    )
    expect(screen.queryByText("What's this item?")).toBeNull()
  })

  it('renders nothing when item is null', () => {
    render(
      <DisambiguationDialog item={null} open={true} onOpenChange={() => {}} onSave={() => {}} />,
    )
    expect(screen.queryByText("What's this item?")).toBeNull()
  })

  it('shows DialogTitle "What\'s this item?" when open with an item', () => {
    render(<Harness initialItem={lowItem()} onSave={() => {}} />)
    expect(screen.getByText("What's this item?")).toBeDefined()
  })

  it('shows the item name in the description', () => {
    render(<Harness initialItem={lowItem({ name: 'Chicken Sandwich (Large)' })} onSave={() => {}} />)
    expect(screen.getByText('Chicken Sandwich (Large)')).toBeDefined()
  })

  it('choices state shows both "Type name" and "Take menu photo" buttons', () => {
    render(<Harness initialItem={lowItem()} onSave={() => {}} />)
    expect(screen.getByRole('button', { name: /type name/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /take menu photo/i })).toBeDefined()
  })

  it('tapping "Type name" reveals an Input pre-filled with item.name', () => {
    render(<Harness initialItem={lowItem({ name: 'Chicken Sandwich' })} onSave={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /type name/i }))
    const input = screen.getByDisplayValue('Chicken Sandwich')
    expect(input).toBeDefined()
  })

  it('tapping "Save name" with edited text invokes onSave and closes', () => {
    const onSave = vi.fn()
    render(<Harness initialItem={lowItem({ name: 'Chicken Sandwich' })} onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: /type name/i }))
    const input = screen.getByDisplayValue('Chicken Sandwich')
    fireEvent.change(input, { target: { value: 'Chicken Sandwich (Large)' } })
    fireEvent.click(screen.getByRole('button', { name: /save name/i }))
    expect(onSave).toHaveBeenCalledWith('i1', 'Chicken Sandwich (Large)')
    expect(screen.queryByText("What's this item?")).toBeNull()
  })

  it('tapping "← Back" in editing state returns to choices state', () => {
    render(<Harness initialItem={lowItem()} onSave={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /type name/i }))
    // Now in editing state
    expect(screen.getByDisplayValue('Chicken Sandwich')).toBeDefined()
    fireEvent.click(screen.getByText(/← Back/))
    // Back in choices state
    expect(screen.getByRole('button', { name: /type name/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /take menu photo/i })).toBeDefined()
  })

  it('item identity change via prop resets to choices state', () => {
    render(
      <Harness initialItem={lowItem({ id: 'i1', name: 'Burger' })} onSave={() => {}} />,
    )
    // Move to editing state
    fireEvent.click(screen.getByRole('button', { name: /type name/i }))
    expect(screen.getByDisplayValue('Burger')).toBeDefined()
    // Swap item via the harness window helper (wrapped in act for React state update)
    const swap = (window as unknown as Record<string, unknown>).__setHarnessItem as (next: Item | null) => void
    act(() => { swap(lowItem({ id: 'i2', name: 'Fries' })) })
    // After identity change, dialog re-opens in choices state with new name in description
    expect(screen.getByText('Fries')).toBeDefined()
    expect(screen.getByRole('button', { name: /type name/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /take menu photo/i })).toBeDefined()
  })
})
