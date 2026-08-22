import { useMemo, useState } from 'react';

/**
 * Search + sort over a row array, for the partner portal's two tables.
 *
 * Ports frontendmain/src/Partner/platform/useSortableTable.js. The sorting and filtering carry
 * over unchanged — including the `localeCompare(..., { numeric: true })` that keeps "Class 10"
 * after "Class 9", and the null-last ordering. What is dropped is `headerProps`, which returns
 * `className` and an `onClick` for a `<th>`: there is no `<th>` here, so callers use `toggle(key)`
 * and `indicatorFor(key)` instead.
 *
 * Sort cycles none → asc → desc → none, as on the web. The third state matters more on a phone
 * than it does on a desktop: it is how a partner gets back to the server's own ordering
 * (Monetization is returned newest-first) after tapping a column out of curiosity.
 *
 * @param {Array<object>} rows
 * @param {{ searchKeys?: string[], initialSort?: {key: string, dir: 'asc'|'desc'} | null }} [options]
 */
export default function useSortableRows(rows, options = {}) {
  const { searchKeys = [], initialSort = null } = options;
  const [sort, setSort] = useState(initialSort);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const list = rows || [];
    if (!search.trim() || searchKeys.length === 0) return list;
    const q = search.trim().toLowerCase();
    return list.filter((row) =>
      searchKeys.some((k) => {
        const v = row?.[k];
        return v != null && String(v).toLowerCase().includes(q);
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, searchKeys.join('|')]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const { key, dir } = sort;
    const mult = dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a?.[key];
      const bv = b?.[key];
      // Nulls sink to the bottom in BOTH directions — a row with no value is not "the smallest",
      // it is missing, and burying it is what the web does.
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mult;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * mult;
    });
  }, [filtered, sort]);

  /** none → asc → desc → none. */
  const toggle = (key) =>
    setSort((cur) => {
      if (!cur || cur.key !== key) return { key, dir: 'asc' };
      if (cur.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });

  /** 'none' | 'asc' | 'desc' — the caller picks the icon. */
  const indicatorFor = (key) => (!sort || sort.key !== key ? 'none' : sort.dir);

  return { rows: sorted, total: (rows || []).length, search, setSearch, sort, toggle, indicatorFor };
}
