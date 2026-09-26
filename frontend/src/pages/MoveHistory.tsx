import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ExternalLink, History, X } from 'lucide-react';
import { ChipGroup, DetailRow, EmptyState, FilterBar, MoveTypeBadge, Pager, SelectField, SideSheet, Table, usePageMeta, type Column } from '@/components/ui';
import { OPERATIONS, kindOfDocType, refOf } from '@/features/operations/config';
import { useMoveHistory } from '@/features/operations/hooks';
import { formatQty } from '@/features/stock/format';
import { useLocations } from '@/features/stock/hooks';
import { cn } from '@/lib/cn';
import { formatDate, formatDateTime, formatTime } from '@/lib/format';
import { MOVE_TYPE } from '@/lib/status';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import type { MoveType, StockMove } from '@/lib/operations';

const PAGE_SIZE = 25;
type TypeFilter = MoveType | 'ALL';

/** Signed effect on company stock: receipts add, deliveries remove, transfers are neutral. */
function signOf(m: StockMove): '+' | '−' | '' {
  if (m.moveType === 'RECEIPT') return '+';
  if (m.moveType === 'DELIVERY') return '−';
  if (m.moveType === 'ADJUSTMENT') return m.toLocationId && !m.fromLocationId ? '+' : '−';
  return '';
}

function docLabel(m: StockMove) {
  const kind = kindOfDocType(m.docType);
  if (kind && m.docId) return { ref: refOf(kind, m.docId), to: `${OPERATIONS[kind].path}?doc=${m.docId}` };
  if (m.docType === 'initial') return { ref: 'Opening balance', to: null };
  return { ref: m.docType ? m.docType : 'Manual', to: null };
}

