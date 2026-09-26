import { useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, Check, MapPin, Minus, Pencil, Plus } from 'lucide-react';
import { Avatar, Badge, Button, Card, CardHeader, ChipGroup, DetailRow, EmptyState, IconButton, Notice, SelectField, Table, usePageMeta, type Column } from '@/components/ui';
import { UOMS } from '@/features/products/types';
import { OPERATION_KINDS, OPERATIONS } from '@/features/operations/config';
import { buildTree, flattenTree, LOCATION_TYPE_LABEL, useCanManage, useWarehouses, type LocationNode, type Warehouse } from '@/features/warehouses/api';
import { LocationSheet, WarehouseSheet } from '@/features/warehouses/WarehouseForms';
import { ROLE_LABEL, type CurrentUser } from '@/lib/auth';

type Tab = 'locations' | 'workspace' | 'account';

export function Settings() {
  usePageMeta('Settings', 'Warehouses, locations and workspace preferences.');
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: Tab = raw === 'workspace' || raw === 'account' ? raw : 'locations';
  return (
    <div>
      <ChipGroup
        className="mb-6"
        label="Settings section"
        value={tab}
        onChange={(t) => setParams(t === 'locations' ? {} : { tab: t })}
        options={[
          { value: 'locations', label: 'Warehouses & locations' },
          { value: 'workspace', label: 'Workspace' },
          { value: 'account', label: 'Account' },
        ]}
      />
      {tab === 'locations' && <LocationSettings />}
      {tab === 'workspace' && <WorkspaceSettings />}
      {tab === 'account' && <AccountSettings />}
    </div>
  );
}

function LocationSettings() {
  const warehouses = useWarehouses();
  const canManage = useCanManage();
  const [editing, setEditing] = useState<Warehouse | null | 'new'>(null);
  const [adding, setAdding] = useState<{ warehouseId?: string; parentId?: string } | null>(null);
  const [filter, setFilter] = useState('');
  const list = Array.isArray(warehouses.data) ? warehouses.data : [];

  const rows = useMemo(
    () =>
      list
        .filter((w) => !filter || w.id === filter)
        .flatMap((w) => flattenTree(buildTree(w.locations ?? [])).map((n) => ({ ...n, warehouseName: w.name, parentName: w.locations.find((l) => l.id === n.parentId)?.name ?? null }))),
    [list, filter],
  );

  const whColumns: Column<Warehouse>[] = [
    {
      key: 'name',
      header: 'Warehouse',
      render: (w) => (
        <span>
          <span className="block font-semibold text-ink">{w.name}</span>
          <span className="block text-[12px] text-ink-2">{w.address || 'No address'}</span>
        </span>
      ),
    },
    { key: 'locations', header: 'Locations', align: 'right', render: (w) => <span className="tabular">{w.locations?.length ?? 0}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-24',
      render: (w) => (
        <span className="inline-flex gap-1">
          <IconButton tone="plain" size="sm" label={`Edit ${w.name}`} onClick={() => setEditing(w)} disabled={!canManage}>
            <Pencil className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton tone="plain" size="sm" label={`Add a location to ${w.name}`} onClick={() => setAdding({ warehouseId: w.id })} disabled={!canManage}>
            <Plus className="h-4 w-4" />
          </IconButton>
        </span>
      ),
    },
  ];

  type Row = LocationNode & { warehouseName: string; parentName: string | null };
  const locColumns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Location',
      render: (l) => (
        <span className="flex items-center gap-2" style={{ paddingLeft: l.depth * 18 }}>
          {l.depth > 0 && <span className="h-px w-3 bg-dove" aria-hidden />}
          <span className={l.depth === 0 ? 'font-semibold text-ink' : 'text-ink'}>{l.name}</span>
        </span>
      ),
    },
    { key: 'type', header: 'Type', render: (l) => <Badge tone="neutral" dot={false}>{LOCATION_TYPE_LABEL[l.type]?.label ?? l.type}</Badge> },
    { key: 'warehouseName', header: 'Warehouse', render: (l) => <span className="text-ink-2">{l.warehouseName}</span> },
    { key: 'parentName', header: 'Parent', hideOnMobile: true, render: (l) => <span className="text-ink-2">{l.parentName ?? '—'}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-16',
      render: (l) => (
        <IconButton tone="plain" size="sm" label={`Add a location inside ${l.name}`} onClick={() => setAdding({ warehouseId: l.warehouseId, parentId: l.id })} disabled={!canManage}>
          <Plus className="h-4 w-4" />
        </IconButton>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {!canManage && <Notice tone="info">You can view the warehouse structure. Only managers can add or change warehouses and locations.</Notice>}
      <Section2
        title="Warehouses"
        subtitle="Sites that hold stock."
        action={
          <Button icon={<Building2 className="h-4 w-4" />} onClick={() => setEditing('new')} disabled={!canManage}>
            New warehouse
          </Button>
        }
      >
        <Table
          plain
          caption="Warehouses"
          columns={whColumns}
          rows={list}
          loading={warehouses.isLoading}
          error={warehouses.error?.message}
          onRetry={() => warehouses.refetch()}
          empty={<EmptyState compact icon={Building2} title="No warehouses yet" description="Create a warehouse to start adding locations." />}
        />
      </Section2>

      <Section2
        title="Locations"
        subtitle="Nested view — racks and bins sit under their parent location."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SelectField variant="pill" aria-label="Warehouse" placeholder="All warehouses" value={filter} onChange={(e) => setFilter(e.target.value)} options={list.map((w) => ({ value: w.id, label: w.name }))} />
            <Button variant="outline" icon={<MapPin className="h-4 w-4" />} onClick={() => setAdding({ warehouseId: filter || undefined })} disabled={!canManage || list.length === 0}>
              New location
            </Button>
          </div>
        }
      >
        <Table
          plain
          caption="Locations"
          columns={locColumns}
          rows={rows}
          loading={warehouses.isLoading}
          error={warehouses.error?.message}
          empty={<EmptyState compact icon={MapPin} title="No locations yet" description="Add a location to receive stock into it." />}
        />
      </Section2>
      <p className="text-[12.5px] text-ink-2">Deleting warehouses and editing or deleting locations aren't available yet — the API doesn't support them.</p>

      <WarehouseSheet open={editing !== null} warehouse={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      <LocationSheet open={adding !== null} warehouses={list} defaultWarehouseId={adding?.warehouseId} defaultParentId={adding?.parentId} onClose={() => setAdding(null)} />
    </div>
  );
}

