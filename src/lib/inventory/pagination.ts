export type DatabasePage<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export const DATABASE_PAGE_SIZE = 1_000;

// Only use for immutable snapshots with a transactionally recorded row count.
// Mutable lists must keep using loadAllPages to avoid racing their pagination.
export async function loadSnapshotPages<T>(
  loadPage: (from: number, to: number) => PromiseLike<DatabasePage<T>>,
  totalRows: number,
  pageSize = DATABASE_PAGE_SIZE,
) {
  if (!Number.isSafeInteger(totalRows) || totalRows < 0 || !Number.isSafeInteger(pageSize) || pageSize < 1) {
    throw new Error("Conteo de carga inválido.");
  }
  const rows: T[] = [];
  for (let first = 0; first < totalRows; first += pageSize * 3) {
    const starts = Array.from({ length: Math.min(3, Math.ceil((totalRows - first) / pageSize)) }, (_, index) => first + index * pageSize);
    const pages = await Promise.all(starts.map((from) => loadPage(from, Math.min(totalRows, from + pageSize) - 1)));
    for (const [index, page] of pages.entries()) {
      if (page.error) throw new Error(page.error.message);
      if (page.data?.length !== Math.min(pageSize, totalRows - starts[index])) {
        throw new Error("La carga histórica está incompleta. Intenta consultar nuevamente.");
      }
      rows.push(...page.data);
    }
  }
  return rows;
}

export async function loadAllPages<T>(
  loadPage: (from: number, to: number) => PromiseLike<DatabasePage<T>>,
  pageSize = DATABASE_PAGE_SIZE,
) {
  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const page = await loadPage(from, from + pageSize - 1);
    if (page.error) throw new Error(page.error.message);

    const pageRows = page.data ?? [];
    rows.push(...pageRows);

    if (pageRows.length < pageSize) return rows;
  }
}
