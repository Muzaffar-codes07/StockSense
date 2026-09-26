import { api } from '@/lib/api';
import type { Paginated, StockFilters, StockRow } from '@/features/stock/types';
import type { Category, ProductDetail, ProductInput, ReorderRule } from './types';

export const productsApi = {
  list: (f: StockFilters) =>
    api.get<Paginated<StockRow>>('/products', { params: f }).then((r) => r.data),
  get: (id: string) => api.get<ProductDetail>(`/products/${id}`).then((r) => r.data),
  create: (body: ProductInput) =>
    api.post<ProductDetail>('/products', body).then((r) => r.data),
  update: (id: string, body: Omit<ProductInput, 'initialStock'>) =>
    api.patch<ProductDetail>(`/products/${id}`, body).then((r) => r.data),
  archive: (id: string) => api.delete(`/products/${id}`).then(() => undefined),
  setReorderRule: (id: string, rule: ReorderRule) =>
    api.put<ReorderRule>(`/products/${id}/reorder-rule`, rule).then((r) => r.data),
  removeReorderRule: (id: string) =>
    api.delete(`/products/${id}/reorder-rule`).then(() => undefined),
};

export const categoriesApi = {
  list: () => api.get<Category[]>('/categories').then((r) => r.data),
  create: (name: string) => api.post('/categories', { name }).then((r) => r.data),
  update: (id: string, name: string) =>
    api.patch(`/categories/${id}`, { name }).then((r) => r.data),
  remove: (id: string) => api.delete(`/categories/${id}`).then(() => undefined),
};
