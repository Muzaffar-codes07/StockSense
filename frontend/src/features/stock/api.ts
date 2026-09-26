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
  /**
   * Counts one product at one location via Role 4's adjustment document:
   * create (server computes recorded qty + diff from the ledger), then validate
   * (posts the diff through postMove).
   */
  adjustStock: async (body: { locationId: string; productId: string; countedQty: number }) => {
    const { data } = await api.post<{ id: string }>('/operations/adjustments', {
      locationId: body.locationId,
      lines: [{ productId: body.productId, countedQty: body.countedQty }],
    });
    return api.post(`/operations/adjustments/${data.id}/validate`).then((r) => r.data);
  },
};
