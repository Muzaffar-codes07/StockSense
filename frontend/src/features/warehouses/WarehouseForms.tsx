import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ChevronRight, MapPin } from 'lucide-react';
import { Badge, Button, FormField, Notice, SelectField, SideSheet, useToast } from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  buildTree,
  flattenTree,
  LOCATION_TYPE_LABEL,
  LOCATION_TYPES,
  useCreateLocation,
  useCreateWarehouse,
  useUpdateWarehouse,
  type LocationNode,
  type LocationType,
  type Warehouse,
} from './api';

const WH_FORM = 'warehouse-form';
const LOC_FORM = 'location-form';

/** Create a warehouse, or edit one when `warehouse` is given. */
export function WarehouseSheet({ open, warehouse, onClose }: { open: boolean; warehouse?: Warehouse | null; onClose: () => void }) {
  const create = useCreateWarehouse();
  const update = useUpdateWarehouse();
  const toast = useToast();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [errors, setErrors] = useState<{ name?: string; form?: string }>({});

  useEffect(() => {
    if (!open) return;
    setName(warehouse?.name ?? '');
    setAddress(warehouse?.address ?? '');
    setErrors({});
  }, [open, warehouse]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setErrors({ name: 'Name must be at least 2 characters.' });
    setErrors({});
    const body = { name: name.trim(), address: address.trim() || undefined };
    try {
      if (warehouse) await update.mutateAsync({ id: warehouse.id, ...body });
      else await create.mutateAsync(body);
      toast.success(warehouse ? 'Warehouse updated' : 'Warehouse created', body.name);
      onClose();
    } catch (err) {
      setErrors({ form: (err as Error).message });
    }
  };

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      width="md"
      eyebrow="Settings · Warehouses"
      title={warehouse ? 'Edit warehouse' : 'New warehouse'}
      subtitle={warehouse ? 'Rename it or update its address.' : 'A site that holds stock. Add its locations next.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={WH_FORM} loading={create.isPending || update.isPending}>
            {warehouse ? 'Save changes' : 'Create warehouse'}
          </Button>
        </>
      }
    >
      <form id={WH_FORM} onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField label="Name" placeholder="e.g. Main Warehouse" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} data-autofocus />
        <FormField label="Address (optional)" placeholder="Street, city" value={address} onChange={(e) => setAddress(e.target.value)} />
        {!warehouse && (
          <p className="text-[12.5px] leading-5 text-ink-2">Warehouses can't be deleted from the app yet, so double-check the name before creating it.</p>
        )}
        {errors.form && <Notice tone="danger">{errors.form}</Notice>}
      </form>
    </SideSheet>
  );
}

