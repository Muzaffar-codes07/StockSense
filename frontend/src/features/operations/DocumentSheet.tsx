import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, History, Undo2, XCircle } from 'lucide-react';
import { Button, DetailRow, DocStatusBadge, ErrorState, friendlyError, Menu, Modal, Notice, SideSheet, Skeleton, useToast } from '@/components/ui';
import { ValidateLocationModal } from '@/components/operations/ValidateLocationModal';
import { formatQty } from '@/features/stock/format';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { DOC_STATUS } from '@/lib/status';
import type { Adjustment, DocStatus } from '@/lib/operations';
import { OPERATIONS, refOf, type AnyDoc, type OperationKind } from './config';
import { linesOf, partnerOf, type DocLineView } from './docs';
import { useDocAction, useOperation } from './hooks';

const STEPS: DocStatus[] = ['DRAFT', 'WAITING', 'READY', 'DONE'];

/** Next forward status a user can set by hand (DONE only comes from validate). */
const FORWARD: Partial<Record<DocStatus, { to: DocStatus; label: string }>> = {
  DRAFT: { to: 'WAITING', label: 'Confirm' },
  WAITING: { to: 'READY', label: 'Mark ready' },
};

interface Props {
  kind: OperationKind;
  id: string | null;
  onClose: () => void;
}

