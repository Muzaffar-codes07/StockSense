import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Archive, ArrowLeft, Pencil } from 'lucide-react';
import { Badge, Button, Card, DetailRow, ErrorState, Metric, Modal, Notice, Skeleton, usePageMeta, useToast } from '@/components/ui';
import { formatMoney, formatQty } from '@/features/stock/format';
import { useStockBreakdown } from '@/features/stock/hooks';
import { formatDate } from '@/lib/format';
import { useArchiveProduct, useProduct } from './hooks';
import { ProductSheet } from './ProductForm';
import { LocationsCard, OpenDocsCard, ProductMovesCard, ReorderRuleCard } from './ProductPanels';
import type { ProductDetail } from './types';

/** Product detail: identity, live stock position, reordering, locations and history. */
export function ProductFormPage() {
  const { id } = useParams();
  const product = useProduct(id);
  const detail = product.data;
  usePageMeta(detail?.name ?? 'Product', detail ? `${detail.sku}${detail.category ? ` · ${detail.category.name}` : ''}` : 'Product details');

  if (!id) return <Navigate to="/products?new=1" replace />;
  if (product.isLoading) return <DetailSkeleton />;
  if (product.error || !detail) {
    return (
      <Card>
        <ErrorState title="Couldn't open this product" message={product.error?.message} onRetry={() => product.refetch()} />
      </Card>
    );
  }
  return <ProductDetailView key={detail.id} detail={detail} />;
}

function ProductDetailView({ detail }: { detail: ProductDetail }) {
  const navigate = useNavigate();
  const toast = useToast();
  const breakdown = useStockBreakdown(detail.id);
  const archive = useArchiveProduct();
  const [editing, setEditing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const b = breakdown.data;
  const qty = (n: number | undefined) => (n === undefined ? '—' : `${formatQty(n)} ${detail.uom}`);
  const onHand = b?.onHand ?? detail.locations.reduce((s, l) => s + l.qty, 0);

  const onArchive = async () => {
    setArchiveError(null);
    try {
      await archive.mutateAsync(detail.id);
      toast.success('Product archived', detail.name);
      navigate('/products', { replace: true });
    } catch (e) {
      setArchiveError((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/products" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden /> All products
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
            Edit details
          </Button>
          {detail.isActive && (
            <Button variant="outline" icon={<Archive className="h-4 w-4" />} onClick={() => setConfirmArchive(true)}>
              Archive product
            </Button>
          )}
        </div>
      </div>

      {!detail.isActive && (
        <Notice tone="info">This product is archived: it is hidden from stock lists and pickers. Its stock history is kept.</Notice>
      )}
      {archiveError && <Notice tone="danger">{archiveError}</Notice>}

      <Card tone="dove" className="flex flex-wrap items-center gap-6">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-[18px] bg-raspberry text-[20px] font-bold uppercase text-ondark" aria-hidden>
          {detail.name.slice(0, 2)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-[24px] font-bold leading-8 tracking-tight text-ink">{detail.name}</h2>
            {!detail.isActive && <Badge tone="neutral">Archived</Badge>}
          </div>
          <p className="mt-1 text-[13px] text-ink-2">
            <span className="font-mono">{detail.sku}</span> · {detail.category?.name ?? 'No category'} · per {detail.uom}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[12px] font-medium text-ink-2">Stock value</p>
          <p className="tabular text-[24px] font-bold leading-8 tracking-tight text-ink">{formatMoney(onHand * detail.unitCost)}</p>
        </div>
      </Card>

      <Card>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 xl:grid-cols-5">
          <Metric label="On hand" value={qty(b?.onHand ?? onHand)} />
          <Metric label="Reserved" value={qty(b?.reserved)} hint="Open deliveries" />
          <Metric label="Free to use" value={qty(b?.freeToUse)} tone={b && b.freeToUse < 0 ? 'danger' : 'default'} />
          <Metric label="Incoming" value={qty(b?.incoming)} hint="Open receipts" tone={b && b.incoming > 0 ? 'success' : 'default'} />
          <Metric label="Forecast" value={qty(b?.forecast)} hint="On hand + incoming − reserved" />
        </div>
        {breakdown.isError && <p className="mt-4 text-[12.5px] text-ink-2">Live reserved and incoming figures are unavailable right now.</p>}
      </Card>

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <LocationsCard locations={detail.locations} uom={detail.uom} />
          <ProductMovesCard productId={detail.id} uom={detail.uom} />
        </div>
        <div className="space-y-6 xl:col-span-4">
          <Card>
            <h2 className="mb-2 text-title text-ink">Details</h2>
            <dl className="divide-y divide-sienna/[0.06]">
              <DetailRow label="SKU">
                <span className="font-mono">{detail.sku}</span>
              </DetailRow>
              <DetailRow label="Category">{detail.category?.name ?? '—'}</DetailRow>
              <DetailRow label="Unit of measure">{detail.uom}</DetailRow>
              <DetailRow label="Per unit cost">{formatMoney(detail.unitCost)}</DetailRow>
              <DetailRow label="Added">{formatDate(detail.createdAt)}</DetailRow>
              <DetailRow label="Last updated">{formatDate(detail.updatedAt)}</DetailRow>
            </dl>
          </Card>
          <ReorderRuleCard productId={detail.id} rule={detail.reorderRule} onHand={b?.onHand} uom={detail.uom} />
          <OpenDocsCard reservedBy={b?.reservedBy} incomingFrom={b?.incomingFrom} uom={detail.uom} loading={breakdown.isLoading} error={breakdown.error?.message} />
        </div>
      </div>

      <ProductSheet open={editing} onClose={() => setEditing(false)} product={detail} onSaved={() => {
        setEditing(false);
        toast.success('Product updated');
      }} />

      <Modal
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        title="Archive this product?"
        description="It will be hidden from stock lists and pickers. Its stock history is kept."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmArchive(false)}>
              Keep
            </Button>
            <Button variant="danger" loading={archive.isPending} onClick={onArchive}>
              Archive
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] text-ink-2">
          <span className="font-semibold text-ink">{detail.name}</span> currently has {formatQty(onHand)} {detail.uom} on hand.
        </p>
      </Modal>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy>
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-28 w-full rounded-card" />
      <Skeleton className="h-24 w-full rounded-card" />
      <div className="grid gap-6 xl:grid-cols-12">
        <Skeleton className="h-64 rounded-card xl:col-span-8" />
        <Skeleton className="h-64 rounded-card xl:col-span-4" />
      </div>
    </div>
  );
}