export function MoveHistory() {
  usePageMeta('Move History', 'Every inventory movement in one place.');
  const [params, setParams] = useSearchParams();
  const productId = params.get('productId') ?? '';
  const docId = params.get('docId') ?? '';
  const [search, setSearch] = useState('');
  const [type, setType] = useState<TypeFilter>('ALL');
  const [locationId, setLocationId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<StockMove | null>(null);
  const debounced = useDebouncedValue(search);
  const locations = useLocations();

  const moves = useMoveHistory({
    search: debounced || undefined,
    moveType: type === 'ALL' ? undefined : type,
    locationId: locationId || undefined,
    productId: productId || undefined,
    docId: docId || undefined,
    startDate: start ? new Date(`${start}T00:00:00`).toISOString() : undefined,
    endDate: end ? new Date(`${end}T23:59:59.999`).toISOString() : undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const rows: StockMove[] = Array.isArray(moves.data?.data) ? moves.data!.data : [];
  const activeCount = [search, type !== 'ALL', locationId, start, end, productId, docId].filter(Boolean).length;
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };
  const dropParam = (key: string) =>
    reset(() => {
      const next = new URLSearchParams(params);
      next.delete(key);
      setParams(next, { replace: true });
    });

  const columns: Column<StockMove>[] = [
    {
      key: 'doneAt',
      header: 'Date',
      render: (m) => (
        <span className="whitespace-nowrap">
          <span className="block font-medium text-ink">{formatDate(m.doneAt)}</span>
          <span className="block text-[12px] text-ink-3">{formatTime(m.doneAt)}</span>
        </span>
      ),
    },
    { key: 'type', header: 'Type', render: (m) => <MoveTypeBadge type={m.moveType} /> },
    {
      key: 'product',
      header: 'Product',
      render: (m) => (
        <span className="block min-w-0">
          <span className="block truncate font-semibold text-ink">{m.product?.name ?? '—'}</span>
          <span className="block font-mono text-[12px] text-ink-3">{m.product?.sku}</span>
        </span>
      ),
    },
    {
      key: 'route',
      header: 'From → To',
      render: (m) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-ink-2">
          <span className={cn(!m.fromLocation && 'text-ink-3')}>{m.fromLocation?.name ?? 'Outside'}</span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-sienna" aria-label="to" />
          <span className={cn(m.toLocation ? 'text-ink' : 'text-ink-3')}>{m.toLocation?.name ?? 'Outside'}</span>
        </span>
      ),
    },
    {
      key: 'qty',
      header: 'Quantity',
      align: 'right',
      render: (m) => {
        const sign = signOf(m);
        return (
          <span className={cn('tabular whitespace-nowrap font-semibold', sign === '+' ? 'text-success-fg' : sign === '−' ? 'text-danger-fg' : 'text-ink')}>
            {sign}
            {formatQty(Number(m.qty))} <span className="font-normal text-ink-2">{m.product?.uom}</span>
          </span>
        );
      },
    },
    { key: 'doc', header: 'Document', hideOnMobile: true, render: (m) => <span className="font-mono text-[12.5px] text-ink-2">{docLabel(m).ref}</span> },
    { key: 'user', header: 'By', hideOnMobile: true, render: (m) => <span className="text-ink-2">{m.createdBy?.name ?? 'System'}</span> },
  ];

  const dateInput =
    'h-9 rounded-full border border-sienna/10 bg-white px-3.5 text-[13px] text-ink transition-colors hover:border-sienna/25 focus:border-sienna/35 focus:outline-none focus:ring-4 focus:ring-sienna/10';

  return (
    <div>
      <div className="mb-5">
        <ChipGroup
          label="Movement type"
          value={type}
          onChange={(v) => reset(() => setType(v))}
          options={[{ value: 'ALL' as TypeFilter, label: 'All' }, ...(Object.keys(MOVE_TYPE) as MoveType[]).map((t) => ({ value: t as TypeFilter, label: MOVE_TYPE[t].label }))]}
        />
      </div>

      <FilterBar
        search={search}
        onSearch={(v) => reset(() => setSearch(v))}
        searchPlaceholder="Search product or SKU…"
        activeCount={activeCount}
        onClear={() =>
          reset(() => {
            setSearch('');
            setType('ALL');
            setLocationId('');
            setStart('');
            setEnd('');
            setParams({}, { replace: true });
          })
        }
        trailing={
          moves.data && (
            <span className="text-[13px] text-ink-2">
              <span className="tabular font-semibold text-ink">{moves.data.total}</span> movement{moves.data.total === 1 ? '' : 's'}
            </span>
          )
        }
      >
        <SelectField
          variant="pill"
          aria-label="Location"
          placeholder="All locations"
          value={locationId}
          onChange={(e) => reset(() => setLocationId(e.target.value))}
          options={(Array.isArray(locations.data) ? locations.data : []).map((l) => ({ value: l.id, label: `${l.warehouseName} / ${l.name}` }))}
        />
        <label className="inline-flex items-center gap-1.5 text-[12px] text-ink-2">
          <span className="sr-only sm:not-sr-only">From</span>
          <input type="date" aria-label="From date" className={dateInput} value={start} max={end || undefined} onChange={(e) => reset(() => setStart(e.target.value))} />
        </label>
        <label className="inline-flex items-center gap-1.5 text-[12px] text-ink-2">
          <span className="sr-only sm:not-sr-only">To</span>
          <input type="date" aria-label="To date" className={dateInput} value={end} min={start || undefined} onChange={(e) => reset(() => setEnd(e.target.value))} />
        </label>
        {productId && <ParamChip label={`Product: ${rows[0]?.productId === productId ? rows[0].product?.name : 'selected'}`} onRemove={() => dropParam('productId')} />}
        {docId && <ParamChip label="One document" onRemove={() => dropParam('docId')} />}
      </FilterBar>

      <Table
        caption="Stock ledger"
        columns={columns}
        rows={rows}
        loading={moves.isLoading}
        error={moves.error?.message}
        onRetry={() => moves.refetch()}
        onRowClick={setSelected}
        selectedKey={selected?.id}
        empty={
          <EmptyState
            compact
            icon={History}
            title={activeCount ? 'No movements match these filters' : 'No movements yet'}
            description={activeCount ? 'Try a wider date range or clear the filters.' : 'Validated receipts, deliveries, transfers and adjustments are recorded here.'}
          />
        }
      />
      <Pager page={page} totalPages={moves.data?.totalPages ?? 1} onPage={setPage} total={moves.data?.total} pageSize={PAGE_SIZE} />
      <MoveSheet move={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function ParamChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-9 items-center gap-1 rounded-full bg-sienna/[0.07] pl-3.5 pr-1 text-[13px] font-medium text-sienna">
      {label}
      <button type="button" onClick={onRemove} className="grid h-7 w-7 place-items-center rounded-full hover:bg-sienna/10" aria-label={`Remove filter: ${label}`}>
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

function MoveSheet({ move, onClose }: { move: StockMove | null; onClose: () => void }) {
  if (!move) return <SideSheet open={false} onClose={onClose} title="">{null}</SideSheet>;
  const t = MOVE_TYPE[move.moveType] ?? MOVE_TYPE.RECEIPT;
  const doc = docLabel(move);
  const sign = signOf(move);
  return (
    <SideSheet
      open
      onClose={onClose}
      width="md"
      eyebrow={
        <span className="inline-flex items-center gap-2">
          <t.icon className="h-3.5 w-3.5" aria-hidden /> {t.label} movement
        </span>
      }
      title={move.product?.name ?? 'Movement'}
      subtitle={formatDateTime(move.doneAt)}
    >
      <div className="space-y-6">
        <div className="rounded-card-sm bg-canvas p-5 text-center">
          <p className={cn('tabular text-[32px] font-bold leading-9 tracking-tight', sign === '+' ? 'text-success-fg' : sign === '−' ? 'text-danger-fg' : 'text-ink')}>
            {sign}
            {formatQty(Number(move.qty))} <span className="text-[16px] font-medium text-ink-2">{move.product?.uom}</span>
          </p>
          <p className="mt-3 inline-flex flex-wrap items-center justify-center gap-2 text-[13px] text-ink-2">
            <span className="rounded-full bg-white px-3 py-1">{move.fromLocation?.name ?? 'Outside'}</span>
            <ArrowRight className="h-4 w-4 text-sienna" aria-label="to" />
            <span className="rounded-full bg-white px-3 py-1 font-medium text-ink">{move.toLocation?.name ?? 'Outside'}</span>
          </p>
        </div>
        <dl className="divide-y divide-sienna/[0.06]">
          <DetailRow label="Product">
            <Link to={`/products/${move.productId}`} className="text-sienna hover:underline">
              {move.product?.name} <span className="font-mono text-[12px] text-ink-3">{move.product?.sku}</span>
            </Link>
          </DetailRow>
          <DetailRow label="Type">
            <MoveTypeBadge type={move.moveType} />
          </DetailRow>
          <DetailRow label="Document">
            {doc.to ? (
              <Link to={doc.to} className="inline-flex items-center gap-1 font-mono text-sienna hover:underline">
                {doc.ref} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </Link>
            ) : (
              <span className="font-mono">{doc.ref}</span>
            )}
          </DetailRow>
          <DetailRow label="Recorded by">{move.createdBy?.name ?? 'System'}</DetailRow>
          <DetailRow label="Done at">{formatDateTime(move.doneAt)}</DetailRow>
          <DetailRow label="Logged at">{formatDateTime(move.createdAt)}</DetailRow>
        </dl>
        <p className="text-[12px] leading-5 text-ink-2">Ledger entries are immutable. To correct stock, record an adjustment.</p>
      </div>
    </SideSheet>
  );
}
