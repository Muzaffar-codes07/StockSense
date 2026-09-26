import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { History, MapPin } from 'lucide-react';
import { Button, Card, CardHeader, EmptyState, ErrorState, FormField, MoveTypeBadge, Notice, Skeleton, Table, useToast, type Column } from '@/components/ui';
import { SegmentBar } from '@/components/charts/Charts';
import { formatQty } from '@/features/stock/format';
import type { LocationStock, OpenDocLine } from '@/features/stock/types';
import { useMoveHistory } from '@/features/operations/hooks';
import { formatDateTime } from '@/lib/format';
import { CHART, DOC_STATUS } from '@/lib/status';
import type { DocStatus, StockMove } from '@/lib/operations';
import { useRemoveReorderRule, useSetReorderRule } from './hooks';
import { reorderRuleSchema, type ReorderRuleValues } from './schemas';
import type { ReorderRule } from './types';

export function ReorderRuleCard({ productId, rule, onHand, uom }: { productId: string; rule: ReorderRule | null; onHand?: number; uom: string }) {
  const setRule = useSetReorderRule(productId);
  const removeRule = useRemoveReorderRule(productId);
  const toast = useToast();
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReorderRuleValues>({
    resolver: zodResolver(reorderRuleSchema),
    defaultValues: { minQty: rule?.minQty ?? 0, maxQty: rule?.maxQty ?? undefined },
  });

  const onSubmit = handleSubmit(async (v) => {
    setMessage(null);
    try {
      await setRule.mutateAsync({ minQty: v.minQty, maxQty: v.maxQty ?? null });
      setMessage({ tone: 'success', text: 'Reorder rule saved.' });
      toast.success('Reorder rule saved');
    } catch (e) {
      setMessage({ tone: 'danger', text: (e as Error).message });
    }
  });

  const onRemove = async () => {
    setMessage(null);
    try {
      await removeRule.mutateAsync();
      reset({ minQty: 0, maxQty: undefined });
      setMessage({ tone: 'success', text: 'Reorder rule removed.' });
    } catch (e) {
      setMessage({ tone: 'danger', text: (e as Error).message });
    }
  };

  const max = Math.max(onHand ?? 0, rule?.maxQty ?? 0, rule?.minQty ?? 0, 1);

  return (
    <Card>
      <CardHeader title="Reordering" subtitle="Flag this product as low stock at or below the minimum." />
      {rule && onHand !== undefined && (
        <div className="mb-5 rounded-card-sm bg-canvas p-4">
          <div className="mb-2 flex justify-between text-[12px] text-ink-2">
            <span>
              On hand <span className="tabular font-semibold text-ink">{formatQty(onHand)} {uom}</span>
            </span>
            <span>
              Min <span className="tabular font-semibold text-ink">{formatQty(rule.minQty)}</span>
              {rule.maxQty !== null && (
                <>
                  {' '}· Max <span className="tabular font-semibold text-ink">{formatQty(rule.maxQty)}</span>
                </>
              )}
            </span>
          </div>
          <SegmentBar
            max={max}
            marker={rule.minQty}
            ariaLabel={`${formatQty(onHand)} on hand against a minimum of ${formatQty(rule.minQty)}`}
            parts={[{ label: 'On hand', value: Math.max(0, onHand), color: onHand <= rule.minQty ? 'rgb(var(--ss-warning))' : CHART.onHand }]}
          />
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Minimum" type="number" step="0.001" min="0" suffix={uom} {...register('minQty')} error={errors.minQty?.message} />
          <FormField label="Maximum (optional)" type="number" step="0.001" min="0" suffix={uom} {...register('maxQty')} error={errors.maxQty?.message} />
        </div>
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={isSubmitting}>
            Save rule
          </Button>
          {rule && (
            <Button variant="outline" onClick={onRemove} loading={removeRule.isPending}>
              Remove rule
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

export function LocationsCard({ locations, uom }: { locations: LocationStock[]; uom: string }) {
  const total = locations.reduce((s, l) => s + l.qty, 0);
  const columns: Column<LocationStock>[] = [
    {
      key: 'locationName',
      header: 'Location',
      render: (l) => (
        <span>
          <span className="block font-semibold text-ink">{l.locationName}</span>
          <span className="block text-[12px] text-ink-2">{l.warehouseName}</span>
        </span>
      ),
    },
    {
      key: 'share',
      header: 'Share',
      hideOnMobile: true,
      render: (l) => (
        <div className="w-full max-w-[180px]">
          <SegmentBar max={Math.max(total, 1e-9)} ariaLabel={`${l.locationName} holds ${formatQty(l.qty)} ${uom}`} parts={[{ label: l.locationName, value: Math.max(0, l.qty), color: CHART.onHand }]} />
        </div>
      ),
    },
    { key: 'qty', header: 'On hand', align: 'right', render: (l) => <span className="tabular font-medium">{`${formatQty(l.qty)} ${uom}`}</span> },
  ];
  return (
    <Card padded={false} className="overflow-hidden">
      <CardHeader className="mb-0 px-6 pb-4 pt-6" title="Stock by location" subtitle="Where this product is physically held." />
      <Table
        plain
        caption="Stock by location"
        columns={columns}
        rows={locations}
        rowKey={(l) => l.locationId}
        empty={<EmptyState compact icon={MapPin} title="No stock recorded yet" description="Receive or adjust stock to place it at a location." />}
      />
    </Card>
  );
}

export function OpenDocsCard({ reservedBy, incomingFrom, uom, loading, error }: { reservedBy?: OpenDocLine[]; incomingFrom?: OpenDocLine[]; uom: string; loading: boolean; error?: string }) {
  const lines = [
    ...(reservedBy ?? []).map((d) => ({ ...d, dir: 'out' as const })),
    ...(incomingFrom ?? []).map((d) => ({ ...d, dir: 'in' as const })),
  ];
  return (
    <Card>
      <CardHeader title="Open documents" subtitle="Waiting or ready documents that will move this product." />
      {error ? (
        <ErrorState compact message={error} />
      ) : loading ? (
        <Skeleton className="h-16 w-full" />
      ) : lines.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-ink-2">Nothing reserved and nothing incoming.</p>
      ) : (
        <ul className="divide-y divide-sienna/[0.06]">
          {lines.map((d) => (
            <li key={`${d.dir}-${d.docId}`} className="flex items-center justify-between gap-4 py-3">
              <span className="min-w-0">
                <span className="block font-mono text-[12.5px] font-medium text-ink">{d.reference}</span>
                <span className="block truncate text-[12px] text-ink-2">
                  {d.partnerName ?? 'No partner'} · {DOC_STATUS[d.status as DocStatus]?.label ?? d.status}
                </span>
              </span>
              <span className={d.dir === 'in' ? 'tabular text-[13px] font-semibold text-success-fg' : 'tabular text-[13px] font-semibold text-ink'}>
                {d.dir === 'in' ? '+' : '−'}
                {formatQty(d.qty)} {uom}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ProductMovesCard({ productId, uom }: { productId: string; uom: string }) {
  const moves = useMoveHistory({ productId, pageSize: 8 });
  const rows: StockMove[] = Array.isArray(moves.data?.data) ? moves.data!.data : [];
  const columns: Column<StockMove>[] = [
    { key: 'doneAt', header: 'When', render: (m) => <span className="whitespace-nowrap text-ink-2">{formatDateTime(m.doneAt)}</span> },
    { key: 'moveType', header: 'Type', render: (m) => <MoveTypeBadge type={m.moveType} /> },
    {
      key: 'route',
      header: 'From → To',
      hideOnMobile: true,
      render: (m) => (
        <span className="text-ink-2">
          {m.fromLocation?.name ?? 'Outside'} <span aria-hidden>→</span>
          <span className="sr-only">to</span> {m.toLocation?.name ?? 'Outside'}
        </span>
      ),
    },
    { key: 'qty', header: 'Qty', align: 'right', render: (m) => <span className="tabular font-medium">{`${formatQty(Number(m.qty))} ${uom}`}</span> },
  ];
  return (
    <Card padded={false} className="overflow-hidden">
      <CardHeader
        className="mb-0 px-6 pb-4 pt-6"
        title="Movement history"
        subtitle="The latest ledger entries for this product."
        actions={
          <Link to={`/move-history?productId=${productId}`} className="text-[13px] font-medium text-sienna hover:underline">
            View all
          </Link>
        }
      />
      <Table
        plain
        caption="Movement history"
        columns={columns}
        rows={rows}
        loading={moves.isLoading}
        error={moves.error?.message}
        onRetry={() => moves.refetch()}
        empty={<EmptyState compact icon={History} title="No movements yet" description="Receipts, deliveries, transfers and counts will appear here." />}
      />
    </Card>
  );
}
