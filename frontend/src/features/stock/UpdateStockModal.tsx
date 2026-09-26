import { useState, type FormEvent } from 'react';
import { FormField, Modal, SelectField } from '@/components/ui';
import { formatQty } from './format';
import { useAdjustStock, useLocations, useProductLocations } from './hooks';
import { StockPage } from './StockPage';
import type { StockRow } from './types';

const hasAtMost3Decimals = (n: number) => Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6;

export function UpdateStockModal({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const locations = useLocations();
  const current = useProductLocations(row.id);
  const adjust = useAdjustStock();
  const [locationId, setLocationId] = useState('');
  const [counted, setCounted] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recorded = current.data?.find((l) => l.locationId === locationId)?.qty ?? 0;
  const countedQty = Number(counted);
  const valid = counted !== '' && Number.isFinite(countedQty) && countedQty >= 0 && hasAtMost3Decimals(countedQty);
  const diff = valid ? countedQty - recorded : null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!locationId) return setError('Pick a location');
    if (!valid) return setError('Enter a counted quantity of 0 or more, with at most 3 decimals');
    setError(null);
    try {
      await adjust.mutateAsync({ locationId, productId: row.id, countedQty });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Modal open title={`Update stock — ${row.name}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <SelectField
          label="Location"
          placeholder="Choose a location"
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          options={(locations.data ?? []).map((l) => {
            const qty = current.data?.find((c) => c.locationId === l.id)?.qty ?? 0;
            return { value: l.id, label: `${l.warehouseName} / ${l.name} (${formatQty(qty)} ${row.uom})` };
          })}
        />
        <FormField
          label={`Counted quantity (${row.uom})`}
          type="number"
          step="0.001"
          min="0"
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
        />
        {locationId && diff !== null && (
          <p className="text-sm text-slate-600">
            Recorded {formatQty(recorded)} → counted {formatQty(countedQty)}:{' '}
            <strong className={diff < 0 ? 'text-red-600' : diff > 0 ? 'text-emerald-700' : undefined}>
              {diff > 0 ? '+' : ''}
              {formatQty(diff)} {row.uom}
            </strong>{' '}
            will be logged as an adjustment.
          </p>
        )}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={adjust.isPending || diff === 0}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {adjust.isPending ? 'Saving…' : 'Apply adjustment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** The Stock page with the "Update stock" row action enabled. */
export function StockPageWithAdjust() {
  const [row, setRow] = useState<StockRow | null>(null);
  return (
    <>
      <StockPage onUpdate={setRow} />
      {row && <UpdateStockModal row={row} onClose={() => setRow(null)} />}
    </>
  );
}
