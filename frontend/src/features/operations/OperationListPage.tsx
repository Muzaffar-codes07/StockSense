import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import { Button, ChipGroup, DocStatusBadge, EmptyState, FilterBar, Pager, SelectField, SubNav, Table, usePageMeta, useToast, type Column } from '@/components/ui';
import { CreateAdjustmentModal } from '@/components/operations/CreateAdjustmentModal';
import { CreateDeliveryModal, CreateReceiptModal } from '@/components/operations/CreateReceiptModal';
import { CreateTransferModal } from '@/components/operations/CreateTransferModal';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { formatDate, timeAgo } from '@/lib/format';
import { DOC_STATUS, DOC_STATUS_ORDER } from '@/lib/status';
import type { Adjustment, DocStatus } from '@/lib/operations';
import { OPERATION_KINDS, OPERATIONS, refOf, type AnyDoc, type OperationKind } from './config';
import { DocumentSheet } from './DocumentSheet';
import { linesOf, partnerOf, productsSummary, quantitySummary, routeSummary } from './docs';
import { useLocations } from '@/features/stock/hooks';
import { useOperationList, useOpsKpis, usePartners, useRefreshOperations } from './hooks';

const PAGE_SIZE = 20;

const SUBTITLE: Record<OperationKind, string> = {
  receipt: 'Track incoming inventory from suppliers.',
  delivery: 'Pick, pack and ship customer orders.',
  transfer: 'Move stock between locations.',
  adjustment: 'Reconcile physical counts with the ledger.',
};

const CREATE_MODAL = {
  receipt: CreateReceiptModal,
  delivery: CreateDeliveryModal,
  transfer: CreateTransferModal,
  adjustment: CreateAdjustmentModal,
};

type StatusFilter = DocStatus | 'ALL';

export function OperationsSubNav() {
  const kpis = useOpsKpis();
  const counts: Partial<Record<OperationKind, number>> = {
    receipt: kpis.data?.pendingReceipts,
    delivery: kpis.data?.pendingDeliveries,
    transfer: kpis.data?.scheduledTransfers,
  };
  return (
    <SubNav
      label="Operations"
      items={[
        { to: '/operations', label: 'Overview', end: true },
        ...OPERATION_KINDS.map((k) => {
          const Icon = OPERATIONS[k].icon;
          return { to: OPERATIONS[k].path, label: OPERATIONS[k].plural, icon: <Icon className="h-3.5 w-3.5" aria-hidden />, count: counts[k] };
        }),
      ]}
    />
  );
}

