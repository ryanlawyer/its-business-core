'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  addToast: (type: ToastType, message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string, duration = 5000) => {
    const id = ++idRef.current;
    setToasts((prev) => {
      const next = [...prev, { id, type, message }];
      // Keep max 5
      return next.slice(-5);
    });
    setTimeout(() => removeToast(id), duration);
  }, [removeToast]);

  // Color map using existing CSS vars
  const colorMap: Record<ToastType, { bg: string; border: string; icon: string }> = {
    success: { bg: 'var(--success)', border: 'var(--success)', icon: 'check-circle' },
    error: { bg: 'var(--error)', border: 'var(--error)', icon: 'x-circle' },
    warning: { bg: 'var(--warning)', border: 'var(--warning)', icon: 'exclamation' },
    info: { bg: 'var(--accent)', border: 'var(--accent)', icon: 'info' },
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm" style={{ pointerEvents: 'none' }}>
        {toasts.map((toast) => {
          const colors = colorMap[toast.type];
          return (
            <div
              key={toast.id}
              className="toast-enter rounded-lg shadow-lg px-4 py-3 flex items-start gap-3 border"
              style={{
                pointerEvents: 'auto',
                backgroundColor: 'var(--bg-primary)',
                borderColor: colors.border,
                borderLeftWidth: '4px',
              }}
            >
              <span style={{ color: colors.bg, flexShrink: 0, marginTop: '2px' }}>
                {toast.type === 'success' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                )}
                {toast.type === 'error' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                )}
                {toast.type === 'warning' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                )}
                {toast.type === 'info' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                )}
              </span>
              <p className="text-sm text-[var(--text-primary)] flex-1">{toast.message}</p>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
