import { api } from '@/lib/api';
import type {
  LocationOption,
  LocationStock,
  Paginated,
  StockFilters,
  StockKpis,
  StockRow,
} from './types';

export const stockApi = {
  list: (f: StockFilters) =>
    api.get<Paginated<StockRow>>('/stock', { params: f }).then((r) => r.data),
  alerts: () => api.get<StockRow[]>('/stock/alerts').then((r) => r.data),
  kpis: () => api.get<StockKpis>('/stock/kpis').then((r) => r.data),
  locations: () => api.get<LocationOption[]>('/stock/locations').then((r) => r.data),
  productLocations: (productId: string) =>
    api.get<LocationStock[]>(`/stock/${productId}/locations`).then((r) => r.data),
};
