import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FormField, SelectField, Table, type Column } from '@/components/ui';
import { formatQty } from '@/features/stock/format';
import { useLocations } from '@/features/stock/hooks';
import type { LocationStock } from '@/features/stock/types';
import {
  useArchiveProduct,
  useCategories,
  useCreateProduct,
  useProduct,
  useRemoveReorderRule,
  useSetReorderRule,
  useUpdateProduct,
} from './hooks';
import {
  productSchema,
  reorderRuleSchema,
  toProductInput,
  type ProductFormValues,
  type ReorderRuleValues,
} from './schemas';
import { SKU_TAKEN, UOMS, type ProductDetail, type ReorderRule, type Uom } from './types';

const primary =
  'rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50';
const secondary =
  'rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50';
const card = 'rounded-xl border border-slate-200 bg-white p-6';

export function ProductFormPage() {
  const { id } = useParams();
  const product = useProduct(id);
  // The category <select> is uncontrolled: react-hook-form sets its value once, on
  // mount, so its options must already exist or it falls back to "No category".
  const categories = useCategories();

  if ((id && product.isLoading) || categories.isLoading)
    return <p className="text-slate-400">Loading…</p>;
  if (id && product.error)
    return <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{product.error.message}</p>;

  const detail = product.data;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/products" className="text-sm text-slate-500 hover:underline">
          Products
        </Link>
        <span className="text-slate-300">/</span>
        <h1 className="text-2xl font-semibold text-slate-800">{detail ? detail.name : 'New product'}</h1>
      </div>
      <ProductForm key={detail?.id ?? 'new'} product={detail} />
      {detail && (
        <div className="grid gap-6 lg:grid-cols-2">
          <ReorderRuleCard productId={detail.id} rule={detail.reorderRule} />
          <LocationsCard locations={detail.locations} uom={detail.uom} />
        </div>
      )}
    </div>
  );
}

function ProductForm({ product }: { product?: ProductDetail }) {
  const navigate = useNavigate();
  const categories = useCategories();
  const locations = useLocations();
  const create = useCreateProduct();
  const update = useUpdateProduct(product?.id ?? '');
  const archive = useArchiveProduct();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? '',
      sku: product?.sku ?? '',
      categoryId: product?.category?.id ?? '',
      uom: (product?.uom as Uom) ?? 'unit',
      unitCost: product?.unitCost ?? 0,
      initialQty: undefined,
      initialLocationId: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setSaved(false);
    try {
      if (product) {
        await update.mutateAsync(toProductInput(values, false));
        setSaved(true);
      } else {
        const created = await create.mutateAsync(toProductInput(values, true));
        navigate(`/products/${created.id}`, { replace: true });
      }
    } catch (e) {
      const message = (e as Error).message;
      if (message === SKU_TAKEN) setError('sku', { message });
      else setFormError(message);
    }
  });

  const onArchive = async () => {
    if (!product) return;
    try {
      await archive.mutateAsync(product.id);
      navigate('/products', { replace: true });
    } catch (e) {
      setFormError((e as Error).message);
    }
  };

  return (
    <form onSubmit={onSubmit} className={`${card} space-y-4`} noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Name" {...register('name')} error={errors.name?.message} />
        <FormField label="SKU / Code" {...register('sku')} error={errors.sku?.message} />
        <SelectField
          label="Category"
          placeholder="No category"
          options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          {...register('categoryId')}
          error={errors.categoryId?.message}
        />
        <SelectField
          label="Unit of measure"
          options={UOMS.map((u) => ({ value: u, label: u }))}
          {...register('uom')}
          error={errors.uom?.message}
        />
        <FormField
          label="Per unit cost (₹)"
          type="number"
          step="0.01"
          min="0"
          {...register('unitCost')}
          error={errors.unitCost?.message}
        />
      </div>

      {!product && (
        <fieldset className="grid gap-4 rounded-lg bg-slate-50 p-4 md:grid-cols-2">
          <legend className="px-1 text-sm font-medium text-slate-600">Initial stock (optional)</legend>
          <FormField
            label="Quantity on hand"
            type="number"
            step="0.001"
            min="0"
            {...register('initialQty')}
            error={errors.initialQty?.message}
          />
          <SelectField
            label="Location"
            placeholder="Main stock location (default)"
            options={(locations.data ?? []).map((l) => ({
              value: l.id,
              label: `${l.warehouseName} / ${l.name}`,
            }))}
            {...register('initialLocationId')}
          />
        </fieldset>
      )}

      {formError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
      {saved && <p className="text-sm text-emerald-700">Saved.</p>}

      <div className="flex items-center justify-between">
        <button type="submit" className={primary} disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : product ? 'Save changes' : 'Create product'}
        </button>
        {product &&
          (confirmArchive ? (
            <span className="flex items-center gap-2 text-sm">
              <span className="text-slate-600">Hide this product from lists? Its history is kept.</span>
              <button type="button" className="rounded-lg bg-red-600 px-3 py-2 font-medium text-white" onClick={onArchive}>
                Archive
              </button>
              <button type="button" className={secondary} onClick={() => setConfirmArchive(false)}>
                Keep
              </button>
            </span>
          ) : (
            <button type="button" className={secondary} onClick={() => setConfirmArchive(true)}>
              Archive product
            </button>
          ))}
      </div>
    </form>
  );
}

function ReorderRuleCard({ productId, rule }: { productId: string; rule: ReorderRule | null }) {
  const setRule = useSetReorderRule(productId);
  const removeRule = useRemoveReorderRule(productId);
  const [message, setMessage] = useState<string | null>(null);
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
      setMessage('Reorder rule saved.');
    } catch (e) {
      setMessage((e as Error).message);
    }
  });

  const onRemove = async () => {
    await removeRule.mutateAsync();
    reset({ minQty: 0, maxQty: undefined });
    setMessage('Reorder rule removed.');
  };

  return (
    <form onSubmit={onSubmit} className={`${card} space-y-4`} noValidate>
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Reorder rule</h2>
        <p className="text-sm text-slate-500">Flag this product as low stock at or below the minimum.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Minimum" type="number" step="0.001" min="0" {...register('minQty')} error={errors.minQty?.message} />
        <FormField label="Maximum (optional)" type="number" step="0.001" min="0" {...register('maxQty')} error={errors.maxQty?.message} />
      </div>
      {message && <p className="text-sm text-slate-600">{message}</p>}
      <div className="flex gap-2">
        <button type="submit" className={primary} disabled={isSubmitting}>
          Save rule
        </button>
        {rule && (
          <button type="button" className={secondary} onClick={onRemove}>
            Remove rule
          </button>
        )}
      </div>
    </form>
  );
}

function LocationsCard({ locations, uom }: { locations: LocationStock[]; uom: string }) {
  const columns: Column<LocationStock>[] = [
    { key: 'warehouseName', header: 'Warehouse' },
    { key: 'locationName', header: 'Location' },
    { key: 'qty', header: 'On hand', render: (l) => `${formatQty(l.qty)} ${uom}` },
  ];
  return (
    <div className={`${card} space-y-4`}>
      <h2 className="text-lg font-semibold text-slate-800">Stock per location</h2>
      <Table columns={columns} rows={locations} empty="No stock recorded yet" />
    </div>
  );
}
