import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { stockKeys } from '@/features/stock/hooks';
import type { StockFilters } from '@/features/stock/types';
import { categoriesApi, productsApi } from './api';
import type { ProductInput, ReorderRule } from './types';

export const productKeys = {
  all: ['products'] as const,
  list: (f: StockFilters) => ['products', 'list', f] as const,
  detail: (id: string) => ['products', 'detail', id] as const,
  categories: ['categories'] as const,
};

// Product changes affect every stock view, so refresh both families.
const refreshStock = (qc: QueryClient) => {
  qc.invalidateQueries({ queryKey: productKeys.all });
  qc.invalidateQueries({ queryKey: stockKeys.all });
};

export const useProducts = (f: StockFilters) =>
  useQuery({
    queryKey: productKeys.list(f),
    queryFn: () => productsApi.list(f),
    placeholderData: keepPreviousData,
  });

export const useProduct = (id: string | undefined) =>
  useQuery({
    queryKey: productKeys.detail(id ?? ''),
    queryFn: () => productsApi.get(id as string),
    enabled: Boolean(id),
  });

export const useCreateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProductInput) => productsApi.create(body),
    onSuccess: () => {
      refreshStock(qc);
      qc.invalidateQueries({ queryKey: productKeys.categories });
    },
  });
};

export const useUpdateProduct = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<ProductInput, 'initialStock'>) => productsApi.update(id, body),
    onSuccess: () => {
      refreshStock(qc);
      qc.invalidateQueries({ queryKey: productKeys.categories });
    },
  });
};

export const useArchiveProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => productsApi.archive(id),
    onSuccess: () => refreshStock(qc),
  });
};

export const useSetReorderRule = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rule: ReorderRule) => productsApi.setReorderRule(id, rule),
    onSuccess: () => refreshStock(qc),
  });
};

export const useRemoveReorderRule = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => productsApi.removeReorderRule(id),
    onSuccess: () => refreshStock(qc),
  });
};

export const useCategories = () =>
  useQuery({ queryKey: productKeys.categories, queryFn: categoriesApi.list });

const useCategoryMutation = <A,>(fn: (args: A) => Promise<unknown>) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.categories });
      refreshStock(qc);
    },
  });
};

export const useCreateCategory = () => useCategoryMutation((name: string) => categoriesApi.create(name));
export const useUpdateCategory = () =>
  useCategoryMutation(({ id, name }: { id: string; name: string }) => categoriesApi.update(id, name));
export const useDeleteCategory = () => useCategoryMutation((id: string) => categoriesApi.remove(id));
