/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertCircle, RefreshCw, Layers } from 'lucide-react';

interface DataStateWrapperProps {
  loading: boolean;
  error: Error | string | null;
  isEmpty: boolean;
  onRetry?: () => void;
  children: React.ReactNode;
  emptyMessage?: string;
  loadingHeightClass?: string;
}

export default function DataStateWrapper({
  loading,
  error,
  isEmpty,
  onRetry,
  children,
  emptyMessage = "No data records found.",
  loadingHeightClass = "h-64"
}: DataStateWrapperProps) {
  if (loading) {
    return (
      <div className={`flex flex-col items-center justify-center ${loadingHeightClass} w-full`} id="data_state_loading">
        <div className="relative flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-100 border-t-blue-600"></div>
        </div>
        <p className="mt-3.5 text-xs font-semibold text-slate-500 font-sans animate-pulse">Loading system workspace data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50/50 border border-red-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center max-w-xl mx-auto my-8 space-y-4" id="data_state_error">
        <div className="p-3 bg-red-100/80 border border-red-200 text-red-600 rounded-2xl">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-sm font-bold text-slate-950 font-sans uppercase tracking-wide">Data Synchronisation Failed</h3>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            {typeof error === 'string' ? error : error.message || 'An unexpected database error occurred.'}
          </p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-red-300 hover:border-red-400 text-red-700 hover:bg-red-50/50 active:bg-red-50 transition-all font-bold text-xs rounded-xl shadow-3xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Connection
          </button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="bg-slate-50/40 border border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center text-center max-w-xl mx-auto my-8 space-y-3.5" id="data_state_empty">
        <div className="p-3 bg-slate-100 text-slate-500 border border-slate-200 rounded-2xl">
          <Layers className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">No Records Located</h4>
          <p className="text-[11px] text-slate-500 leading-relaxed max-w-xs mx-auto font-medium">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
