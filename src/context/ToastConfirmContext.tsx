/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { AlertCircle, CheckCircle2, XCircle, X, HelpCircle } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';

export interface Toast {
  id: string;
  message: string;
  variant: 'success' | 'error';
}

interface ConfirmState {
  isOpen: boolean;
  message: string;
  title: string;
  resolve: (value: boolean) => void;
}

interface ToastConfirmContextType {
  showToast: (message: string, variant?: 'success' | 'error') => void;
  confirm: (message: string, title?: string) => Promise<boolean>;
}

const ToastConfirmContext = createContext<ToastConfirmContextType | undefined>(undefined);

export function ToastConfirmProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    message: '',
    title: '',
    resolve: () => {},
  });

  const showToast = useCallback((message: string, variant: 'success' | 'error' = 'success') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    setToasts(prev => [...prev, { id, message, variant }]);

    // Auto-dismiss in 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const confirm = useCallback((message: string, title?: string) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        isOpen: true,
        message,
        title: title || 'Confirm Action',
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    confirmState.resolve(true);
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  }, [confirmState]);

  const handleCancel = useCallback(() => {
    confirmState.resolve(false);
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  }, [confirmState]);

  // Trap focus inside the confirm dialog while it's open, and let Escape
  // act as Cancel (consistent with how the Supabase config modal behaves).
  const confirmModalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(confirmModalRef, confirmState.isOpen, handleCancel);

  return (
    <ToastConfirmContext.Provider value={{ showToast, confirm }}>
      {children}

      {/* Global Toast Stack Container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none" id="global_toast_stack">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl shadow-lg border text-xs font-sans transition-all duration-300 transform translate-y-0 ease-out bg-white ${
              toast.variant === 'success'
                ? 'border-emerald-100 text-slate-800 ring-1 ring-emerald-500/10'
                : 'border-red-100 text-slate-800 ring-1 ring-red-500/10'
            }`}
            style={{ animation: 'slideIn 0.2s ease-out' }}
          >
            <div className="shrink-0 mt-0.5">
              {toast.variant === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <XCircle className="w-4 h-4 text-red-600" />
              )}
            </div>
            <div className="flex-1 font-semibold text-slate-700 leading-relaxed break-words">{toast.message}</div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 text-slate-400 hover:text-slate-600 p-0.5 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Global Confirmation Dialog Modal */}
      {confirmState.isOpen && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs" id="global_confirm_modal">
          <div ref={confirmModalRef} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-slate-100 animate-in fade-in zoom-in-95 duration-150 font-sans">
            {/* Header */}
            <div className="px-6 py-4.5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <div className="p-2 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl shrink-0">
                <HelpCircle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  {confirmState.title}
                </h3>
              </div>
            </div>

            {/* Message Body */}
            <div className="p-6 text-xs text-slate-600 font-medium leading-relaxed">
              {confirmState.message}
            </div>

            {/* Action Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5">
              <button
                id="global_confirm_cancel"
                onClick={handleCancel}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100 transition-all shadow-3xs"
              >
                Cancel
              </button>
              <button
                id="global_confirm_proceed"
                onClick={handleConfirm}
                className="px-4.5 py-2 bg-blue-600 text-white font-bold rounded-xl text-xs hover:bg-blue-700 active:bg-blue-800 transition-all shadow-xs"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastConfirmContext.Provider>
  );
}

export function useToastConfirm() {
  const context = useContext(ToastConfirmContext);
  if (!context) {
    throw new Error('useToastConfirm must be used within a ToastConfirmProvider');
  }
  return context;
}

// Support simple alias import
export const useToast = useToastConfirm;
