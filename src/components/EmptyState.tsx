import React from 'react';
import { Database } from 'lucide-react';

interface EmptyStateProps {
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  message = 'No data to display — connect Supabase or import a CSV',
  actionLabel = 'Go to CSV Importer',
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-white border border-dashed border-slate-200 rounded-xl max-w-lg mx-auto my-6 space-y-4">
      <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
        <Database className="w-8 h-8" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-sm font-semibold text-gray-900 font-sans">No Data Available</h3>
        <p className="text-xs text-gray-500 max-w-sm font-sans">{message}</p>
      </div>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs hover:shadow-sm transition-all focus:outline-hidden cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
