import { useState, useEffect, useTransition } from 'react';

export function useTableFilters<T>(
  items: T[],
  searchFields: (keyof T)[],
  dropdowns: Record<string, string>,
  externalQuery?: string,
  setExternalQuery?: (val: string) => void,
  customFilter?: (item: T) => boolean
) {
  const [internalQuery, setInternalQuery] = useState('');
  const searchQuery = externalQuery !== undefined ? externalQuery : internalQuery;
  const setSearchQuery = setExternalQuery !== undefined ? setExternalQuery : setInternalQuery;

  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [, startTransition] = useTransition();

  // Debounce logic (200ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      startTransition(() => {
        setDebouncedQuery(searchQuery);
      });
    }, 200);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  const activeQuery = debouncedQuery.trim();
  const hasActiveSearch = activeQuery.length > 0;

  const filtered = items.filter((item) => {
    if (customFilter) {
      if (!customFilter(item)) {
        return false;
      }
    }

    if (hasActiveSearch) {
      // Ignore dropdown filters if search query is active
      const lowercaseQuery = activeQuery.toLowerCase();
      return searchFields.some((field) => {
        const val = item[field];
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(lowercaseQuery);
      });
    }

    // Apply active dropdown filters as AND filters
    return Object.entries(dropdowns).every(([key, value]) => {
      if (!value) return true; // All option or unselected
      const val = item[key as keyof T];
      if (val === null || val === undefined) return false;
      return String(val) === String(value);
    });
  });

  return {
    filtered,
    searchQuery,
    setSearchQuery,
    activeQuery,
    hasActiveSearch,
  };
}
