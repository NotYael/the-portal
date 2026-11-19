/** The Data API returns at most 1,000 rows per request. */
export const PAGE_SIZE = 1000;

type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

/**
 * Every row of a query, one page at a time; null if any page fails. `page`
 * runs the query for rows from–to (inclusive, as in `.range`) and must order
 * on a unique key too, so pages never skip or repeat a row.
 */
export async function fetchAllPages<T>(page: (from: number, to: number) => Page<T>, size = PAGE_SIZE): Promise<T[] | null> {
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error || !data) return null;
    rows.push(...data);
    if (data.length < size) return rows;
  }
}
