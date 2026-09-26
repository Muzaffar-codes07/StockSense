import { useEffect, useState, type ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, IconButton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import { getLocations, getPartners, getProductsList, type LocationItem, type Partner, type ProductItem } from '@/lib/operations';

/*
 * Shared building blocks for the create-document dialogs. They load their own
 * reference data with plain promises (no query client), so each dialog also
 * works standalone — e.g. in unit tests.
 */

export const locLabel = (loc: LocationItem) => (loc.warehouse?.name ? `${loc.warehouse.name} / ${loc.name}` : loc.name);

export const miniControl =
  'h-10 w-full rounded-[10px] border border-sienna/10 bg-white px-3 text-[13.5px] text-ink placeholder:text-ink-3 transition-[border-color,box-shadow] ' +
  'hover:border-sienna/20 focus:border-sienna/35 focus:outline-none focus:ring-4 focus:ring-sienna/10 read-only:bg-canvas read-only:text-ink-2';

/** /locations returns bare rows; label them with their warehouse where we can. */
async function warehouseNames(): Promise<Record<string, string>> {
  try {
    const res = await api.get<Array<{ id: string; name: string }>>('/warehouses');
    return Object.fromEntries((Array.isArray(res?.data) ? res.data : []).map((w) => [w.id, w.name]));
  } catch {
    return {};
  }
}

export interface DocFormData {
  partners: Partner[];
  locations: LocationItem[];
  products: ProductItem[];
  loading: boolean;
}

/** Partners (optional), locations and products for a create dialog, loaded when it opens. */
export function useDocFormData(open: boolean, partnerType?: 'SUPPLIER' | 'CUSTOMER', onLoaded?: (d: DocFormData) => void): DocFormData {
  const [data, setData] = useState<DocFormData>({ partners: [], locations: [], products: [], loading: true });
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setData((d) => ({ ...d, loading: true }));
    Promise.all([
      partnerType ? getPartners(partnerType).catch(() => [] as Partner[]) : Promise.resolve([] as Partner[]),
      getLocations().catch(() => [] as LocationItem[]),
      getProductsList().catch(() => [] as ProductItem[]),
      warehouseNames(),
    ]).then(([partners, locations, products, names]) => {
      if (!alive) return;
      const next = {
        partners: Array.isArray(partners) ? partners : [],
        locations: (Array.isArray(locations) ? locations : []).map((l) =>
          l.warehouse || !names[l.warehouseId] ? l : { ...l, warehouse: { id: l.warehouseId, name: names[l.warehouseId] } },
        ),
        products: Array.isArray(products) ? products : [],
        loading: false,
      };
      setData(next);
      onLoaded?.(next);
    });
    return () => {
      alive = false;
    };
    // onLoaded is a setup callback; re-running on its identity would reset the form.
  }, [open, partnerType]);
  return data;
}

export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-[12px] font-medium text-ink-2">
      {children}
    </label>
  );
}

export function NativeSelect({
  value,
  onChange,
  placeholder,
  options,
  className,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  options: Array<{ value: string; label: string }>;
  className?: string;
  id?: string;
  required?: boolean;
  'aria-label'?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={cn(miniControl, 'cursor-pointer pr-8', className)} {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function LinesHeader({ title, hint, onAdd, disabled }: { title: string; hint?: string; onAdd: () => void; disabled?: boolean }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <p className="text-[13.5px] font-semibold text-ink">{title}</p>
        {hint && <p className="text-[12px] text-ink-2">{hint}</p>}
      </div>
      <Button variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={onAdd} disabled={disabled}>
        Add product
      </Button>
    </div>
  );
}

export function LineCard({ children, index, onRemove, canRemove }: { children: ReactNode; index: number; onRemove: () => void; canRemove: boolean }) {
  return (
    <div className="flex items-start gap-2 rounded-card-sm bg-canvas p-3">
      <span className="tabular mt-[30px] w-5 shrink-0 text-center text-[12px] font-semibold text-ink-3" aria-hidden>
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
      <IconButton tone="plain" size="sm" label={`Remove line ${index + 1}`} onClick={onRemove} disabled={!canRemove} className="mt-[23px]">
        <Trash2 className="h-4 w-4" />
      </IconButton>
    </div>
  );
}

export const productOptions = (products: ProductItem[]) => products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }));
export const locationOptions = (locations: LocationItem[]) => locations.map((l) => ({ value: l.id, label: locLabel(l) }));

export function DialogFooter({ formId, submitLabel, loading, onCancel }: { formId: string; submitLabel: string; loading: boolean; onCancel: () => void }) {
  return (
    <>
      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" form={formId} loading={loading}>
        {submitLabel}
      </Button>
    </>
  );
}
