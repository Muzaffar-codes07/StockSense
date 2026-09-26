import { useState, useEffect, type FormEvent } from 'react';
import { Modal } from '../ui/Modal';
import {
  createDelivery,
  getPartners,
  getLocations,
  getProductsList,
  Partner,
  LocationItem,
  ProductItem,
} from '../../lib/operations';
import { Plus, Trash2 } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface LineState {
  productId: string;
  qty: number;
}

export function CreateDeliveryModal({ open, onClose, onSuccess }: Props) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [partnerId, setPartnerId] = useState('');
  const [sourceLocationId, setSourceLocationId] = useState('');
  const [lines, setLines] = useState<LineState[]>([{ productId: '', qty: 1 }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setPartnerId('');
      setSourceLocationId('');
      setLines([{ productId: '', qty: 1 }]);
      Promise.all([
        getPartners('CUSTOMER').catch(() => []),
        getLocations().catch(() => []),
        getProductsList().catch(() => []),
      ]).then(([pts, locs, prods]) => {
        setPartners(pts);
        setLocations(locs);
        setProducts(prods);
        if (locs.length > 0) setSourceLocationId(locs[0].id);
        if (prods.length > 0) setLines([{ productId: prods[0].id, qty: 1 }]);
      });
    }
  }, [open]);

  const addLine = () => {
    const defaultProduct = products[0]?.id ?? '';
    setLines([...lines, { productId: defaultProduct, qty: 1 }]);
  };

  const removeLine = (index: number) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof LineState, value: string | number) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const validLines = lines.filter((l) => l.productId && l.qty > 0);
    if (validLines.length === 0) {
      setError('Please add at least one line item with a valid product and quantity');
      return;
    }

    setLoading(true);
    try {
      await createDelivery({
        partnerId: partnerId || undefined,
        sourceLocationId: sourceLocationId || undefined,
        lines: validLines.map((l) => ({ productId: l.productId, qty: Number(l.qty) })),
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create delivery order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} title="Create Delivery Order" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
              Customer / Destination Partner
            </label>
            <select
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none bg-white"
            >
              <option value="">Select Customer (Optional)</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
              Source Location (Pick from)
            </label>
            <select
              value={sourceLocationId}
              onChange={(e) => setSourceLocationId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none bg-white"
            >
              <option value="">Select Source Location</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.warehouse?.name ? `${loc.warehouse.name} - ` : ''}
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600 uppercase">Items to Pick & Pack</span>
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
              const selectedProd = products.find((p) => p.id === line.productId);
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200"
                >
                  <div className="flex-1">
                    <select
                      value={line.productId}
                      onChange={(e) => updateLine(idx, 'productId', e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none bg-white"
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

                  <div className="w-24">
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      value={line.qty}
                      onChange={(e) => updateLine(idx, 'qty', parseFloat(e.target.value) || 0)}
                      placeholder="Qty"
                      className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none bg-white"
                      required
                    />
                  </div>

                  <div className="w-12 text-xs text-slate-500 font-medium truncate">
                    {selectedProd?.uom ?? 'unit'}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    disabled={lines.length === 1}
                    className="text-slate-400 hover:text-rose-600 disabled:opacity-30 p-1"
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
            {loading ? 'Creating...' : 'Create Delivery Order'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
