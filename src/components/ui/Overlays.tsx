import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { Button } from './Primitives';

/* -------------------------------------------------------------------------- */
/* 1. TOAST NOTIFICATION SYSTEM                                               */
/* -------------------------------------------------------------------------- */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextValue {
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
};

const TOAST_CONFIG: Record<
  ToastType,
  { bg: string; iconBg: string; Icon: React.FC<{ className?: string }> }
> = {
  success: {
    bg: 'border-[#16A34A]/35 bg-white text-[#1F1D2B]',
    iconBg: 'bg-[#16A34A] text-white',
    Icon: CheckCircle2,
  },
  error: {
    bg: 'border-[#DC2626]/35 bg-white text-[#1F1D2B]',
    iconBg: 'bg-[#DC2626] text-white',
    Icon: AlertCircle,
  },
  warning: {
    bg: 'border-[#F59E0B]/45 bg-white text-[#1F1D2B]',
    iconBg: 'bg-[#F59E0B] text-white',
    Icon: AlertTriangle,
  },
  info: {
    bg: 'border-[#2563EB]/35 bg-white text-[#1F1D2B]',
    iconBg: 'bg-[#2563EB] text-white',
    Icon: Info,
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
      window.setTimeout(() => removeToast(id), 4000);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="fixed bottom-20 sm:bottom-5 right-4 sm:right-5 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2.5 pointer-events-none"
      >
        {toasts.map((toast) => {
          const { bg, iconBg, Icon } = TOAST_CONFIG[toast.type];
          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-xl fw-animate-slide-right ${bg}`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${iconBg}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug">{toast.title}</p>
                {toast.description && (
                  <p className="mt-0.5 text-xs text-[#1F1D2B]/65 leading-relaxed">
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                aria-label="Close notification"
                className="p-1 rounded-md text-[#1F1D2B]/45 hover:text-[#1F1D2B] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

/* -------------------------------------------------------------------------- */
/* 2. MODAL                                                                   */
/* -------------------------------------------------------------------------- */

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

const MODAL_WIDTHS = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  maxWidth = 'md',
  children,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fw-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      <div
        className="fixed inset-0 bg-[#1F1D2B]/65 backdrop-blur-xs fw-animate-fade"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`relative z-10 w-full ${MODAL_WIDTHS[maxWidth]} max-h-[90vh] flex flex-col rounded-2xl border border-[#1F1D2B]/12 bg-[#FFF8EF] shadow-2xl fw-animate-modal overflow-hidden`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#1F1D2B]/10 bg-white px-5 sm:px-6 py-4">
          <div className="min-w-0">
            <h2
              id="fw-modal-title"
              className="font-heading text-lg font-semibold text-[#1F1D2B] truncate"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-[#1F1D2B]/60">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#1F1D2B]/12 text-[#1F1D2B]/70 hover:border-[#FF7A00] hover:text-[#FF7A00] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 3. CONFIRMATION DIALOG                                                     */
/* -------------------------------------------------------------------------- */

export interface ConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
}) => (
  <Modal open={open} onClose={onClose} title={title} maxWidth="sm">
    <div className="space-y-5">
      <div className="flex items-start gap-3.5">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            destructive
              ? 'bg-[#DC2626]/12 text-[#DC2626]'
              : 'bg-[#F59E0B]/15 text-[#F59E0B]'
          }`}
        >
          <AlertTriangle className="h-5 w-5" />
        </div>
        <p className="text-sm text-[#1F1D2B]/80 leading-relaxed">{message}</p>
      </div>
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#1F1D2B]/10">
        <Button variant="outline" size="sm" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? 'danger' : 'primary'}
          size="sm"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  </Modal>
);
