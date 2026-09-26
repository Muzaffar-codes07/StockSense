import type { Adjustment, Delivery, Receipt, Transfer } from '@/lib/operations';
import { formatQty } from '@/features/stock/format';
import type { AnyDoc, OperationKind } from './config';

/** Normalised line for display, whatever the document type. */
export interface DocLineView {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  uom: string;
  qty: number;
  from?: string;
  to?: string;
  recorded?: number;
  counted?: number;
  diff?: number;
}

export function linesOf(kind: OperationKind, doc: AnyDoc): DocLineView[] {
  const lines = Array.isArray(doc.lines) ? doc.lines : [];
  if (kind === 'transfer') {
    return (lines as Transfer['lines']).map((l) => ({
      id: l.id,
      productId: l.productId,
      productName: l.product?.name ?? 'Product',
      sku: l.product?.sku ?? '',
      uom: l.product?.uom ?? '',
      qty: Number(l.qty),
      from: l.fromLocation ? locName(l.fromLocation) : undefined,
      to: l.toLocation ? locName(l.toLocation) : undefined,
    }));
  }
  if (kind === 'adjustment') {
    return (lines as Adjustment['lines']).map((l) => ({
      id: l.id,
      productId: l.productId,
      productName: l.product?.name ?? 'Product',
      sku: l.product?.sku ?? '',
      uom: l.product?.uom ?? '',
      qty: Math.abs(Number(l.diff)),
      recorded: Number(l.recordedQty),
      counted: Number(l.countedQty),
      diff: Number(l.diff),
    }));
  }
  return (lines as Receipt['lines'] | Delivery['lines']).map((l) => ({
    id: l.id,
    productId: l.productId,
    productName: l.product?.name ?? 'Product',
    sku: l.product?.sku ?? '',
    uom: l.product?.uom ?? '',
    qty: Number(l.qty),
  }));
}

const locName = (l: { name: string; warehouse?: { name: string } }) => (l.warehouse?.name ? `${l.warehouse.name} / ${l.name}` : l.name);

export function partnerOf(doc: AnyDoc): string | null {
  return 'partner' in doc && doc.partner ? doc.partner.name : null;
}

/** "Steel Rods, Oak Plank +2 more" */
export function productsSummary(lines: DocLineView[]) {
  if (lines.length === 0) return 'No lines';
  const names = lines.slice(0, 2).map((l) => l.productName);
  return lines.length > 2 ? `${names.join(', ')} +${lines.length - 2} more` : names.join(', ');
}

/** Total quantity when every line shares a unit, else a line count. */
export function quantitySummary(lines: DocLineView[]) {
  if (lines.length === 0) return '—';
  const uoms = new Set(lines.map((l) => l.uom));
  if (uoms.size === 1) return `${formatQty(lines.reduce((s, l) => s + l.qty, 0))} ${lines[0].uom}`;
  return `${lines.length} lines`;
}

/** Route of a transfer, collapsed when every line shares it. */
export function routeSummary(lines: DocLineView[]) {
  const routes = new Set(lines.map((l) => `${l.from ?? '?'}→${l.to ?? '?'}`));
  if (lines.length === 0) return null;
  if (routes.size === 1) return { from: lines[0].from ?? '—', to: lines[0].to ?? '—' };
  return { from: `${routes.size} routes`, to: '' };
}
