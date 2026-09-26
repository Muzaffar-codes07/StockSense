import { useState, useEffect, type FormEvent } from 'react';
import { Modal } from '../ui/Modal';
import {
  createTransfer,
  getLocations,
  getProductsList,
  LocationItem,
  ProductItem,
} from '../../lib/operations';
import { Plus, Trash2, ArrowRight } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface TransferLineState {
  productId: string;
  qty: number;
  fromLocationId: string;
  toLocationId: string;
}

export function CreateTransferModal({ open, onClose, onSuccess }: Props) {
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [lines, setLines] = useState<TransferLineState[]>([
    { productId: '', qty: 1, fromLocationId: '', toLocationId: '' },
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
        const fromLoc = locs[0]?.id ?? '';
        const toLoc = locs[1]?.id ?? locs[0]?.id ?? '';
        const prod = prods[0]?.id ?? '';
        setLines([{ productId: prod, qty: 1, fromLocationId: fromLoc, toLocationId: toLoc }]);
      });
    }
  }, [open]);

  const addLine = () => {
    const defaultProduct = products[0]?.id ?? '';
    const fromLoc = locations[0]?.id ?? '';
    const toLoc = locations[1]?.id ?? locations[0]?.id ?? '';
    setLines([...lines, { productId: defaultProduct, qty: 1, fromLocationId: fromLoc, toLocationId: toLoc }]);
  };

  const removeLine = (index: number) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof TransferLineState, value: string | number) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.productId || line.qty <= 0 || !line.fromLocationId || !line.toLocationId) {
        setError(`Please fill all fields on line #${i + 1}`);
        return;
      }
      if (line.fromLocationId === line.toLocationId) {
        setError(`Line #${i + 1}: Source and destination locations cannot be the same`);
        return;
      }
    }

    setLoading(true);
    try {
      await createTransfer({
        lines: lines.map((l) => ({
          productId: l.productId,
          qty: Number(l.qty),
          fromLocationId: l.fromLocationId,
          toLocationId: l.toLocationId,
        })),
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create internal transfer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} title="Create Internal Transfer" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200">
            {error}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600 uppercase">Movement Lines</span>
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              <Plus className="w-3.5 h-3.5" /> Add Line
            </button>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {lines.map((line, idx) => {
              const selectedProd = products.find((p) => p.id === line.productId);
              return (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Product</label>
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
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Quantity ({selectedProd?.uom ?? 'qty'})</label>
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

                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      disabled={lines.length === 1}
                      className="text-slate-400 hover:text-rose-600 disabled:opacity-30 p-1 self-end mb-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                    <div className="flex-1">
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">From Location</label>
                      <select
                        value={line.fromLocationId}
                        onChange={(e) => updateLine(idx, 'fromLocationId', e.target.value)}
                        className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none bg-white"
                        required
                      >
                        <option value="">Source...</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.warehouse?.name ? `${loc.warehouse.name} - ` : ''}
                            {loc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <ArrowRight className="w-4 h-4 text-slate-400 mt-3 flex-shrink-0" />

                    <div className="flex-1">
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">To Location</label>
                      <select
                        value={line.toLocationId}
                        onChange={(e) => updateLine(idx, 'toLocationId', e.target.value)}
                        className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none bg-white"
                        required
                      >
                        <option value="">Destination...</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.warehouse?.name ? `${loc.warehouse.name} - ` : ''}
                            {loc.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
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
            {loading ? 'Creating...' : 'Create Transfer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
