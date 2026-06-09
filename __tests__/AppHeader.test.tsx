import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { AppHeader } from '@/components/wizard/AppHeader'

// Mock next/navigation so useRouter() doesn't throw in jsdom
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

// Mock useBillStore
vi.mock('@/stores/useBillStore', () => ({
  useBillStore: (selector: (s: unknown) => unknown) => {
    const store = {
      reset: vi.fn(),
      setStep: vi.fn(),
      people: [],
      items: [],
      billImageUrl: null,
    }
    return selector(store)
  },
  AVATAR_COLORS: ['bg-red-500'],
}))

afterEach(() => cleanup())

describe('AppHeader', () => {
  it('renders a sticky header (has sticky and top-0 classes)', () => {
    render(<AppHeader />)
    const header = screen.getByRole('banner')
    expect(header.className).toMatch(/sticky/)
    expect(header.className).toMatch(/top-0/)
  })

  it('renders the easy-billsy wordmark', () => {
    render(<AppHeader />)
    expect(screen.getByLabelText('easy-billsy')).toBeDefined()
  })

  it('renders the hamburger menu button', () => {
    render(<AppHeader />)
    expect(screen.getByRole('button', { name: 'Menu' })).toBeDefined()
  })
})
