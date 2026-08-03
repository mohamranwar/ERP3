/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import '@testing-library/jest-dom/vitest';

// supabaseClient.ts seeds the offline mock DB into localStorage once, the
// first time it is imported ("if (!localStorage.getItem(key))"). Vitest
// gives each test *file* its own fresh module registry and jsdom window by
// default, so the seed runs exactly once per file and every test in that
// file shares the same deterministic starting dataset. Do NOT call
// localStorage.clear() globally here - that would wipe the seed before the
// first test in a file re-triggers it (it only auto-seeds when a key is
// missing). Tests that need a clean slate should scope that to themselves.

// ResizeObserver isn't implemented in jsdom, but ScrollableTable.tsx uses it
// to detect table overflow. Stub it out so components using it don't throw.
if (typeof (globalThis as any).ResizeObserver === 'undefined') {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
