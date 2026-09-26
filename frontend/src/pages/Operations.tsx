import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ClipboardList, Plus } from 'lucide-react';
import { Card, DocStatusBadge, EmptyState, ErrorState, Notice, Section, Skeleton, usePageMeta } from '@/components/ui';
import { OPERATION_KINDS, OPERATIONS, refOf, type AnyDoc, type OperationKind } from '@/features/operations/config';
import { linesOf, partnerOf, productsSummary } from '@/features/operations/docs';
import { useOperationList, useOpsKpis } from '@/features/operations/hooks';
import { OperationsSubNav } from '@/features/operations/OperationListPage';
import { timeAgo } from '@/lib/format';

/** Operations hub: what's pending per document type, and the latest documents across all four. */
export function Operations() {
  usePageMeta('Operations', 'Receipts, deliveries, transfers and adjustments in one place.');
  const kpis = useOpsKpis();
  const adjDraft = useOperationList('adjustment', { status: 'DRAFT', pageSize: 1 });
  const adjWaiting = useOperationList('adjustment', { status: 'WAITING', pageSize: 1 });
  const adjReady = useOperationList('adjustment', { status: 'READY', pageSize: 1 });
  const adjOpen = [adjDraft, adjWaiting, adjReady].every((q) => q.data) ? [adjDraft, adjWaiting, adjReady].reduce((s, q) => s + (q.data?.total ?? 0), 0) : undefined;

  const pending: Record<OperationKind, { count?: number; label: string; loading: boolean }> = {
    receipt: { count: kpis.data?.pendingReceipts, label: 'waiting to be received', loading: kpis.isLoading },
    delivery: { count: kpis.data?.pendingDeliveries, label: 'waiting to ship', loading: kpis.isLoading },
    transfer: { count: kpis.data?.scheduledTransfers, label: 'scheduled', loading: kpis.isLoading },
    adjustment: { count: adjOpen, label: 'open counts', loading: adjDraft.isLoading },
  };

  return (
    <div>
      <OperationsSubNav />
      {kpis.isError && <Notice tone="warning" className="mb-6">Pending counts are unavailable right now.</Notice>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {OPERATION_KINDS.map((k, i) => {
          const cfg = OPERATIONS[k];
          const p = pending[k];
          return (
            <Card key={k} tone={(['mist', 'blush', 'dove', 'surface'] as const)[i]} className="flex min-h-[208px] flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  {p.loading ? (
                    <Skeleton className="h-9 w-12" />
                  ) : (
                    <p className="tabular text-kpi font-bold tracking-[-0.035em] text-ink">{p.count ?? '—'}</p>
                  )}
                  <p className="mt-1 text-[13px] text-ink-2">{p.label}</p>
                </div>
                <Link
                  to={`${cfg.path}?new=1`}
                  className="inline-flex h-8 items-center gap-1 rounded-full bg-white/80 px-3 text-[12.5px] font-medium text-sienna ring-1 ring-inset ring-sienna/10 transition-colors hover:bg-white"
                  aria-label={`New ${cfg.label.toLowerCase()}`}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden /> New
                </Link>
              </div>
              <div className="mt-auto flex items-end justify-between gap-3 pt-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-white text-sienna shadow-card" aria-hidden>
                    <cfg.icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-[15px] font-semibold text-ink">{cfg.plural}</span>
                    <span className="block text-[12px] text-ink-2">{cfg.purpose}</span>
                  </span>
                </div>
                <Link to={cfg.path} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-2 transition-colors hover:bg-white hover:text-ink" aria-label={`Open ${cfg.plural}`}>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </Card>
          );
        })}
      </div>

      <RecentDocuments />
    </div>
  );
}

function RecentDocuments() {
  const navigate = useNavigate();
  const receipts = useOperationList('receipt', { pageSize: 6 });
  const deliveries = useOperationList('delivery', { pageSize: 6 });
  const transfers = useOperationList('transfer', { pageSize: 6 });
  const adjustments = useOperationList('adjustment', { pageSize: 6 });
  const queries = { receipt: receipts, delivery: deliveries, transfer: transfers, adjustment: adjustments };
  const loading = Object.values(queries).some((q) => q.isLoading);
  const allFailed = Object.values(queries).every((q) => q.isError);

  const rows = useMemo(() => {
    const out: Array<{ kind: OperationKind; doc: AnyDoc }> = [];
    for (const k of OPERATION_KINDS) {
      const data = queries[k].data?.data;
      if (Array.isArray(data)) data.forEach((doc) => out.push({ kind: k, doc }));
    }
    return out.sort((a, b) => b.doc.createdAt.localeCompare(a.doc.createdAt)).slice(0, 10);
  }, [receipts.data, deliveries.data, transfers.data, adjustments.data]);

  return (
    <Section title="Latest documents" description="The newest receipts, deliveries, transfers and adjustments." className="mt-9">
      <Card padded={false}>
        {allFailed ? (
          <ErrorState message={receipts.error?.message} onRetry={() => Object.values(queries).forEach((q) => q.refetch())} />
        ) : loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No documents yet" description="Create a receipt, delivery, transfer or adjustment to get started." />
        ) : (
          <ul className="divide-y divide-sienna/[0.06] px-2 py-2">
            {rows.map(({ kind, doc }) => {
              const cfg = OPERATIONS[kind];
              const who = kind === 'adjustment' ? ('location' in doc ? doc.location?.name : null) : partnerOf(doc);
              return (
                <li key={`${kind}-${doc.id}`}>
                  <button
                    type="button"
                    onClick={() => navigate(`${cfg.path}?doc=${doc.id}`)}
                    className="flex w-full items-center gap-4 rounded-[14px] px-4 py-3 text-left transition-colors hover:bg-dove/[0.12]"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-raspberry text-ondark" aria-hidden>
                      <cfg.icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-[13px] font-semibold text-ink">{refOf(kind, doc.id)}</span>
                      <span className="block truncate text-[12px] text-ink-2">
                        {cfg.label}
                        {who ? ` · ${who}` : ''} · {productsSummary(linesOf(kind, doc))}
                      </span>
                    </span>
                    <span className="hidden w-24 text-right text-[12px] text-ink-2 sm:block">{timeAgo(doc.createdAt)}</span>
                    <DocStatusBadge status={doc.status} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </Section>
  );
}
