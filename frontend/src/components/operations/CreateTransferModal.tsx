import { useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { Modal, Notice } from '@/components/ui';
import { createTransfer } from '@/lib/operations';
import { DialogFooter, FieldLabel, LineCard, LinesHeader, locationOptions, miniControl, NativeSelect, productOptions, useDocFormData } from './parts';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface TransferLineState {
  productId: string;
  qty: string;
  fromLocationId: string;
  toLocationId: string;
}

const FORM_ID = 'create-transfer-form';

export function CreateTransferModal({ open, onClose, onSuccess }: Props) {
  const [lines, setLines] = useState<TransferLineState[]>([{ productId: '', qty: '1', fromLocationId: '', toLocationId: '' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blankLine = (d: { products: { id: string }[]; locations: { id: string }[] }): TransferLineState => ({
    productId: d.products[0]?.id ?? '',
    qty: '1',
    fromLocationId: d.locations[0]?.id ?? '',
    toLocationId: d.locations[1]?.id ?? d.locations[0]?.id ?? '',
  });

  const data = useDocFormData(open, undefined, (d) => {
    setError(null);
    setLines([blankLine(d)]);
  });

  const updateLine = (index: number, patch: Partial<TransferLineState>) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.productId || !(Number(line.qty) > 0) || !line.fromLocationId || !line.toLocationId) {
        return setError(`Line ${i + 1}: choose a product, a quantity above 0, and both locations.`);
      }
      if (line.fromLocationId === line.toLocationId) {
        return setError(`Line ${i + 1}: the source and destination must be different locations.`);
      }
    }

    setLoading(true);
    try {
      await createTransfer({
        lines: lines.map((l) => ({ productId: l.productId, qty: Number(l.qty), fromLocationId: l.fromLocationId, toLocationId: l.toLocationId })),
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create internal transfer');
    } finally {
      setLoading(false);
    }
  };

  const locOpts = locationOptions(data.locations);

  return (
    <Modal
      open={open}
      title="New transfer"
      description="Move stock between locations. Total company stock stays the same."
      onClose={onClose}
      size="xl"
      footer={<DialogFooter formId={FORM_ID} submitLabel="Create transfer" loading={loading} onCancel={onClose} />}
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-5" noValidate>
        {data.locations.length === 1 && <Notice tone="warning">Only one location exists. Add another under Warehouses to transfer between them.</Notice>}
        <div>
          <LinesHeader
            title="Moves"
            hint="Each line moves one product from a location to another."
            onAdd={() => setLines((prev) => [...prev, blankLine(data)])}
            disabled={data.products.length === 0}
          />
          <div className="scroll-quiet max-h-80 space-y-2 overflow-y-auto">
            {lines.map((line, idx) => {
              const uom = data.products.find((p) => p.id === line.productId)?.uom ?? 'unit';
              const same = line.fromLocationId && line.fromLocationId === line.toLocationId;
              return (
                <LineCard key={idx} index={idx} canRemove={lines.length > 1} onRemove={() => setLines((prev) => prev.filter((_, i) => i !== idx))}>
                  <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
                    <div>
                      <FieldLabel htmlFor={`${FORM_ID}-p${idx}`}>Product</FieldLabel>
                      <NativeSelect id={`${FORM_ID}-p${idx}`} value={line.productId} onChange={(v) => updateLine(idx, { productId: v })} placeholder="Select product…" options={productOptions(data.products)} />
                    </div>
                    <div>
                      <FieldLabel htmlFor={`${FORM_ID}-q${idx}`}>Quantity</FieldLabel>
                      <div className="relative">
                        <input
                          id={`${FORM_ID}-q${idx}`}
                          type="number"
                          step="any"
                          min="0.001"
                          inputMode="decimal"
                          value={line.qty}
                          onChange={(e) => updateLine(idx, { qty: e.target.value })}
                          className={`${miniControl} tabular pr-11`}
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12px] text-ink-2">{uom}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 grid items-end gap-2 sm:grid-cols-[1fr_28px_1fr]">
                    <div>
                      <FieldLabel htmlFor={`${FORM_ID}-f${idx}`}>From</FieldLabel>
                      <NativeSelect id={`${FORM_ID}-f${idx}`} value={line.fromLocationId} onChange={(v) => updateLine(idx, { fromLocationId: v })} placeholder="Source…" options={locOpts} />
                    </div>
                    <span className="hidden h-10 items-center justify-center text-sienna sm:flex" aria-hidden>
                      <ArrowRight className="h-4 w-4" />
                    </span>
                    <div>
                      <FieldLabel htmlFor={`${FORM_ID}-t${idx}`}>To</FieldLabel>
                      <NativeSelect
                        id={`${FORM_ID}-t${idx}`}
                        value={line.toLocationId}
                        onChange={(v) => updateLine(idx, { toLocationId: v })}
                        placeholder="Destination…"
                        options={locOpts}
                        className={same ? 'border-danger/50' : undefined}
                      />
                    </div>
                  </div>
                  {same && <p className="mt-1.5 text-[12px] font-medium text-danger-fg">Pick a different destination.</p>}
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
