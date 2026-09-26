import { useState, type FormEvent } from 'react';
import { Modal, Notice } from '@/components/ui';
import { cn } from '@/lib/cn';
import { createAdjustment } from '@/lib/operations';
import { stockApi } from '@/features/stock/api';
import { DialogFooter, FieldLabel, LineCard, LinesHeader, locationOptions, miniControl, NativeSelect, productOptions, useDocFormData } from './parts';

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

const FORM_ID = 'create-adjustment-form';

export function CreateAdjustmentModal({ open, onClose, onSuccess }: Props) {
  const [locationId, setLocationId] = useState('');
  const [lines, setLines] = useState<AdjustmentLineState[]>([{ productId: '', countedQty: 0, recordedQty: 0 }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateLine = (index: number, patch: Partial<AdjustmentLineState>) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const fetchStockOnHand = async (productId: string, locId: string, lineIndex: number) => {
    if (!productId || !locId) return;
    try {
      // Ledger on-hand per location (Role 3's stock API); none recorded here = 0.
      const perLocation = await stockApi.productLocations(productId);
      const here = perLocation.find((l) => l.locationId === locId);
      updateLine(lineIndex, { recordedQty: here?.qty ?? 0 });
    } catch {
      // If stock can't be fetched, default recorded to 0 rather than block.
      updateLine(lineIndex, { recordedQty: 0 });
    }
  };

  const data = useDocFormData(open, undefined, (d) => {
    setError(null);
    const loc = d.locations[0]?.id ?? '';
    const prod = d.products[0]?.id ?? '';
    setLocationId(loc);
    setLines([{ productId: prod, countedQty: 0, recordedQty: 0 }]);
    if (prod && loc) fetchStockOnHand(prod, loc, 0);
  });

  const addLine = () => {
    const defaultProduct = data.products[0]?.id ?? '';
    const newIdx = lines.length;
    setLines((prev) => [...prev, { productId: defaultProduct, countedQty: 0, recordedQty: 0 }]);
    if (defaultProduct && locationId) fetchStockOnHand(defaultProduct, locationId, newIdx);
  };

  const handleProductChange = (index: number, prodId: string) => {
    updateLine(index, { productId: prodId });
    if (locationId) fetchStockOnHand(prodId, locationId, index);
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
    if (!locationId) return setError('Choose the location that was counted.');
    const validLines = lines.filter((l) => l.productId);
    if (validLines.length === 0) return setError('Add at least one counted product.');

    setLoading(true);
    try {
      await createAdjustment({
        // recordedQty is left to the server, which reads it from the ledger,
        // so the posted diff never comes from a stale screen.
        locationId,
        lines: validLines.map((l) => ({ productId: l.productId, countedQty: Number(l.countedQty) })),
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create inventory adjustment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      title="New adjustment"
      description="Record a physical count. Recorded quantities come from the ledger; validating posts the difference."
      onClose={onClose}
      size="xl"
      footer={<DialogFooter formId={FORM_ID} submitLabel="Create adjustment" loading={loading} onCancel={onClose} />}
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="max-w-sm">
          <FieldLabel htmlFor={`${FORM_ID}-location`}>Location counted</FieldLabel>
          <NativeSelect id={`${FORM_ID}-location`} value={locationId} onChange={handleLocationChange} placeholder="Select location" options={locationOptions(data.locations)} />
        </div>

        <div>
          <LinesHeader title="Counted products" onAdd={addLine} disabled={data.products.length === 0} />
          <div className="scroll-quiet max-h-80 space-y-2 overflow-y-auto">
            {lines.map((line, idx) => {
              const diff = Number(line.countedQty) - Number(line.recordedQty);
              const uom = data.products.find((p) => p.id === line.productId)?.uom ?? '';
              return (
                <LineCard key={idx} index={idx} canRemove={lines.length > 1} onRemove={() => setLines((prev) => prev.filter((_, i) => i !== idx))}>
                  <div className="grid gap-2 sm:grid-cols-[1fr_100px_100px_104px]">
                    <div>
                      <FieldLabel htmlFor={`${FORM_ID}-p${idx}`}>Product</FieldLabel>
                      <NativeSelect id={`${FORM_ID}-p${idx}`} value={line.productId} onChange={(v) => handleProductChange(idx, v)} placeholder="Select product…" options={productOptions(data.products)} />
                    </div>
                    <div>
                      <FieldLabel htmlFor={`${FORM_ID}-r${idx}`}>Recorded</FieldLabel>
                      <input
                        id={`${FORM_ID}-r${idx}`}
                        type="number"
                        value={line.recordedQty}
                        readOnly
                        aria-label="Recorded quantity"
                        title="From the stock ledger"
                        className={cn(miniControl, 'tabular')}
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor={`${FORM_ID}-c${idx}`}>Counted</FieldLabel>
                      <input
                        id={`${FORM_ID}-c${idx}`}
                        type="number"
                        step="any"
                        min="0"
                        inputMode="decimal"
                        value={line.countedQty}
                        onChange={(e) => updateLine(idx, { countedQty: parseFloat(e.target.value) || 0 })}
                        className={cn(miniControl, 'tabular')}
                      />
                    </div>
                    <div>
                      <span className="mb-1 block text-[12px] font-medium text-ink-2">Difference</span>
                      <span
                        className={cn(
                          'tabular flex h-10 items-center justify-center rounded-[10px] text-[13.5px] font-semibold',
                          diff > 0 ? 'bg-success/10 text-success-fg' : diff < 0 ? 'bg-danger/10 text-danger-fg' : 'bg-white text-ink-2',
                        )}
                        aria-live="polite"
                      >
                        {diff > 0 ? `+${diff}` : `${diff}`} {uom}
                      </span>
                    </div>
                  </div>
                </LineCard>
              );
            })}
          </div>
        </div>
        {error && <Notice tone="danger">{error}</Notice>}
      </form>
    </Modal>
  );
}
