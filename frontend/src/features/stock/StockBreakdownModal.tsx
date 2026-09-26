import type { ReactNode } from 'react';
import { Modal } from '@/components/ui';
import { formatQty } from './format';
import { useStockBreakdown } from './hooks';
import type { OpenDocLine, StockRow } from './types';

type Props = { row: StockRow | null; onClose: () => void };

/**
 * "Why is free-to-use 67?" — the worked sum behind a Stock row, from the
 * ledger (on hand per location) and the open documents (reserved, incoming).
 */
export function StockBreakdownModal({ row, onClose }: Props) {
  const { data, error, isLoading } = useStockBreakdown(row?.id);
  const qty = (n: number) => `${formatQty(n)} ${data?.uom ?? row?.uom ?? ''}`;

  return (
    <Modal open={row !== null} title={row ? `${row.name} — stock breakdown` : undefined} onClose={onClose}>
      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}
      {data && (
        <div className="space-y-1 text-sm">
          <Total id="onHand" label="On hand" value={qty(data.onHand)} />
          {data.locations.length === 0 ? (
            <Detail muted>Nothing on hand at any location</Detail>
          ) : (
            data.locations.map((l) => (
              <Detail key={l.locationId} amount={qty(l.qty)}>
                <span>{l.locationName}</span>
                <span className="text-slate-400"> · {l.warehouseName}</span>
              </Detail>
            ))
          )}

          <Total id="reserved" label="− Reserved by open deliveries" value={qty(data.reserved)} />
          <DocLines lines={data.reservedBy} empty="No open deliveries" qty={qty} />

          <Total id="freeToUse" label="= Free to use" value={qty(data.freeToUse)} strong />

          <Total id="incoming" label="+ Incoming on open receipts" value={qty(data.incoming)} />
          <DocLines lines={data.incomingFrom} empty="No open receipts" qty={qty} />

          <Total id="forecast" label="= Forecast" value={qty(data.forecast)} strong />
          <p className="pt-3 text-xs text-slate-400">
            Open = waiting or ready. Drafts don't count until confirmed; validated documents are already in on hand.
          </p>
        </div>
      )}
    </Modal>
  );
}

function Total({ id, label, value, strong }: { id: string; label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={`flex justify-between pt-3 ${strong ? 'border-t border-slate-200 font-semibold text-slate-900' : 'font-medium text-slate-700'}`}
    >
      <span>{label}</span>
      <span data-testid={`total-${id}`}>{value}</span>
    </div>
  );
}

function Detail({ children, amount, muted }: { children: ReactNode; amount?: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between pl-4 ${muted ? 'text-slate-400' : 'text-slate-600'}`}>
      <span>{children}</span>
      {amount && <span>{amount}</span>}
    </div>
  );
}

function DocLines({ lines, empty, qty }: { lines: OpenDocLine[]; empty: string; qty: (n: number) => string }) {
  if (lines.length === 0) return <Detail muted>{empty}</Detail>;
  return (
    <>
      {lines.map((d) => (
        <Detail key={d.docId} amount={qty(d.qty)}>
          <span className="font-mono text-xs">{d.reference}</span>
          <span className="text-slate-400">
            {' '}
            · {d.partnerName ?? 'No partner'} · {d.status.toLowerCase()}
          </span>
        </Detail>
      ))}
    </>
  );
}
