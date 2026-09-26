import { useState, type FormEvent } from 'react';
import { Button, FormField, Modal, Notice, SelectField, useToast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatQty } from './format';
import { useAdjustStock, useLocations, useProductLocations } from './hooks';
import { StockPage } from './StockPage';
import type { StockRow } from './types';

const hasAtMost3Decimals = (n: number) => Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6;
const FORM_ID = 'update-stock-form';

export function UpdateStockModal({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const locations = useLocations();
  const current = useProductLocations(row.id);
  const adjust = useAdjustStock();
  const toast = useToast();
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
      toast.success('Stock updated', `${row.name}: ${diff! > 0 ? '+' : ''}${formatQty(diff!)} ${row.uom} logged as an adjustment.`);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Modal
      open
      title={`Update stock — ${row.name}`}
      description="Record a physical count. The difference is posted to the ledger as an adjustment."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} loading={adjust.isPending} disabled={diff === 0}>
            Apply adjustment
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={onSubmit} className="space-y-4" noValidate>
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
          label="Counted quantity"
          type="number"
          step="0.001"
          min="0"
          inputMode="decimal"
          suffix={row.uom}
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
          data-autofocus
        />
        {locationId && (
          <dl className="grid grid-cols-3 gap-2 rounded-card-sm bg-canvas p-4 text-center">
            <CountCell label="Recorded" value={`${formatQty(recorded)} ${row.uom}`} />
            <CountCell label="Counted" value={valid ? `${formatQty(countedQty)} ${row.uom}` : '—'} />
            <CountCell
              label="Difference"
              value={diff === null ? '—' : `${diff > 0 ? '+' : ''}${formatQty(diff)} ${row.uom}`}
              tone={diff === null || diff === 0 ? undefined : diff > 0 ? 'text-success-fg' : 'text-danger-fg'}
            />
          </dl>
        )}
        {diff === 0 && <p className="text-[12.5px] text-ink-2">The count matches what's recorded — nothing to adjust.</p>}
        {error && <Notice tone="danger">{error}</Notice>}
      </form>
    </Modal>
  );
}

function CountCell({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="text-[12px] font-medium text-ink-2">{label}</dt>
      <dd className={cn('tabular mt-1 text-[16px] font-bold text-ink', tone)}>{value}</dd>
    </div>
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
