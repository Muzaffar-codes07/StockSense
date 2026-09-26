import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { stockKeys } from '@/features/stock/hooks';
import type { CurrentUser } from '@/lib/auth';

// Mirrors backend/prisma/schema.prisma (Warehouse, Location, LocationType).
export const LOCATION_TYPES = ['STOCK', 'PRODUCTION', 'RACK', 'TRANSIT'] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export const LOCATION_TYPE_LABEL: Record<LocationType, { label: string; hint: string }> = {
  STOCK: { label: 'Stock', hint: 'Main storage area' },
  PRODUCTION: { label: 'Production', hint: 'Consumed or produced on the floor' },
  RACK: { label: 'Rack', hint: 'A shelf or bin inside a stock area' },
  TRANSIT: { label: 'Transit', hint: 'Goods on the move between sites' },
};

export type Location = {
  id: string;
  warehouseId: string;
  name: string;
  type: LocationType;
  parentId: string | null;
};

export type Warehouse = {
  id: string;
  name: string;
  address: string | null;
  locations: Location[];
};

export const warehousesApi = {
  list: () => api.get<Warehouse[]>('/warehouses').then((r) => r.data),
  create: (body: { name: string; address?: string }) => api.post<Warehouse>('/warehouses', body).then((r) => r.data),
  update: (id: string, body: { name?: string; address?: string }) => api.patch<Warehouse>(`/warehouses/${id}`, body).then((r) => r.data),
  createLocation: (body: { warehouseId: string; name: string; type: LocationType; parentId?: string }) =>
    api.post<Location>('/locations', body).then((r) => r.data),
};

export const warehouseKeys = { all: ['warehouses'] as const };

export const useWarehouses = () => useQuery({ queryKey: warehouseKeys.all, queryFn: warehousesApi.list, staleTime: 30_000 });

function useWarehouseMutation<A>(fn: (a: A) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warehouseKeys.all });
      qc.invalidateQueries({ queryKey: ['locations'] });
      qc.invalidateQueries({ queryKey: stockKeys.locations });
    },
  });
}

export const useCreateWarehouse = () => useWarehouseMutation(warehousesApi.create);
export const useUpdateWarehouse = () =>
  useWarehouseMutation(({ id, ...body }: { id: string; name?: string; address?: string }) => warehousesApi.update(id, body));
export const useCreateLocation = () => useWarehouseMutation(warehousesApi.createLocation);

/** Whether the signed-in user may change warehouses (MANAGER or ADMIN on the API). */
export function useCanManage() {
  const qc = useQueryClient();
  const role = qc.getQueryData<CurrentUser>(['auth', 'me'])?.role;
  return role === undefined || role === 'ADMIN' || role === 'MANAGER';
}

export interface LocationNode extends Location {
  children: LocationNode[];
  depth: number;
}

/** Flat locations → nested tree (parentId), sorted by name at every level. */
export function buildTree(locations: Location[]): LocationNode[] {
  const byId = new Map<string, LocationNode>();
  locations.forEach((l) => byId.set(l.id, { ...l, children: [], depth: 0 }));
  const roots: LocationNode[] = [];
  byId.forEach((n) => {
    const parent = n.parentId ? byId.get(n.parentId) : undefined;
    if (parent) parent.children.push(n);
    else roots.push(n);
  });
  const sortAndDepth = (nodes: LocationNode[], depth: number) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach((n) => {
      n.depth = depth;
      sortAndDepth(n.children, depth + 1);
    });
  };
  sortAndDepth(roots, 0);
  return roots;
}

/** Depth-first flattening, for indented pickers. */
export const flattenTree = (nodes: LocationNode[]): LocationNode[] => nodes.flatMap((n) => [n, ...flattenTree(n.children)]);
