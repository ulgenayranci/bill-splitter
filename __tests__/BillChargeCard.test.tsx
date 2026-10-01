import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { BillChargeCard } from '@/components/split/BillChargeCard'

afterEach(() => cleanup())

describe('BillChargeCard', () => {
  it('renders label, amount, lock and shared line with share and people count', () => {
    const { container } = render(
      <BillChargeCard label="Tax" testId="tax-card" chargeCents={800} myShareCents={267} peopleCount={3} myColorIndex={0} currencyCode="EUR" />,
    )
    expect(screen.getByText('Tax')).toBeDefined()
    const card = screen.getByTestId('tax-card')
    expect(card.getAttribute('aria-label')).toBe('Tax, shared equally by everyone')
    expect(card.textContent).toContain('€8.00')
    expect(container.querySelector('svg.lucide-lock')).not.toBeNull()
    const share = screen.getByTestId('tax-share').textContent ?? ''
    expect(share).toContain('Shared by everyone')
    expect(share).toContain('€2.67')
    expect(share).toContain('3 people')
  })

  it('is non-interactive', () => {
    const { container } = render(
      <BillChargeCard label="Tax" testId="tax-card" chargeCents={800} myShareCents={400} peopleCount={2} myColorIndex={1} />,
    )
    const card = screen.getByTestId('tax-card')
    expect(card.getAttribute('role')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    const before = container.innerHTML
    fireEvent.click(card)
    expect(container.innerHTML).toBe(before)
  })
})
