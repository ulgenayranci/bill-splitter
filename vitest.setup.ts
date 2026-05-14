import { vi } from 'vitest'

// jsdom 29 does not implement URL.createObjectURL or URL.revokeObjectURL.
// Phase 2 components (AddItemsStep, useBillStore.reset) call both during
// file selection and session reset. Mock them globally so tests that
// render <AddItemsStep /> do not crash.
//
// Cast through the global type to avoid TS complaints about the JSDOM stub
// signature differing from the real lib.dom.d.ts signature.
;(global.URL.createObjectURL as unknown) = vi.fn(() => 'blob:mock-url')
;(global.URL.revokeObjectURL as unknown) = vi.fn()

// TODO: install @testing-library/jest-dom to enable custom DOM matchers
// (toBeInTheDocument, toHaveValue, etc.) globally across all test files.
// Run: npm install --save-dev @testing-library/jest-dom
// Then add: import '@testing-library/jest-dom'

// jsdom does not implement the Clipboard API. Phase 5 ResultsStep copy
// summary feature calls navigator.clipboard.writeText. Mock it globally
// so tests do not crash.
;(navigator as { clipboard?: unknown }).clipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
}