export function OperationListPage({ kind }: { kind: OperationKind }) {
  const cfg = OPERATIONS[kind];
  usePageMeta(cfg.plural, SUBTITLE[kind]);
  const toast = useToast();
  const refresh = useRefreshOperations();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [partnerId, setPartnerId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search);

  const selected = params.get('doc');
  const creating = params.get('new') === '1';
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const list = useOperationList(kind, {
    search: debounced || undefined,
    status: status === 'ALL' ? undefined : status,
    partnerId: partnerId || undefined,
    locationId: locationId || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const partners = usePartners(cfg.partnerType);
  const locations = useLocations();
  const filtersLocation = kind === 'transfer' || kind === 'adjustment';
  const activeCount = (search ? 1 : 0) + (status !== 'ALL' ? 1 : 0) + (partnerId ? 1 : 0) + (locationId ? 1 : 0);
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const columns = useMemo<Column<AnyDoc>[]>(() => {
    const cols: Column<AnyDoc>[] = [
      {
        key: 'ref',
        header: 'Reference',
        render: (d) => (
          <span>
            <span className="block whitespace-nowrap font-mono text-[13px] font-semibold text-ink">{refOf(kind, d.id)}</span>
            <span className="block text-[12px] text-ink-3">{timeAgo(d.createdAt)}</span>
          </span>
        ),
      },
    ];
    if (cfg.partnerLabel) cols.push({ key: 'partner', header: cfg.partnerLabel, render: (d) => <span className="text-ink">{partnerOf(d) ?? <span className="text-ink-3">—</span>}</span> });
    if (kind === 'transfer') {
      cols.push({
        key: 'route',
        header: 'From → To',
        render: (d) => {
          const r = routeSummary(linesOf(kind, d));
          if (!r) return '—';
          return r.to ? (
            <span className="inline-flex items-center gap-1.5 text-ink-2">
              <span className="max-w-[140px] truncate">{r.from}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-sienna" aria-label="to" />
              <span className="max-w-[140px] truncate text-ink">{r.to}</span>
            </span>
          ) : (
            <span className="text-ink-2">{r.from}</span>
          );
        },
      });
    }
    if (kind === 'adjustment') cols.push({ key: 'location', header: 'Location', render: (d) => (d as Adjustment).location?.name ?? '—' });
    cols.push(
      { key: 'products', header: 'Products', hideOnMobile: true, render: (d) => <span className="line-clamp-1 max-w-[260px] text-ink-2">{productsSummary(linesOf(kind, d))}</span> },
      {
        key: 'qty',
        header: kind === 'adjustment' ? 'Net change' : 'Quantity',
        align: 'right',
        render: (d) => {
          const lines = linesOf(kind, d);
          if (kind !== 'adjustment') return <span className="tabular font-medium">{quantitySummary(lines)}</span>;
          const net = lines.reduce((s, l) => s + (l.diff ?? 0), 0);
          const units = new Set(lines.map((l) => l.uom));
          return (
            <span className={`tabular font-medium ${net > 0 ? 'text-success-fg' : net < 0 ? 'text-danger-fg' : 'text-ink-2'}`}>
              {units.size === 1 ? `${net > 0 ? '+' : ''}${net} ${lines[0]?.uom ?? ''}` : `${lines.length} lines`}
            </span>
          );
        },
      },
      { key: 'date', header: 'Created', hideOnMobile: true, render: (d) => <span className="whitespace-nowrap text-ink-2">{formatDate(d.createdAt)}</span> },
      { key: 'status', header: 'Status', render: (d) => <DocStatusBadge status={d.status} /> },
    );
    return cols;
  }, [kind, cfg.partnerLabel]);

  const Create = CREATE_MODAL[kind];

  return (
    <div>
      <OperationsSubNav />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <ChipGroup
          label="Status"
          value={status}
          onChange={(v) => reset(() => setStatus(v))}
          options={[{ value: 'ALL' as StatusFilter, label: 'All' }, ...DOC_STATUS_ORDER.map((s) => ({ value: s as StatusFilter, label: DOC_STATUS[s].label }))]}
        />
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setParam('new', '1')}>
          New {cfg.label.toLowerCase()}
        </Button>
      </div>

      <FilterBar
        search={search}
        onSearch={(v) => reset(() => setSearch(v))}
        searchPlaceholder={cfg.partnerLabel ? `Search ${cfg.partnerLabel.toLowerCase()} or product…` : 'Search product or location…'}
        activeCount={activeCount}
        onClear={() =>
          reset(() => {
            setSearch('');
            setStatus('ALL');
            setPartnerId('');
            setLocationId('');
          })
        }
        trailing={
          list.data && (
            <span className="text-[13px] text-ink-2">
              <span className="tabular font-semibold text-ink">{list.data.total}</span> document{list.data.total === 1 ? '' : 's'}
            </span>
          )
        }
      >
        {cfg.partnerType && (
          <SelectField
            variant="pill"
            aria-label={cfg.partnerLabel}
            placeholder={`All ${cfg.partnerLabel?.toLowerCase()}s`}
            value={partnerId}
            onChange={(e) => reset(() => setPartnerId(e.target.value))}
            options={(Array.isArray(partners.data) ? partners.data : []).map((p) => ({ value: p.id, label: p.name }))}
          />
        )}
        {filtersLocation && (
          <SelectField
            variant="pill"
            aria-label="Location"
            placeholder="All locations"
            value={locationId}
            onChange={(e) => reset(() => setLocationId(e.target.value))}
            options={(Array.isArray(locations.data) ? locations.data : []).map((l) => ({ value: l.id, label: `${l.warehouseName} / ${l.name}` }))}
          />
        )}
      </FilterBar>

      <Table
        caption={cfg.plural}
        columns={columns}
        rows={Array.isArray(list.data?.data) ? list.data!.data : []}
        loading={list.isLoading}
        error={list.error?.message}
        onRetry={() => list.refetch()}
        onRowClick={(d) => setParam('doc', d.id)}
        selectedKey={selected}
        empty={
          activeCount ? (
            <EmptyState compact icon={cfg.icon} title={`No ${cfg.plural.toLowerCase()} match these filters`} description="Try another status or clear the filters." />
          ) : (
            <EmptyState
              compact
              icon={cfg.icon}
              title={`No ${cfg.plural.toLowerCase()} yet`}
              description={cfg.purpose + '.'}
              action={
                <Button icon={<Plus className="h-4 w-4" />} onClick={() => setParam('new', '1')}>
                  New {cfg.label.toLowerCase()}
                </Button>
              }
            />
          )
        }
      />
      <Pager page={page} totalPages={list.data?.totalPages ?? 1} onPage={setPage} total={list.data?.total} pageSize={PAGE_SIZE} />

      <DocumentSheet kind={kind} id={selected} onClose={() => setParam('doc', null)} />
      <Create
        open={creating}
        onClose={() => setParam('new', null)}
        onSuccess={() => {
          refresh();
          toast.success(`${cfg.label} created`, 'Saved as a draft.');
        }}
      />
    </div>
  );
}
