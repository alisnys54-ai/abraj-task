export interface PaginationMeta {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export function buildPaginationMeta(page: number, pageSize: number, total: number): PaginationMeta {
  return { page, page_size: pageSize, total, total_pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export function paginationSkipTake(page: number, pageSize: number) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}
