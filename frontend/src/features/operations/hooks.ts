import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getLocations,
  getMoveHistory,
  getOperationsKpiCounts,
  getPartners,
  getProductsList,
  type DocStatus,
  type MoveHistoryFilterParams,
  type OperationFilterParams,
} from '@/lib/operations';
import { stockKeys } from '@/features/stock/hooks';
import { OPERATIONS, type OperationKind } from './config';

export const opsKeys = {
  all: ['operations'] as const,
  list: (kind: OperationKind, f: OperationFilterParams) => ['operations', kind, 'list', f] as const,
  detail: (kind: OperationKind, id: string) => ['operations', kind, 'detail', id] as const,
  kpis: ['operations', 'kpi-counts'] as const,
  moves: (f: MoveHistoryFilterParams) => ['operations', 'moves', f] as const,
};

export const useOpsKpis = () => useQuery({ queryKey: opsKeys.kpis, queryFn: getOperationsKpiCounts });

export const useOperationList = (kind: OperationKind, f: OperationFilterParams, enabled = true) =>
  useQuery({
    queryKey: opsKeys.list(kind, f),
    queryFn: () => OPERATIONS[kind].list(f),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useOperation = (kind: OperationKind, id: string | null) =>
  useQuery({
    queryKey: opsKeys.detail(kind, id ?? ''),
    queryFn: () => OPERATIONS[kind].get(id as string),
    enabled: Boolean(id),
  });

export const useMoveHistory = (f: MoveHistoryFilterParams, enabled = true) =>
  useQuery({
    queryKey: opsKeys.moves(f),
    queryFn: () => getMoveHistory(f),
    placeholderData: keepPreviousData,
    enabled,
  });

export const usePartners = (type?: 'SUPPLIER' | 'CUSTOMER') =>
  useQuery({ queryKey: ['partners', type ?? 'all'], queryFn: () => getPartners(type), staleTime: 60_000 });

/** Flat location list with warehouse names (for pickers and filters). */
export const useLocationList = () =>
  useQuery({ queryKey: ['locations', 'all'], queryFn: () => getLocations(), staleTime: 60_000 });

export const useProductOptions = () =>
  useQuery({ queryKey: ['products', 'options'], queryFn: getProductsList, staleTime: 30_000 });

type Action = { type: 'status'; status: DocStatus } | { type: 'validate'; locationId?: string } | { type: 'cancel' };

/** Status / validate / cancel for any document type — refreshes stock too. */
export function useDocAction(kind: OperationKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: Action }) => {
      const cfg = OPERATIONS[kind];
      if (action.type === 'status') return cfg.setStatus(id, action.status);
      if (action.type === 'validate') return cfg.validate(id, action.locationId);
      return cfg.cancel(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: opsKeys.all });
      qc.invalidateQueries({ queryKey: stockKeys.all });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

/** Refresh everything a new document can affect. */
export function useRefreshOperations() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: opsKeys.all });
    qc.invalidateQueries({ queryKey: stockKeys.all });
  };
}
