'use client'

import { createPortal } from 'react-dom'
import { LoaderCircle } from 'lucide-react'

export interface OcrLoadingOverlayProps {
  visible: boolean
}

export function OcrLoadingOverlay({ visible }: OcrLoadingOverlayProps) {
  if (!visible || typeof document === 'undefined') return null
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      aria-label="Scanning your bill"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 transition-opacity duration-150"
    >
      <div className="flex flex-col items-center gap-4">
        <LoaderCircle size={40} className="text-white animate-spin" aria-hidden="true" />
        <p className="text-[16px] text-white">Scanning your bill…</p>
      </div>
    </div>,
    document.body,
  )
}
