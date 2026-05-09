import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SetTipStep } from '@/components/wizard/SetTipStep'
import { useBillStore } from '@/stores/useBillStore'

describe('SetTipStep', () => {
  beforeEach(() => {
    useBillStore.getState().reset()
    useBillStore.getState().addPerson('Alice')
    useBillStore.getState().addItem('Pizza', 1000) // $10.00
  })

  afterEach(() => {
    cleanup()
  })

  it('Test 1: renders 4 buttons with text "15%", "18%", "20%", "Custom"', () => {
    render(<SetTipStep />)
    expect(screen.getByRole('button', { name: /^15%$/ })).toBeDefined()
    expect(screen.getByRole('button', { name: /^18%$/ })).toBeDefined()
    expect(screen.getByRole('button', { name: /^20%$/ })).toBeDefined()
    expect(screen.getByRole('button', { name: /^custom$/i })).toBeDefined()
  })

  it('Test 2: on initial render, 18% button is visually selected (bg-amber-600 class)', () => {
    render(<SetTipStep />)
    const btn18 = screen.getByRole('button', { name: /^18%$/ })
    expect(btn18.className).toContain('bg-amber-600')
  })

  it('Test 3: tip dollar line shows "$1.80" by default ($10 × 18%)', () => {
    render(<SetTipStep />)
    // The "Tip:" line should contain $1.80 — find the paragraph containing "Tip:"
    const tipLine = screen.getByText(/^Tip:/)
    expect(tipLine.textContent).toContain('$1.80')
  })

  it('Test 4: clicking "20%" sets tipPercent to 20 and tip line shows "$2.00"', () => {
    render(<SetTipStep />)
    fireEvent.click(screen.getByRole('button', { name: /^20%$/ }))
    expect(useBillStore.getState().tipPercent).toBe(20)
    const tipLine = screen.getByText(/^Tip:/)
    expect(tipLine.textContent).toContain('$2.00')
  })

  it('Test 5: clicking "15%" sets tipPercent to 15 and tip line shows "$1.50"', () => {
    render(<SetTipStep />)
    fireEvent.click(screen.getByRole('button', { name: /^15%$/ }))
    expect(useBillStore.getState().tipPercent).toBe(15)
    const tipLine = screen.getByText(/^Tip:/)
    expect(tipLine.textContent).toContain('$1.50')
  })

  it('Test 6: clicking "Custom" reveals an Input field; hidden when not on custom', () => {
    render(<SetTipStep />)
    // Custom input should not be present initially
    expect(screen.queryByPlaceholderText(/enter percent/i)).toBeNull()
    // Click Custom
    fireEvent.click(screen.getByRole('button', { name: /^custom$/i }))
    // Now custom input should be visible
    expect(screen.getByPlaceholderText(/enter percent/i)).toBeDefined()
  })

  it('Test 7: typing "25" into custom input sets tipPercent to 25 and tip line shows "$2.50"', () => {
    render(<SetTipStep />)
    fireEvent.click(screen.getByRole('button', { name: /^custom$/i }))
    const input = screen.getByPlaceholderText(/enter percent/i)
    fireEvent.change(input, { target: { value: '25' } })
    expect(useBillStore.getState().tipPercent).toBe(25)
    const tipLine = screen.getByText(/^Tip:/)
    expect(tipLine.textContent).toContain('$2.50')
  })

  it('Test 8: typing "0" into custom input sets tipPercent to 0 and tip line shows "$0.00"', () => {
    render(<SetTipStep />)
    fireEvent.click(screen.getByRole('button', { name: /^custom$/i }))
    const input = screen.getByPlaceholderText(/enter percent/i)
    fireEvent.change(input, { target: { value: '0' } })
    expect(useBillStore.getState().tipPercent).toBe(0)
    const tipLine = screen.getByText(/^Tip:/)
    expect(tipLine.textContent).toContain('$0.00')
  })

  it('Test 9: typing non-numeric "abc" into custom input does not crash and valid number remains in store', () => {
    render(<SetTipStep />)
    fireEvent.click(screen.getByRole('button', { name: /^custom$/i }))
    // First set a valid value
    const input = screen.getByPlaceholderText(/enter percent/i)
    fireEvent.change(input, { target: { value: '20' } })
    expect(useBillStore.getState().tipPercent).toBe(20)
    // Now type non-numeric
    fireEvent.change(input, { target: { value: 'abc' } })
    // Store should still have a valid number (20 or 18 but definitely a number)
    expect(typeof useBillStore.getState().tipPercent).toBe('number')
    expect(Number.isFinite(useBillStore.getState().tipPercent)).toBe(true)
  })

  it('Test 10: "See results" CTA is always enabled (no disabled attribute)', () => {
    render(<SetTipStep />)
    const cta = screen.getByRole('button', { name: /see results/i })
    expect(cta.hasAttribute('disabled')).toBe(false)
  })

  it('Test 11: clicking "See results" sets step to 5', () => {
    render(<SetTipStep />)
    fireEvent.click(screen.getByRole('button', { name: /see results/i }))
    expect(useBillStore.getState().step).toBe(5)
  })

  it('Test 12: clicking Back sets step to 3', () => {
    render(<SetTipStep />)
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }))
    expect(useBillStore.getState().step).toBe(3)
  })
})
