import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button, FormField, Notice, SelectField, SideSheet, Skeleton } from '@/components/ui';
import { useLocations } from '@/features/stock/hooks';
import { useCategories, useCreateProduct, useUpdateProduct } from './hooks';
import { productSchema, toProductInput, type ProductFormValues } from './schemas';
import { SKU_TAKEN, UOMS, type ProductDetail, type Uom } from './types';

export const PRODUCT_FORM_ID = 'product-form';

interface ProductFormProps {
  product?: ProductDetail;
  /** Called after a successful save with the saved product's id. */
  onSaved: (id: string) => void;
  onSubmittingChange?: (submitting: boolean) => void;
}

/**
 * Create / edit a product. Rendered inside a side sheet; the sheet footer's
 * submit button targets this form by id. The category <select> is uncontrolled,
 * so the parent must only mount this once categories have loaded.
 */
export function ProductForm({ product, onSaved, onSubmittingChange }: ProductFormProps) {
  const categories = useCategories();
  const locations = useLocations();
  const create = useCreateProduct();
  const update = useUpdateProduct(product?.id ?? '');
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
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
    onSubmittingChange?.(true);
    try {
      if (product) {
        await update.mutateAsync(toProductInput(values, false));
        onSaved(product.id);
      } else {
        const created = await create.mutateAsync(toProductInput(values, true));
        onSaved(created.id);
      }
    } catch (e) {
      const message = (e as Error).message;
      if (message === SKU_TAKEN) setError('sku', { message: 'That SKU is already used by another product.' });
      else setFormError(message);
    } finally {
      onSubmittingChange?.(false);
    }
  });

  return (
    <form id={PRODUCT_FORM_ID} key={product?.id ?? 'new'} onSubmit={onSubmit} className="space-y-6" noValidate>
      <fieldset className="space-y-4">
        <legend className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">Identity</legend>
        <FormField label="Name" placeholder="e.g. Steel Rods 12mm" data-autofocus {...register('name')} error={errors.name?.message} />
        <FormField
          label="SKU / Code"
          placeholder="STEEL-012"
          hint="Letters, digits, dot, dash or underscore. Must be unique."
          autoCapitalize="characters"
          spellCheck={false}
          {...register('sku')}
          error={errors.sku?.message}
        />
        <SelectField
          label="Category"
          placeholder="No category"
          options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          {...register('categoryId')}
          error={errors.categoryId?.message}
        />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">Unit & cost</legend>
        <SelectField label="Unit of measure" options={UOMS.map((u) => ({ value: u, label: u }))} {...register('uom')} error={errors.uom?.message} />
        <FormField
          label="Per unit cost (₹)"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          {...register('unitCost')}
          error={errors.unitCost?.message}
        />
      </fieldset>

      {!product && (
        <fieldset className="grid gap-4 rounded-card-sm bg-canvas p-4 sm:grid-cols-2">
          <legend className="sr-only">Initial stock</legend>
          <div className="sm:col-span-2">
            <p className="text-[13.5px] font-semibold text-ink">Initial stock (optional)</p>
            <p className="mt-0.5 text-[12.5px] text-ink-2">Recorded in the ledger as an opening balance.</p>
          </div>
          <FormField label="Quantity on hand" type="number" step="0.001" min="0" inputMode="decimal" {...register('initialQty')} error={errors.initialQty?.message} />
          <SelectField
            label="Location"
            placeholder="Main stock location (default)"
            options={(locations.data ?? []).map((l) => ({ value: l.id, label: `${l.warehouseName} / ${l.name}` }))}
            {...register('initialLocationId')}
          />
        </fieldset>
      )}

      {formError && <Notice tone="danger">{formError}</Notice>}
    </form>
  );
}

interface ProductSheetProps {
  open: boolean;
  onClose: () => void;
  product?: ProductDetail;
  onSaved: (id: string) => void;
}

/** New / edit product in a right-side sheet. */
export function ProductSheet({ open, onClose, product, onSaved }: ProductSheetProps) {
  const categories = useCategories();
  const [submitting, setSubmitting] = useState(false);
  return (
    <SideSheet
      open={open}
      onClose={onClose}
      width="md"
      eyebrow={product ? product.sku : 'Catalogue'}
      title={product ? 'Edit product' : 'New product'}
      subtitle={product ? 'Changes apply to every document that uses this product.' : 'Add a product to your inventory catalogue.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={PRODUCT_FORM_ID} loading={submitting} disabled={categories.isLoading}>
            {product ? 'Save changes' : 'Create product'}
          </Button>
        </>
      }
    >
      {categories.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-2/3" />
        </div>
      ) : (
        <ProductForm product={product} onSaved={onSaved} onSubmittingChange={setSubmitting} />
      )}
    </SideSheet>
  );
}
