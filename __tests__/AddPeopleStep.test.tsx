import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { AddPeopleStep } from '@/components/wizard/AddPeopleStep'
import { useBillStore } from '@/stores/useBillStore'

describe('AddPeopleStep', () => {
  beforeEach(() => {
    useBillStore.getState().reset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders empty state heading when no people', () => {
    render(<AddPeopleStep />)
    expect(screen.getByText(/who's at the table/i)).toBeDefined()
  })

  it('disables CTA when no people added', () => {
    render(<AddPeopleStep />)
    const cta = screen.getByRole('button', { name: /continue to items/i })
    expect(cta.hasAttribute('disabled')).toBe(true)
  })

  it('adds a person when name typed and Add Person clicked', () => {
    render(<AddPeopleStep />)
    const input = screen.getByPlaceholderText(/enter name/i)
    fireEvent.change(input, { target: { value: 'Alice' } })
    fireEvent.click(screen.getByRole('button', { name: /^add person$/i }))
    expect(useBillStore.getState().people.map((p) => p.name)).toContain('Alice')
  })

  it('enables CTA after adding a person', () => {
    useBillStore.getState().addPerson('Alice')
    render(<AddPeopleStep />)
    const cta = screen.getByRole('button', { name: /continue to items/i })
    expect(cta.hasAttribute('disabled')).toBe(false)
  })

  it('renders all added people in the list', () => {
    useBillStore.getState().addPerson('Alice')
    useBillStore.getState().addPerson('Bob')
    render(<AddPeopleStep />)
    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.getByText('Bob')).toBeDefined()
  })

  it('trash button has aria-label with person name', () => {
    useBillStore.getState().addPerson('Alice')
    render(<AddPeopleStep />)
    expect(screen.getByLabelText('Remove Alice')).toBeDefined()
  })
})
