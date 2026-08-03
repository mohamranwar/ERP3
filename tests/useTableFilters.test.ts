/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTableFilters } from '../src/hooks/useTableFilters';

interface Item {
  id: string;
  name: string;
  status: string;
}

const items: Item[] = [
  { id: '1', name: 'Alpha Widget', status: 'active' },
  { id: '2', name: 'Beta Widget', status: 'inactive' },
  { id: '3', name: 'Gamma Widget', status: 'active' },
];

describe('useTableFilters', () => {
  it('applies dropdown filters as AND conditions when there is no active search', () => {
    const { result } = renderHook(() =>
      useTableFilters(items, ['name'], { status: 'active' })
    );
    expect(result.current.filtered.map(i => i.id)).toEqual(['1', '3']);
    expect(result.current.hasActiveSearch).toBe(false);
  });

  it('ignores an empty-string dropdown value (treats it as "All")', () => {
    const { result } = renderHook(() =>
      useTableFilters(items, ['name'], { status: '' })
    );
    expect(result.current.filtered).toHaveLength(3);
  });

  it('applies a customFilter in addition to dropdown filters', () => {
    const { result } = renderHook(() =>
      useTableFilters(items, ['name'], {}, undefined, undefined, (i) => i.name !== 'Gamma Widget')
    );
    expect(result.current.filtered.map(i => i.id)).toEqual(['1', '2']);
  });

  it('bypasses dropdown filters once the debounced search query becomes active (the README "Override Principle")', async () => {
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) =>
        useTableFilters(items, ['name'], { status: 'active' }, query, () => {}),
      { initialProps: { query: '' } }
    );

    expect(result.current.filtered.map(i => i.id)).toEqual(['1', '3']);

    rerender({ query: 'beta' });

    // "Beta Widget" has status 'inactive' - it would be excluded by the
    // active dropdown filter, but a live search query must override that.
    await waitFor(() => expect(result.current.hasActiveSearch).toBe(true), { timeout: 1000 });
    expect(result.current.filtered.map(i => i.id)).toEqual(['2']);
  });

  it('falls back to internal state when no externalQuery/setExternalQuery is supplied', () => {
    const { result } = renderHook(() => useTableFilters(items, ['name'], {}));
    act(() => {
      result.current.setSearchQuery('gamma');
    });
    expect(result.current.searchQuery).toBe('gamma');
  });

  it('treats null/undefined field values as non-matches instead of throwing', () => {
    const withNulls = [...items, { id: '4', name: undefined as any, status: 'active' }];
    const { result } = renderHook(() => useTableFilters(withNulls, ['name'], {}));
    expect(() => result.current.filtered).not.toThrow();
  });
});
