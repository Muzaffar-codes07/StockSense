import { useState, useEffect, type FormEvent } from 'react';
import { Modal } from '../ui/Modal';
import {
  createAdjustment,
  getLocations,
  getProductsList,
  LocationItem,
  ProductItem,
} from '../../lib/operations';
import { Plus, Trash2 } from 'lucide-react';
import { stockApi } from '../../features/stock/api';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface AdjustmentLineState {
  productId: string;
  countedQty: number;
  recordedQty: number;
}

export function CreateAdjustmentModal({ open, onClose, onSuccess }: Props) {
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [locationId, setLocationId] = useState('');
  const [lines, setLines] = useState<AdjustmentLineState[]>([
    { productId: '', countedQty: 0, recordedQty: 0 },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      Promise.all([
        getLocations().catch(() => []),
        getProductsList().catch(() => []),
      ]).then(([locs, prods]) => {
        setLocations(locs);
        setProducts(prods);
        const loc = locs[0]?.id ?? '';
        const prod = prods[0]?.id ?? '';
        setLocationId(loc);
        setLines([{ productId: prod, countedQty: 0, recordedQty: 0 }]);
        if (prod && loc) {
          fetchStockOnHand(prod, loc, 0);
        }
      });
    }
  }, [open]);

  const fetchStockOnHand = async (productId: string, locId: string, lineIndex: number) => {
    if (!productId || !locId) return;
    try {
      // Ledger on-hand per location (Role 3's stock API); none recorded here = 0.
      const perLocation = await stockApi.productLocations(productId);
      const here = perLocation.find((l) => l.locationId === locId);
      updateLine(lineIndex, 'recordedQty', here?.qty ?? 0);
    } catch {
      updateLine(lineIndex, 'recordedQty', 0);
    }
  };

  const addLine = () => {
    const defaultProduct = products[0]?.id ?? '';
    const newIdx = lines.length;
    setLines([...lines, { productId: defaultProduct, countedQty: 0, recordedQty: 0 }]);
    if (defaultProduct && locationId) {
      fetchStockOnHand(defaultProduct, locationId, newIdx);
    }
  };

  const removeLine = (index: number) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof AdjustmentLineState, value: any) => {
    setLines((prev) => {
      const newLines = [...prev];
      newLines[index] = { ...newLines[index], [field]: value };
      return newLines;
    });
  };

  const handleProductChange = (index: number, prodId: string) => {
    updateLine(index, 'productId', prodId);
    if (locationId) {
      fetchStockOnHand(prodId, locationId, index);
    }
  };

  const handleLocationChange = (locId: string) => {
    setLocationId(locId);
    lines.forEach((l, idx) => {
      if (l.productId) fetchStockOnHand(l.productId, locId, idx);
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!locationId) {
      setError('Please select a location for the adjustment count');
      return;
    }

    const validLines = lines.filter((l) => l.productId);
    if (validLines.length === 0) {
      setError('Please add at least one line item');
      return;
    }

    setLoading(true);
    try {
      await createAdjustment({
        locationId,
        // recordedQty is left to the server, which reads it from the ledger,
        // so the posted diff never comes from a stale screen.
        lines: validLines.map((l) => ({
          productId: l.productId,
          countedQty: Number(l.countedQty),
        })),
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create inventory adjustment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} title="New Inventory Adjustment" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
            Physical Location Counted
          </label>
          <select
            value={locationId}
            onChange={(e) => handleLocationChange(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none bg-white"
            required
          >
            <option value="">Select Location</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.warehouse?.name ? `${loc.warehouse.name} - ` : ''}
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600 uppercase">Counted Products</span>
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              <Plus className="w-3.5 h-3.5" /> Add Product
            </button>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {lines.map((line, idx) => {
              const diff = Number(line.countedQty) - Number(line.recordedQty);
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200"
                >
                  <div className="flex-1">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Product</label>
                    <select
                      value={line.productId}
                      onChange={(e) => handleProductChange(idx, e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:outline-none bg-white"
                      required
                    >
                      <option value="">Select product...</option>
                      {products.map((prod) => (
                        <option key={prod.id} value={prod.id}>
                          {prod.name} ({prod.sku})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-20">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Recorded</label>
                    <input
                      type="number"
                      value={line.recordedQty}
                      readOnly
                      aria-label="Recorded quantity"
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs bg-slate-100 text-slate-600"
                    />
                  </div>

                  <div className="w-20">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Counted</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={line.countedQty}
                      onChange={(e) => updateLine(idx, 'countedQty', parseFloat(e.target.value) || 0)}
                      placeholder="Count"
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:outline-none bg-white"
                      required
                    />
                  </div>

                  <div className="w-16 text-center">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Diff</label>
                    <span
                      className={`inline-block px-1.5 py-0.5 text-xs font-semibold rounded ${
                        diff > 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : diff < 0
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {diff > 0 ? `+${diff}` : `${diff}`}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    disabled={lines.length === 1}
                    className="text-slate-400 hover:text-rose-600 disabled:opacity-30 p-1 self-end mb-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Adjustment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
