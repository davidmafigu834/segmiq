"use client";

import { useCallback, useMemo, useState } from "react";

/** Controlled page-scoped row selection by stable record IDs. */
export function useDataTableSelection(pageRowIds: string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const toggleRow = useCallback((id: string, checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const togglePage = useCallback(
    (checked: boolean) => {
      setSelectedIds((previous) => {
        const next = new Set(previous);
        for (const id of pageRowIds) {
          if (checked) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    },
    [pageRowIds]
  );

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const allPageSelected = useMemo(
    () => pageRowIds.length > 0 && pageRowIds.every((id) => selectedIds.has(id)),
    [pageRowIds, selectedIds]
  );

  const somePageSelected = useMemo(
    () => pageRowIds.some((id) => selectedIds.has(id)),
    [pageRowIds, selectedIds]
  );

  const indeterminate = somePageSelected && !allPageSelected;

  return {
    selectedIds,
    setSelectedIds,
    toggleRow,
    togglePage,
    clear,
    allPageSelected,
    somePageSelected,
    indeterminate,
    selectedCount: selectedIds.size,
  };
}
