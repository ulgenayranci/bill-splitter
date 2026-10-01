import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { BillViewHeader } from '@/components/split/BillViewHeader'
import type { SessionPayload } from '@/lib/sessionSchema'
import { AVATAR_COLORS } from '@/stores/useBillStore'

const BASE_CREATED_AT = new Date('2025-06-26T12:00:00Z').getTime()

const mockSession: SessionPayload = {
  people: [
    { id: 'p1', name: 'Alice', colorIndex: 0 },
    { id: 'p2', name: 'Bob', colorIndex: 1 },
    { id: 'p3', name: 'Carol', colorIndex: 2 },
    { id: 'p4', name: 'Dave', colorIndex: 3 },
    { id: 'p5', name: 'Eve', colorIndex: 4 },
  ],
  items: [{ id: 'i1', name: 'Pizza', priceCents: 1500, quantity: 1 }],
  claims: { items: {}, personSlots: {}, donePeople: {} },
  tips: {},
  currencyCode: 'USD',
  createdAt: BASE_CREATED_AT,
}

describe('BillViewHeader', () => {
  afterEach(() => cleanup())

  it('Test 1: renders bill title containing "Bill ·" and a date derived from session.createdAt', () => {
    render(
      <BillViewHeader
        session={mockSession}
        myPersonId="p1"
        onStripTap={vi.fn()}
        sessionId="test-session-id"
      />
    )
    // Title must contain "Bill ·"
    const titleEl = screen.getByText(/Bill ·/)
    expect(titleEl).toBeDefined()
    // Must contain the en-GB long date derived from session.createdAt (same formatter as the component)
    const expected = new Date(mockSession.createdAt).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    expect(titleEl.textContent).toBe(`Bill · ${expected}`)
    expect(titleEl.textContent).toMatch(/Bill · \d{1,2} June \d{4}/)
  })

  it('Test 2: own identity (myPersonId) renders as an expanded pill showing the person name', () => {
    render(
      <BillViewHeader
        session={mockSession}
        myPersonId="p1"
        onStripTap={vi.fn()}
        sessionId="test-session-id"
      />
    )
    // Alice should be visible as her name (expanded pill)
    expect(screen.getByText('Alice')).toBeDefined()
  })

  it('Test 3: others (not myPersonId) render as compact initial circles (not their full name)', () => {
    render(
      <BillViewHeader
        session={mockSession}
        myPersonId="p1"
        onStripTap={vi.fn()}
        sessionId="test-session-id"
      />
    )
    // Bob full name should NOT appear as text (just as initial "B" in a circle)
    const allText = document.body.textContent ?? ''
    // The initials B, C, D should appear (compact circles)
    expect(allText).toContain('B')
    expect(allText).toContain('C')
    // Bob's full name "Bob" should not appear as a standalone text node (only initial in circle)
    const bobElements = screen.queryAllByText('Bob')
    expect(bobElements.length).toBe(0)
  })

  it('Test 4: when more than MAX_STRIP_AVATARS=3 others, overflow "+N" badge shows correct N', () => {
    // p1 is mine, p2/p3/p4 fill MAX_STRIP_AVATARS=3 slots, p5 overflows → +1
    render(
      <BillViewHeader
        session={mockSession}
        myPersonId="p1"
        onStripTap={vi.fn()}
        sessionId="test-session-id"
      />
    )
    // 4 others (p2, p3, p4, p5), max 3 shown → +1 overflow
    expect(screen.getByText('+1')).toBeDefined()
  })

  it('Test 5: tapping the people strip container calls onStripTap', () => {
    const onStripTap = vi.fn()
    render(
      <BillViewHeader
        session={mockSession}
        myPersonId="p1"
        onStripTap={onStripTap}
        sessionId="test-session-id"
      />
    )
    const strip = screen.getByLabelText('People. Tap to change identity')
    fireEvent.click(strip)
    expect(onStripTap).toHaveBeenCalledTimes(1)
  })

  it('Test 6: share affordance (Invite button) is present', () => {
    render(
      <BillViewHeader
        session={mockSession}
        myPersonId="p1"
        onStripTap={vi.fn()}
        sessionId="test-session-id"
      />
    )
    const shareBtn = screen.getByLabelText('Invite: copy bill link')
    expect(shareBtn).toBeDefined()
  })

  it('Test 7 (D-01): receipt button with aria-label "View receipt" is NOT present', () => {
    render(
      <BillViewHeader
        session={mockSession}
        myPersonId="p1"
        onStripTap={vi.fn()}
        sessionId="test-session-id"
      />
    )
    expect(screen.queryByLabelText('View receipt')).toBeNull()
  })

  it('Test 8: avatar color class for a person matches AVATAR_COLORS[colorIndex % 6]', () => {
    // p2 colorIndex=1 → bg-[#9b6cf0]
    render(
      <BillViewHeader
        session={mockSession}
        myPersonId="p1"
        onStripTap={vi.fn()}
        sessionId="test-session-id"
      />
    )
    // Find the element carrying Bob's avatar class (arbitrary-value class, so match via classList)
    const bobCircle = Array.from(document.querySelectorAll('span, div')).find((el) =>
      el.classList.contains(AVATAR_COLORS[1])
    )
    expect(bobCircle).toBeDefined()
    expect(bobCircle).not.toBeNull()
    // Verify it matches the correct AVATAR_COLORS entry
    expect(AVATAR_COLORS[1]).toBe('bg-[#9b6cf0]')
  })

  it('Test 9: when myPersonId is null, no expanded pill is shown', () => {
    const sessionWithNoPerson: SessionPayload = {
      ...mockSession,
      people: [{ id: 'p1', name: 'Alice', colorIndex: 0 }],
    }
    render(
      <BillViewHeader
        session={sessionWithNoPerson}
        myPersonId={null}
        onStripTap={vi.fn()}
        sessionId="test-session-id"
      />
    )
    // No name pill shown — no name text visible
    const aliceElements = screen.queryAllByText('Alice')
    expect(aliceElements.length).toBe(0)
  })

  it('Test 10 (D-02): Invite button has min-h-[44px] class for ≥44px touch target', () => {
    render(
      <BillViewHeader
        session={mockSession}
        myPersonId="p1"
        onStripTap={vi.fn()}
        sessionId="test-session-id"
      />
    )
    const shareBtn = screen.getByLabelText('Invite: copy bill link')
    expect(shareBtn.className).toContain('min-h-[44px]')
  })
})
