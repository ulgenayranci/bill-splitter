import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ServiceFeeCard } from '@/components/split/ServiceFeeCard'

afterEach(() => cleanup())

describe('ServiceFeeCard', () => {
  it('renders label, full fee, shared line with share and people count', () => {
    render(
      <ServiceFeeCard feeCents={500} myShareCents={167} peopleCount={3} myColorIndex={0} currencyCode="EUR" />,
    )
    expect(screen.getByText('Service fee')).toBeDefined()
    const card = screen.getByTestId('service-fee-card')
    expect(card.textContent).toContain('€5.00')
    const share = screen.getByTestId('service-fee-share').textContent ?? ''
    expect(share).toContain('Shared by everyone')
    expect(share).toContain('€1.67')
    expect(share).toContain('3 people')
  })

  it('is non-interactive: no role, no aria-pressed, click does nothing', () => {
    const { container } = render(
      <ServiceFeeCard feeCents={500} myShareCents={250} peopleCount={2} myColorIndex={1} />,
    )
    const card = screen.getByTestId('service-fee-card')
    expect(card.getAttribute('role')).toBeNull()
    expect(card.getAttribute('aria-pressed')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    const before = container.innerHTML
    fireEvent.click(card)
    expect(container.innerHTML).toBe(before)
  })
})
