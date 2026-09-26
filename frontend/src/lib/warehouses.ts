import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export interface Location {
  id: string;
  name: string;
  type: string;
  warehouseId: string;
}

export interface Warehouse {
  id: string;
  name: string;
  address?: string;
  locations: Location[];
}

export async function getWarehouses(): Promise<Warehouse[]> {
  const res = await api.get<Warehouse[]>('/warehouses');
  return res.data;
}

// Warehouse/location structure rarely changes during a session.
export const useWarehouses = () =>
  useQuery({
    queryKey: ['warehouses'],
    queryFn: getWarehouses,
    staleTime: 60_000,
  });
