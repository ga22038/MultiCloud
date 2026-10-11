import { useState } from "react";

export function usePagination(total: number, resetKey: string) {
  const [selection, setSelection] = useState({
    page: 1,
    size: 5,
    key: resetKey,
  });
  const pages = Math.max(1, Math.ceil(total / selection.size));
  const page = selection.key === resetKey ? Math.min(selection.page, pages) : 1;
  return {
    total,
    page,
    pages,
    size: selection.size,
    start: (page - 1) * selection.size,
    end: page * selection.size,
    setPage: (next: number) =>
      setSelection({
        page: Math.max(1, Math.min(next, pages)),
        size: selection.size,
        key: resetKey,
      }),
    setSize: (size: number) => setSelection({ page: 1, size, key: resetKey }),
  };
}
