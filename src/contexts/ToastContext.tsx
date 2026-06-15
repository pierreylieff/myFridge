import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface Toast {
  id: number
  message: string
  actionLabel?: string
  onAction?: () => void
}

interface ToastState {
  show: (message: string, opts?: { actionLabel?: string; onAction?: () => void }) => void
}

const ToastContext = createContext<ToastState | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const show = useCallback<ToastState['show']>((message, opts) => {
    if (timer.current) clearTimeout(timer.current)
    const id = Date.now()
    setToast({ id, message, ...opts })
    timer.current = setTimeout(() => setToast(null), 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <div className="snackbar" role="status">
          <span>{toast.message}</span>
          {toast.actionLabel && (
            <button
              className="snackbar__action"
              onClick={() => {
                toast.onAction?.()
                setToast(null)
              }}
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast doit être utilisé dans ToastProvider')
  return ctx
}
