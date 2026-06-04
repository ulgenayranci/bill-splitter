'use client'

import { X } from 'lucide-react'
import { useBillStore } from '@/stores/useBillStore'

interface BillPhotoLightboxProps {
  open: boolean
  onClose: () => void
}

/**
 * Fullscreen viewer for the captured bill photo. Controlled by the caller.
 * Reads the image from the store so it works on any screen (Setup, Assign, …)
 * and after a refresh (the photo is persisted as a base64 data-URL).
 */
export function BillPhotoLightbox({ open, onClose }: BillPhotoLightboxProps) {
  const billImageUrl = useBillStore((s) => s.billImageUrl)

  if (!open || !billImageUrl) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label="Bill photo"
      tabIndex={-1}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
      >
        <X size={20} />
      </button>
      <img
        src={billImageUrl}
        alt="Full bill photo"
        className="max-h-[90vh] max-w-[90vw] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}
