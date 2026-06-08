'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useBillStore } from '@/stores/useBillStore'

/**
 * easy-billsy app shell header (design "Style A").
 * White background, dark wordmark, amber hamburger lines — appears on every screen.
 * Menu: New Split (active) / History (disabled) / About Us (disabled) per D-04/D-06.
 */
export function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const router = useRouter()

  const reset = useBillStore((s) => s.reset)
  const setStep = useBillStore((s) => s.setStep)
  const people = useBillStore((s) => s.people)
  const items = useBillStore((s) => s.items)
  const billImageUrl = useBillStore((s) => s.billImageUrl)

  // D-05: a split is "in progress" once anything has been added.
  const hasProgress = people.length > 0 || items.length > 0 || billImageUrl !== null

  const startNewSplit = () => {
    reset()
    setStep(1)
    router.push('/')
  }

  const handleNewSplit = () => {
    setMenuOpen(false)
    if (hasProgress) {
      setConfirmReset(true)
    } else {
      startNewSplit()
    }
  }

  return (
    <>
      <header className="relative flex h-12 flex-shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4">
        {/* Wordmark */}
        <div
          className="select-none text-[15px] leading-none tracking-[-0.03em] text-zinc-900"
          aria-label="easy-billsy"
        >
          <span className="font-normal">easy</span>
          <span className="opacity-30">−</span>
          <span className="font-bold">billsy</span>
        </div>

        {/* Hamburger */}
        <button
          type="button"
          aria-label="Menu"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          className="flex flex-col gap-[3px] p-2"
        >
          <span className="block h-[1.5px] w-[18px] rounded bg-amber-600" />
          <span className="block h-[1.5px] w-[18px] rounded bg-amber-600" />
          <span className="block h-[1.5px] w-[18px] rounded bg-amber-600" />
        </button>

        {/* Dropdown menu */}
        {menuOpen && (
          <>
            {/* Outside-click backdrop */}
            <div
              className="fixed inset-0 z-40"
              aria-hidden="true"
              onClick={() => setMenuOpen(false)}
            />
            <div
              role="menu"
              aria-label="Main menu"
              className="absolute right-3 top-[46px] z-50 w-[168px] overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                onClick={handleNewSplit}
                className="flex w-full items-center px-4 py-2.5 text-left text-[14px] font-medium text-zinc-900 hover:bg-amber-50"
              >
                New Split
              </button>
              <div
                role="menuitem"
                aria-disabled="true"
                className="flex w-full cursor-not-allowed items-center px-4 py-2.5 text-left text-[14px] font-medium text-zinc-300"
              >
                History
              </div>
              <div
                role="menuitem"
                aria-disabled="true"
                className="flex w-full cursor-not-allowed items-center px-4 py-2.5 text-left text-[14px] font-medium text-zinc-300"
              >
                About Us
              </div>
            </div>
          </>
        )}
      </header>

      {/* D-05 confirm-reset when a bill is already in progress */}
      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a new split?</DialogTitle>
            <DialogDescription>
              This clears the current bill, people, and assignments.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => {
                setConfirmReset(false)
                startNewSplit()
              }}
            >
              New Split
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
