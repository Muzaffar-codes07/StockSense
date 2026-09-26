import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { stockApi } from './api';
import type { StockFilters } from './types';

export const stockKeys = {
  all: ['stock'] as const,
  list: (f: StockFilters) => ['stock', 'list', f] as const,
  alerts: ['stock', 'alerts'] as const,
  kpis: ['stock', 'kpis'] as const,
  locations: ['stock', 'locations'] as const,
  productLocations: (id: string) => ['stock', 'product-locations', id] as const,
  breakdown: (id: string) => ['stock', 'breakdown', id] as const,
};

export const useStockList = (f: StockFilters) =>
  useQuery({
    queryKey: stockKeys.list(f),
    queryFn: () => stockApi.list(f),
    placeholderData: keepPreviousData,
  });

export const useStockAlerts = () =>
  useQuery({ queryKey: stockKeys.alerts, queryFn: stockApi.alerts });

/** Dashboard stock KPIs — Role 2 renders these on the Dashboard. */
export const useStockKpis = () =>
  useQuery({ queryKey: stockKeys.kpis, queryFn: stockApi.kpis });

export const useLocations = () =>
  useQuery({ queryKey: stockKeys.locations, queryFn: stockApi.locations, staleTime: 60_000 });

export const useProductLocations = (id: string | undefined) =>
  useQuery({
    queryKey: stockKeys.productLocations(id ?? ''),
    queryFn: () => stockApi.productLocations(id as string),
    enabled: Boolean(id),
  });

/** The parts behind a product's free-to-use and forecast figures. */
export const useStockBreakdown = (id: string | undefined) =>
  useQuery({
    queryKey: stockKeys.breakdown(id ?? ''),
    queryFn: () => stockApi.breakdown(id as string),
    enabled: Boolean(id),
  });

export const useAdjustStock = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: stockApi.adjustStock,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: stockKeys.all });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
};