export function DocumentSheet({ kind, id, onClose }: Props) {
  const cfg = OPERATIONS[kind];
  const doc = useOperation(kind, id);
  const action = useDocAction(kind);
  const toast = useToast();
  const [confirm, setConfirm] = useState<'validate' | 'cancel' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const d = doc.data;
  const ref = id ? refOf(kind, id) : '';
  const open = d ? ['DRAFT', 'WAITING', 'READY'].includes(d.status) : false;
  const lines = d ? linesOf(kind, d) : [];

  const run = async (a: Parameters<typeof action.mutateAsync>[0]['action'], success: string) => {
    if (!id) return;
    setActionError(null);
    try {
      await action.mutateAsync({ id, action: a });
      toast.success(success, ref);
      setConfirm(null);
    } catch (e) {
      const message = (e as Error).message;
      setActionError(message);
      setConfirm(null);
      throw e;
    }
  };
  const quiet = (p: Promise<unknown>) => p.catch(() => {});

  const forward = d ? FORWARD[d.status] : undefined;

  return (
    <>
      <SideSheet
        open={id !== null}
        onClose={onClose}
        width="lg"
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <cfg.icon className="h-3.5 w-3.5" aria-hidden /> {cfg.label}
          </span>
        }
        title={ref || cfg.label}
        subtitle={d ? `Created ${formatDateTime(d.createdAt)}` : undefined}
        headerExtra={d && <StatusTrack status={d.status} />}
        footer={
          d &&
          open && (
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <Menu
                label="More actions"
                align="left"
                side="top"
                items={[
                  ...(d.status !== 'DRAFT' ? [{ label: 'Move back to draft', icon: Undo2, onSelect: () => quiet(run({ type: 'status', status: 'DRAFT' }, 'Moved back to draft')) }] : []),
                  { label: `Cancel ${cfg.label.toLowerCase()}`, icon: XCircle, danger: true, onSelect: () => setConfirm('cancel') },
                ]}
              />
              <div className="flex gap-2">
                {forward && (
                  <Button variant="outline" loading={action.isPending && action.variables?.action.type === 'status'} onClick={() => quiet(run({ type: 'status', status: forward.to }, `Marked as ${DOC_STATUS[forward.to].label.toLowerCase()}`))}>
                    {forward.label}
                  </Button>
                )}
                <Button icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => setConfirm('validate')}>
                  Validate
                </Button>
              </div>
            </div>
          )
        }
      >
        {doc.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : doc.error || !d ? (
          <ErrorState title="Couldn't open this document" message={doc.error?.message} onRetry={() => doc.refetch()} />
        ) : (
          <div className="space-y-6">
            {actionError && <Notice tone="danger">{friendlyError(actionError)}</Notice>}
            {d.status === 'CANCELED' && <Notice tone="info">This {cfg.label.toLowerCase()} was canceled. It no longer affects stock.</Notice>}
            {open && <p className="text-[13px] leading-5 text-ink-2">{cfg.effect}</p>}

            <dl className="divide-y divide-sienna/[0.06] rounded-card-sm bg-canvas px-4">
              <DetailRow label="Status">
                <DocStatusBadge status={d.status} />
              </DetailRow>
              {cfg.partnerLabel && <DetailRow label={cfg.partnerLabel}>{partnerOf(d) ?? '—'}</DetailRow>}
              {kind === 'adjustment' && <DetailRow label="Location counted">{(d as Adjustment).location?.name ?? '—'}</DetailRow>}
              <DetailRow label="Lines">{lines.length}</DetailRow>
              <DetailRow label="Validated">{d.validatedAt ? formatDateTime(d.validatedAt) : '—'}</DetailRow>
            </dl>

            <LinesTable kind={kind} lines={lines} />

            {d.status === 'DONE' && (
              <Link to={`/move-history?docId=${d.id}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-sienna hover:underline">
                <History className="h-4 w-4" aria-hidden /> View ledger entries
              </Link>
            )}
          </div>
        )}
      </SideSheet>

      {d && cfg.validateNeedsLocation && (
        <ValidateLocationModal
          open={confirm === 'validate'}
          title={`Validate ${ref}`}
          locationLabel={cfg.locationLabel ?? 'Location'}
          summary={<ValidateSummary kind={kind} doc={d} lines={lines} />}
          onClose={() => setConfirm(null)}
          onConfirm={(locationId) => run({ type: 'validate', locationId }, `${cfg.label} validated`)}
        />
      )}

      <Modal
        open={confirm === 'cancel' || (confirm === 'validate' && !cfg.validateNeedsLocation)}
        onClose={() => setConfirm(null)}
        title={confirm === 'cancel' ? `Cancel ${ref}?` : `Validate ${ref}?`}
        description={confirm === 'cancel' ? `The ${cfg.label.toLowerCase()} stays in history but no longer affects stock.` : cfg.effect}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              {confirm === 'cancel' ? 'Keep it' : 'Not yet'}
            </Button>
            {confirm === 'cancel' ? (
              <Button variant="danger" loading={action.isPending} onClick={() => quiet(run({ type: 'cancel' }, `${cfg.label} canceled`))}>
                Cancel {cfg.label.toLowerCase()}
              </Button>
            ) : (
              <Button loading={action.isPending} icon={<Check className="h-4 w-4" />} onClick={() => quiet(run({ type: 'validate' }, `${cfg.label} validated`))}>
                Validate
              </Button>
            )}
          </>
        }
      >
        {d && confirm === 'validate' && <ValidateSummary kind={kind} doc={d} lines={lines} />}
      </Modal>
    </>
  );
}

function StatusTrack({ status }: { status: DocStatus }) {
  if (status === 'CANCELED') return <DocStatusBadge status={status} />;
  const at = STEPS.indexOf(status);
  return (
    <ol className="flex items-center gap-1.5" aria-label={`Status: ${DOC_STATUS[status].label}`}>
      {STEPS.map((s, i) => (
        <li key={s} className="flex flex-1 items-center gap-1.5">
          <span
            className={cn(
              'flex h-7 flex-1 items-center justify-center rounded-full text-[12px] font-medium',
              i < at && 'bg-sienna/[0.08] text-sienna',
              i === at && (s === 'DONE' ? 'bg-success/15 text-success-fg' : 'bg-sienna text-white'),
              i > at && 'bg-canvas text-ink-3',
            )}
            aria-current={i === at ? 'step' : undefined}
          >
            {i < at && <Check className="mr-1 h-3 w-3" aria-hidden />}
            {DOC_STATUS[s].label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function ValidateSummary({ kind, lines }: { kind: OperationKind; doc: AnyDoc; lines: DocLineView[] }) {
  const verb = { receipt: 'Adds', delivery: 'Removes', transfer: 'Moves', adjustment: 'Posts the count for' }[kind];
  return (
    <div>
      <p className="mb-2 font-medium text-ink">
        {verb} {lines.length} product line{lines.length === 1 ? '' : 's'}:
      </p>
      <ul className="space-y-1">
        {lines.slice(0, 5).map((l) => (
          <li key={l.id} className="flex justify-between gap-3 text-[13px]">
            <span className="truncate">{l.productName}</span>
            <span className="tabular shrink-0 font-medium text-ink">
              {kind === 'adjustment' ? `${(l.diff ?? 0) > 0 ? '+' : ''}${formatQty(l.diff ?? 0)}` : formatQty(l.qty)} {l.uom}
            </span>
          </li>
        ))}
        {lines.length > 5 && <li className="text-[12px] text-ink-3">+{lines.length - 5} more</li>}
      </ul>
    </div>
  );
}

function LinesTable({ kind, lines }: { kind: OperationKind; lines: DocLineView[] }) {
  if (lines.length === 0) return <p className="text-[13px] text-ink-2">This document has no lines.</p>;
  const th = 'pb-2 text-[12px] font-medium text-ink-2';
  return (
    <div>
      <h3 className="mb-3 text-[15px] font-semibold text-ink">Products</h3>
      <table className="w-full text-[13.5px]">
        <caption className="sr-only">Document lines</caption>
        <thead>
          <tr className="text-left">
            <th scope="col" className={th}>
              Product
            </th>
            {kind === 'adjustment' ? (
              <>
                <th scope="col" className={cn(th, 'text-right')}>
                  Recorded
                </th>
                <th scope="col" className={cn(th, 'text-right')}>
                  Counted
                </th>
                <th scope="col" className={cn(th, 'text-right')}>
                  Difference
                </th>
              </>
            ) : (
              <th scope="col" className={cn(th, 'text-right')}>
                Quantity
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} className="border-t hairline align-top">
              <td className="py-3 pr-3">
                <p className="font-medium text-ink">{l.productName}</p>
                <p className="font-mono text-[12px] text-ink-3">{l.sku}</p>
                {kind === 'transfer' && (
                  <p className="mt-1.5 inline-flex flex-wrap items-center gap-1.5 text-[12px] text-ink-2">
                    <span className="rounded-full bg-canvas px-2 py-0.5">{l.from ?? '—'}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-sienna" aria-label="to" />
                    <span className="rounded-full bg-canvas px-2 py-0.5">{l.to ?? '—'}</span>
                  </p>
                )}
              </td>
              {kind === 'adjustment' ? (
                <>
                  <td className="tabular py-3 text-right text-ink-2">{formatQty(l.recorded ?? 0)}</td>
                  <td className="tabular py-3 text-right text-ink">{formatQty(l.counted ?? 0)}</td>
                  <td className={cn('tabular py-3 text-right font-semibold', (l.diff ?? 0) > 0 ? 'text-success-fg' : (l.diff ?? 0) < 0 ? 'text-danger-fg' : 'text-ink-2')}>
                    {(l.diff ?? 0) > 0 ? '+' : ''}
                    {formatQty(l.diff ?? 0)} {l.uom}
                  </td>
                </>
              ) : (
                <td className="tabular py-3 text-right font-medium text-ink">
                  {formatQty(l.qty)} {l.uom}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
