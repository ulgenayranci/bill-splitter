'use client'

import { Toast } from '@base-ui/react/toast'
import { OcrErrorToast } from '@/components/wizard/OcrErrorToast'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Toast.Provider>
      {children}
      <OcrErrorToast />
    </Toast.Provider>
  )
}
