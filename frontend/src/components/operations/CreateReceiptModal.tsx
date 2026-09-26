import { useState, type FormEvent } from 'react';
import { Modal, Notice } from '@/components/ui';
import { createDelivery, createReceipt } from '@/lib/operations';
import { DialogFooter, FieldLabel, LineCard, LinesHeader, locationOptions, miniControl, NativeSelect, productOptions, useDocFormData } from './parts';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface LineState {
  productId: string;
  qty: string;
}

type Kind = 'receipt' | 'delivery';

const COPY: Record<Kind, { title: string; description: string; partner: string; partnerPlaceholder: string; location: string; submit: string; failed: string }> = {
  receipt: {
    title: 'New receipt',
    description: 'Goods expected from a supplier. Stock is added when the receipt is validated.',
    partner: 'Supplier',
    partnerPlaceholder: 'No supplier',
    location: 'Receive into',
    submit: 'Create receipt',
    failed: 'Failed to create receipt',
  },
  delivery: {
    title: 'New delivery',
    description: 'Goods going to a customer. Stock is reserved while open and removed when validated.',
    partner: 'Customer',
    partnerPlaceholder: 'No customer',
    location: 'Ship from',
    submit: 'Create delivery',
    failed: 'Failed to create delivery order',
  },
};

/** Receipts and deliveries share one form: a partner, a location and product lines. */
function PartnerDocModal({ kind, open, onClose, onSuccess }: Props & { kind: Kind }) {
  const copy = COPY[kind];
  const formId = `create-${kind}-form`;
  const [partnerId, setPartnerId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [lines, setLines] = useState<LineState[]>([{ productId: '', qty: '1' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = useDocFormData(open, kind === 'receipt' ? 'SUPPLIER' : 'CUSTOMER', (d) => {
    setError(null);
    setPartnerId('');
    setLocationId(d.locations[0]?.id ?? '');
    setLines([{ productId: d.products[0]?.id ?? '', qty: '1' }]);
  });

  const updateLine = (index: number, patch: Partial<LineState>) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const validLines = lines.filter((l) => l.productId && Number(l.qty) > 0);
    if (validLines.length === 0) return setError('Add at least one product with a quantity above 0.');
    if (validLines.length !== lines.length) return setError('Every line needs a product and a quantity above 0.');

    setLoading(true);
    try {
      const payload = {
        partnerId: partnerId || undefined,
        lines: validLines.map((l) => ({ productId: l.productId, qty: Number(l.qty) })),
      };
      if (kind === 'receipt') await createReceipt({ ...payload, destinationLocationId: locationId || undefined });
      else await createDelivery({ ...payload, sourceLocationId: locationId || undefined });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : copy.failed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      title={copy.title}
      description={copy.description}
      onClose={onClose}
      size="lg"
      footer={<DialogFooter formId={formId} submitLabel={copy.submit} loading={loading} onCancel={onClose} />}
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor={`${formId}-partner`}>{copy.partner}</FieldLabel>
            <NativeSelect
              id={`${formId}-partner`}
              value={partnerId}
              onChange={setPartnerId}
              placeholder={copy.partnerPlaceholder}
              options={data.partners.map((p) => ({ value: p.id, label: p.name }))}
            />
          </div>
          <div>
            <FieldLabel htmlFor={`${formId}-location`}>{copy.location}</FieldLabel>
            <NativeSelect id={`${formId}-location`} value={locationId} onChange={setLocationId} placeholder="Choose later" options={locationOptions(data.locations)} />
          </div>
        </div>

        <div>
          <LinesHeader
            title="Products"
            hint={data.loading ? 'Loading products…' : data.products.length === 0 ? 'No products available yet.' : undefined}
            onAdd={() => setLines((prev) => [...prev, { productId: data.products[0]?.id ?? '', qty: '1' }])}
            disabled={data.products.length === 0}
          />
          <div className="scroll-quiet max-h-72 space-y-2 overflow-y-auto">
            {lines.map((line, idx) => {
              const uom = data.products.find((p) => p.id === line.productId)?.uom ?? 'unit';
              return (
                <LineCard key={idx} index={idx} canRemove={lines.length > 1} onRemove={() => setLines((prev) => prev.filter((_, i) => i !== idx))}>
                  <div className="grid gap-2 sm:grid-cols-[1fr_128px]">
                    <div>
                      <FieldLabel htmlFor={`${formId}-p${idx}`}>Product</FieldLabel>
                      <NativeSelect
                        id={`${formId}-p${idx}`}
                        value={line.productId}
                        onChange={(v) => updateLine(idx, { productId: v })}
                        placeholder="Select product…"
                        options={productOptions(data.products)}
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor={`${formId}-q${idx}`}>Quantity</FieldLabel>
                      <div className="relative">
                        <input
                          id={`${formId}-q${idx}`}
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

export function CreateReceiptModal(props: Props) {
  return <PartnerDocModal kind="receipt" {...props} />;
}

export function CreateDeliveryModal(props: Props) {
  return <PartnerDocModal kind="delivery" {...props} />;
}
