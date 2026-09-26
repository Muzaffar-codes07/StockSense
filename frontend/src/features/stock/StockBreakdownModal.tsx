import type { ReactNode } from 'react';
import { ErrorState, Modal, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { DOC_STATUS } from '@/lib/status';
import type { DocStatus } from '@/lib/operations';
import { formatQty } from './format';
import { useStockBreakdown } from './hooks';
import type { OpenDocLine, StockRow } from './types';

type Props = { row: StockRow | null; onClose: () => void };

/**
 * "Why is free-to-use 67?" — the worked sum behind a Stock row, from the
 * ledger (on hand per location) and the open documents (reserved, incoming).
 */
export function StockBreakdownModal({ row, onClose }: Props) {
  const { data, error, isLoading, refetch } = useStockBreakdown(row?.id);
  const qty = (n: number) => `${formatQty(n)} ${data?.uom ?? row?.uom ?? ''}`;

  return (
    <Modal
      open={row !== null}
      title={row ? `${row.name} — stock breakdown` : undefined}
      description="How free-to-use and forecast are worked out from the ledger and open documents."
      onClose={onClose}
    >
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      )}
      {error && <ErrorState compact message={error.message} onRetry={() => refetch()} />}
      {data && (
        <div className="text-[13.5px]">
          <Group>
            <Total id="onHand" label="On hand" value={qty(data.onHand)} />
            {data.locations.length === 0 ? (
              <Detail muted>Nothing on hand at any location</Detail>
            ) : (
              data.locations.map((l) => (
                <Detail key={l.locationId} amount={qty(l.qty)}>
                  <span>{l.locationName}</span>
                  <span className="text-ink-3"> · {l.warehouseName}</span>
                </Detail>
              ))
            )}
          </Group>

          <Group>
            <Total id="reserved" label="− Reserved by open deliveries" value={qty(data.reserved)} />
            <DocLines lines={data.reservedBy} empty="No open deliveries" qty={qty} />
          </Group>

          <Total id="freeToUse" label="= Free to use" value={qty(data.freeToUse)} strong />

          <Group>
            <Total id="incoming" label="+ Incoming on open receipts" value={qty(data.incoming)} />
            <DocLines lines={data.incomingFrom} empty="No open receipts" qty={qty} />
          </Group>

          <Total id="forecast" label="= Forecast" value={qty(data.forecast)} strong />
          <p className="mt-4 text-[12px] leading-5 text-ink-2">
            Open = waiting or ready. Drafts don't count until confirmed; validated documents are already in on hand.
          </p>
        </div>
      )}
    </Modal>
  );
}

function Group({ children }: { children: ReactNode }) {
  return <div className="space-y-1 pb-3">{children}</div>;
}

function Total({ id, label, value, strong }: { id: string; label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={cn(
        'flex justify-between gap-4',
        strong ? 'mb-3 rounded-[12px] bg-canvas px-3 py-2.5 font-semibold text-ink' : 'pt-1 font-medium text-chocolate',
      )}
    >
      <span>{label}</span>
      <span data-testid={`total-${id}`} className="tabular">
        {value}
      </span>
    </div>
  );
}

function Detail({ children, amount, muted }: { children: ReactNode; amount?: string; muted?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-4 pl-4', muted ? 'text-ink-3' : 'text-ink-2')}>
      <span className="min-w-0">{children}</span>
      {amount && <span className="tabular shrink-0">{amount}</span>}
    </div>
  );
}

function DocLines({ lines, empty, qty }: { lines: OpenDocLine[]; empty: string; qty: (n: number) => string }) {
  if (lines.length === 0) return <Detail muted>{empty}</Detail>;
  return (
    <>
      {lines.map((d) => (
        <Detail key={d.docId} amount={qty(d.qty)}>
          <span className="font-mono text-[12px] text-ink">{d.reference}</span>
          <span className="text-ink-3">
            {' '}
            · {d.partnerName ?? 'No partner'} · {DOC_STATUS[d.status as DocStatus]?.label.toLowerCase() ?? d.status.toLowerCase()}
          </span>
        </Detail>
      ))}
    </>
  );
}
