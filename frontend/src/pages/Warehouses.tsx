import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, MapPin, Pencil, Plus, Rows3, Truck, Warehouse as WarehouseIcon } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorState, KpiCard, Menu, Notice, Skeleton, usePageMeta } from '@/components/ui';
import { buildTree, LOCATION_TYPE_LABEL, LOCATION_TYPES, useCanManage, useWarehouses, type LocationType, type Warehouse } from '@/features/warehouses/api';
import { LocationSheet, LocationTree, WarehouseSheet } from '@/features/warehouses/WarehouseForms';

export function Warehouses() {
  usePageMeta('Warehouses', 'Manage locations and stock distribution.');
  const warehouses = useWarehouses();
  const canManage = useCanManage();
  const [editing, setEditing] = useState<Warehouse | null | 'new'>(null);
  const [adding, setAdding] = useState<{ warehouseId?: string; parentId?: string } | null>(null);
  const list = Array.isArray(warehouses.data) ? warehouses.data : [];

  const totals = useMemo(() => {
    const all = list.flatMap((w) => w.locations ?? []);
    const byType = (t: LocationType) => all.filter((l) => l.type === t).length;
    return { locations: all.length, racks: byType('RACK'), transit: byType('TRANSIT') };
  }, [list]);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Warehouses" value={warehouses.data ? String(list.length) : '—'} icon={Building2} tone="dove" loading={warehouses.isLoading} />
        <KpiCard label="Locations" value={warehouses.data ? String(totals.locations) : '—'} icon={MapPin} tone="mist" loading={warehouses.isLoading} />
        <KpiCard label="Racks & bins" value={warehouses.data ? String(totals.racks) : '—'} icon={Rows3} tone="surface" loading={warehouses.isLoading} />
        <KpiCard label="Transit locations" value={warehouses.data ? String(totals.transit) : '—'} icon={Truck} tone="blush" loading={warehouses.isLoading} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-title text-ink">Sites</h2>
          <p className="mt-1 text-[13px] text-ink-2">Each warehouse and the locations nested inside it.</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" icon={<MapPin className="h-4 w-4" />} onClick={() => setAdding({})} disabled={list.length === 0}>
              New location
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
              New warehouse
            </Button>
          </div>
        )}
      </div>

      {!canManage && <Notice tone="info">Only managers can add or edit warehouses and locations.</Notice>}

      {warehouses.isError ? (
        <Card>
          <ErrorState message={warehouses.error.message} onRetry={() => warehouses.refetch()} />
        </Card>
      ) : warehouses.isLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-card" />
          <Skeleton className="h-72 rounded-card" />
        </div>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={WarehouseIcon}
            title="No warehouses yet"
            description="Create your first warehouse, then add the locations that hold stock."
            action={
              canManage && (
                <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
                  New warehouse
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {list.map((w) => (
            <WarehouseCard
              key={w.id}
              warehouse={w}
              canManage={canManage}
              onEdit={() => setEditing(w)}
              onAddLocation={(parentId) => setAdding({ warehouseId: w.id, parentId })}
            />
          ))}
        </div>
      )}

      <WarehouseSheet open={editing !== null} warehouse={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      <LocationSheet open={adding !== null} warehouses={list} defaultWarehouseId={adding?.warehouseId} defaultParentId={adding?.parentId} onClose={() => setAdding(null)} />
    </div>
  );
}

function WarehouseCard({
  warehouse,
  canManage,
  onEdit,
  onAddLocation,
}: {
  warehouse: Warehouse;
  canManage: boolean;
  onEdit: () => void;
  onAddLocation: (parentId?: string) => void;
}) {
  const locations = warehouse.locations ?? [];
  const tree = useMemo(() => buildTree(locations), [locations]);
  return (
    <Card className="flex flex-col">
      <div className="mb-5 flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-raspberry text-ondark" aria-hidden>
          <WarehouseIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[17px] font-semibold text-ink">{warehouse.name}</h3>
          <p className="truncate text-[13px] text-ink-2">{warehouse.address || 'No address on file'}</p>
        </div>
        {canManage && (
          <Menu
            label={`Actions for ${warehouse.name}`}
            items={[
              { label: 'Edit warehouse', icon: Pencil, onSelect: onEdit },
              { label: 'Add location', icon: Plus, onSelect: () => onAddLocation() },
            ]}
          />
        )}
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Badge tone="neutral" dot={false}>
          {locations.length} location{locations.length === 1 ? '' : 's'}
        </Badge>
        {LOCATION_TYPES.map((t) => {
          const n = locations.filter((l) => l.type === t).length;
          return n > 0 ? (
            <Badge key={t} tone="info" dot={false}>
              {n} {LOCATION_TYPE_LABEL[t].label.toLowerCase()}
            </Badge>
          ) : null;
        })}
      </div>
      <div className="scroll-quiet -mx-2 max-h-80 flex-1 overflow-y-auto rounded-card-sm bg-canvas/60 p-2">
        <LocationTree nodes={tree} compact onAddChild={canManage ? (n) => onAddLocation(n.id) : undefined} />
      </div>
      <div className="mt-4 flex justify-end">
        <Link to="/move-history" className="text-[13px] font-medium text-sienna hover:underline">
          Movement history
        </Link>
      </div>
    </Card>
  );
}
