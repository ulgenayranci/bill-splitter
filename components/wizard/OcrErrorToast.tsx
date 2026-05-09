'use client'

import { Toast } from '@base-ui/react/toast'
import { cn } from '@/lib/utils'

export function OcrErrorToast() {
  const { toasts } = Toast.useToastManager()
  return (
    <Toast.Portal>
      <Toast.Viewport
        className={cn(
          'fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-[480px] flex-col gap-2'
        )}
      >
        {toasts.map((toast) => (
          <Toast.Root
            key={toast.id}
            toast={toast}
            className="rounded-xl bg-zinc-900 px-4 py-3 text-white shadow-lg"
          >
            <Toast.Description className="text-[16px]" />
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  )
}
