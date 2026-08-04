export type DatabasePage<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export const DATABASE_PAGE_SIZE = 1_000;

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
