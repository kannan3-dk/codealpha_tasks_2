import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);

    setTimeout(() => {
      removeToast(id);
    }, 4500);
  }, [removeToast]);

  const success = useCallback((message: string) => addToast(message, 'success'), [addToast]);
  const error = useCallback((message: string) => addToast(message, 'error'), [addToast]);
  const info = useCallback((message: string) => addToast(message, 'info'), [addToast]);

  return (
    <ToastContext.Provider value={{ toast: addToast, success, error, info }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-2xl border border-[#26262a] bg-[#141416] text-[#f2f2f3] text-sm transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
          >
            {t.type === 'error' && <AlertCircle className="w-5 h-5 text-[#f2f2f3] shrink-0 mt-0.5" strokeWidth={1.75} />}
            {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#f2f2f3] shrink-0 mt-0.5" strokeWidth={1.75} />}
            {t.type === 'info' && <Info className="w-5 h-5 text-[#a1a1a8] shrink-0 mt-0.5" strokeWidth={1.75} />}
            <p className="flex-1 font-medium leading-relaxed">{t.message}</p>
            <button
              onClick={() => removeToast(t.id)}
              className="text-[#a1a1a8] hover:text-[#f2f2f3] transition-colors p-0.5 -mr-1 cursor-pointer"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