function Section2({ title, subtitle, action, children }: { title: string; subtitle: string; action: ReactNode; children: ReactNode }) {
  return (
    <Card padded={false} className="overflow-hidden">
      <CardHeader className="mb-0 flex-wrap px-6 pb-4 pt-6" title={title} subtitle={subtitle} actions={action} />
      {children}
    </Card>
  );
}

const PERMISSIONS: Array<{ area: string; staff: boolean; manager: boolean }> = [
  { area: 'View products, stock, documents and history', staff: true, manager: true },
  { area: 'Create and validate receipts, deliveries, transfers, adjustments', staff: true, manager: true },
  { area: 'Create, edit and archive products', staff: false, manager: true },
  { area: 'Manage categories and reorder rules', staff: false, manager: true },
  { area: 'Create and edit warehouses and locations', staff: false, manager: true },
];

function WorkspaceSettings() {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader title="Formats" subtitle="How quantities and money are shown." />
        <dl className="divide-y divide-sienna/[0.06]">
          <DetailRow label="Currency">Indian Rupee (₹, INR)</DetailRow>
          <DetailRow label="Number format">en-IN · up to 3 decimals</DetailRow>
          <DetailRow label="Units of measure">
            <span className="flex flex-wrap justify-end gap-1">
              {UOMS.map((u) => (
                <Badge key={u} tone="neutral" dot={false}>
                  {u}
                </Badge>
              ))}
            </span>
          </DetailRow>
        </dl>
      </Card>
      <Card>
        <CardHeader title="Document references" subtitle="Prefixes used across operations." />
        <dl className="divide-y divide-sienna/[0.06]">
          {OPERATION_KINDS.map((k) => (
            <DetailRow key={k} label={OPERATIONS[k].plural}>
              <span className="font-mono">{OPERATIONS[k].prefix}-XXXXXXXX</span>
            </DetailRow>
          ))}
        </dl>
      </Card>
      <Card padded={false} className="overflow-hidden xl:col-span-2">
        <CardHeader className="mb-0 px-6 pb-4 pt-6" title="Roles & permissions" subtitle="Enforced by the API. Administrators can do everything." />
        <table className="w-full text-[13.5px]">
          <caption className="sr-only">Roles and permissions</caption>
          <thead>
            <tr className="text-left text-[12px] text-ink-2">
              <th scope="col" className="px-6 pb-3 font-medium">
                Action
              </th>
              <th scope="col" className="w-40 px-6 pb-3 text-center font-medium">
                {ROLE_LABEL.STAFF}
              </th>
              <th scope="col" className="w-40 px-6 pb-3 text-center font-medium">
                {ROLE_LABEL.MANAGER}
              </th>
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((p) => (
              <tr key={p.area} className="border-t hairline">
                <td className="px-6 py-3 text-ink">{p.area}</td>
                {[p.staff, p.manager].map((ok, i) => (
                  <td key={i} className="px-6 py-3 text-center">
                    {ok ? <Check className="mx-auto h-4 w-4 text-success-fg" aria-label="Allowed" /> : <Minus className="mx-auto h-4 w-4 text-ink-3" aria-label="Not allowed" />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function AccountSettings() {
  const user = useQueryClient().getQueryData<CurrentUser>(['auth', 'me']);
  return (
    <Card className="max-w-2xl">
      <div className="flex items-center gap-4">
        <Avatar name={user?.name ?? '?'} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold text-ink">{user?.name ?? '—'}</p>
          <p className="truncate text-[13px] text-ink-2">{user?.email}</p>
        </div>
        {user?.role && <Badge tone="info">{ROLE_LABEL[user.role]}</Badge>}
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link to="/profile" className="inline-flex h-10 items-center rounded-control bg-sienna px-4 text-sm font-medium text-white hover:bg-sienna-hover">
          Open profile
        </Link>
        <Link to="/login?mode=forgot" className="inline-flex h-10 items-center rounded-control px-4 text-sm font-medium text-ink-2 ring-1 ring-inset ring-sienna/[0.12] hover:bg-dove/15">
          Reset password
        </Link>
      </div>
    </Card>
  );
}
