import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const push = vi.fn()
const reset = vi.fn()
const setStep = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}))
vi.mock('@/stores/useBillStore', () => ({
  useBillStore: (selector: (s: unknown) => unknown) => selector({ reset, setStep }),
}))

import { SessionExpiredScreen } from '@/components/split/SessionExpiredScreen'

describe('SessionExpiredScreen', () => {
  it('"Start a new split" resets the bill and goes to the setup screen', () => {
    render(<SessionExpiredScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'Start a new split' }))
    expect(reset).toHaveBeenCalledOnce()
    expect(setStep).toHaveBeenCalledWith(1)
    expect(push).toHaveBeenCalledWith('/')
  })
})