/** Create a location inside a warehouse, optionally nested under another location. */
export function LocationSheet({
  open,
  warehouses,
  defaultWarehouseId,
  defaultParentId,
  onClose,
}: {
  open: boolean;
  warehouses: Warehouse[];
  defaultWarehouseId?: string;
  defaultParentId?: string;
  onClose: () => void;
}) {
  const create = useCreateLocation();
  const toast = useToast();
  const [warehouseId, setWarehouseId] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<LocationType>('STOCK');
  const [parentId, setParentId] = useState('');
  const [errors, setErrors] = useState<{ name?: string; warehouse?: string; form?: string }>({});

  useEffect(() => {
    if (!open) return;
    setWarehouseId(defaultWarehouseId ?? warehouses[0]?.id ?? '');
    setParentId(defaultParentId ?? '');
    setName('');
    setType(defaultParentId ? 'RACK' : 'STOCK');
    setErrors({});
  }, [open, defaultWarehouseId, defaultParentId, warehouses]);

  const parents = useMemo(() => flattenTree(buildTree(warehouses.find((w) => w.id === warehouseId)?.locations ?? [])), [warehouses, warehouseId]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!warehouseId) next.warehouse = 'Choose a warehouse.';
    if (!name.trim()) next.name = 'Name is required.';
    setErrors(next);
    if (next.name || next.warehouse) return;
    try {
      await create.mutateAsync({ warehouseId, name: name.trim(), type, parentId: parentId || undefined });
      toast.success('Location created', name.trim());
      onClose();
    } catch (err) {
      setErrors({ form: (err as Error).message });
    }
  };

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      width="md"
      eyebrow="Settings · Locations"
      title="New location"
      subtitle="Stock lives at locations. Nest racks and bins under a parent to mirror the floor."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={LOC_FORM} loading={create.isPending}>
            Create location
          </Button>
        </>
      }
    >
      <form id={LOC_FORM} onSubmit={onSubmit} className="space-y-4" noValidate>
        <SelectField
          label="Warehouse"
          value={warehouseId}
          onChange={(e) => {
            setWarehouseId(e.target.value);
            setParentId('');
          }}
          placeholder="Choose a warehouse"
          options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
          error={errors.warehouse}
        />
        <FormField label="Name" placeholder="e.g. Rack A-3" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} data-autofocus />
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-chocolate">Type</legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Location type">
            {LOCATION_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={type === t}
                onClick={() => setType(t)}
                className={cn(
                  'rounded-[12px] px-3 py-2.5 text-left ring-1 ring-inset transition-colors',
                  type === t ? 'bg-sienna/[0.06] ring-sienna/40' : 'bg-white ring-sienna/10 hover:ring-sienna/25',
                )}
              >
                <span className="block text-[13.5px] font-semibold text-ink">{LOCATION_TYPE_LABEL[t].label}</span>
                <span className="block text-[12px] text-ink-2">{LOCATION_TYPE_LABEL[t].hint}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <SelectField
          label="Parent location (optional)"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          placeholder="None — top level"
          options={parents.map((p) => ({ value: p.id, label: `${'— '.repeat(p.depth)}${p.name}` }))}
          hint={parents.length === 0 ? 'This warehouse has no locations yet.' : undefined}
        />
        {errors.form && <Notice tone="danger">{errors.form}</Notice>}
      </form>
    </SideSheet>
  );
}

/** Indented, keyboard-friendly view of a warehouse's location hierarchy. */
export function LocationTree({ nodes, onAddChild, compact }: { nodes: LocationNode[]; onAddChild?: (parent: LocationNode) => void; compact?: boolean }) {
  if (nodes.length === 0) return <p className="py-3 text-[13px] text-ink-2">No locations yet.</p>;
  return (
    <ul role="tree" className="space-y-0.5">
      {nodes.map((n) => (
        <TreeItem key={n.id} node={n} onAddChild={onAddChild} compact={compact} />
      ))}
    </ul>
  );
}

function TreeItem({ node, onAddChild, compact }: { node: LocationNode; onAddChild?: (parent: LocationNode) => void; compact?: boolean }) {
  return (
    <li role="treeitem" aria-expanded={node.children.length ? true : undefined} aria-level={node.depth + 1} aria-selected={false}>
      <div className={cn('group flex items-center gap-2 rounded-[10px] pr-2 hover:bg-dove/[0.12]', compact ? 'py-1.5' : 'py-2')} style={{ paddingLeft: 8 + node.depth * 20 }}>
        {node.depth > 0 ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden /> : <MapPin className="h-3.5 w-3.5 shrink-0 text-sienna" aria-hidden />}
        <span className={cn('min-w-0 flex-1 truncate text-[13.5px]', node.depth === 0 ? 'font-semibold text-ink' : 'text-ink')}>{node.name}</span>
        {onAddChild && (
          <button
            type="button"
            onClick={() => onAddChild(node)}
            className="rounded-full px-2 py-1 text-[12px] font-medium text-sienna opacity-0 transition-opacity hover:bg-sienna/[0.06] focus-visible:opacity-100 group-hover:opacity-100"
            aria-label={`Add a location inside ${node.name}`}
          >
            + Add inside
          </button>
        )}
        <Badge tone="neutral" dot={false}>
          {LOCATION_TYPE_LABEL[node.type]?.label ?? node.type}
        </Badge>
      </div>
      {node.children.length > 0 && (
        <ul role="group" className="space-y-0.5">
          {node.children.map((c) => (
            <TreeItem key={c.id} node={c} onAddChild={onAddChild} compact={compact} />
          ))}
        </ul>
      )}
    </li>
  );
}
