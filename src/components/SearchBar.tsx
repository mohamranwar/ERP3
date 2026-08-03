import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  hasActiveSearch?: boolean;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
  hasActiveSearch = false,
}: SearchBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className={`relative flex items-center ${className}`}>
        <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          // Suppress the native WebKit/Blink "clear" (x) button that type="search"
          // inputs render automatically - it used to sit on top of / next to our
          // own custom clear button below, showing two overlapping X controls.
          className="w-full ps-9 pe-9 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 font-medium focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-slate-400 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:appearance-none"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-2.5 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {hasActiveSearch && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded-full animate-pulse">
          <span>Search active — filters bypassed</span>
          <button
            onClick={() => onChange('')}
            className="p-0.5 rounded-full hover:bg-blue-100 transition-colors"
            aria-label="Clear active search"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      )}
    </div>
  );
}
