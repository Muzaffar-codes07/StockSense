import { useState, type FormEvent } from 'react';
import { Check, Pencil, Plus, Tags, Trash2, X } from 'lucide-react';
import { Button, EmptyState, IconButton, inputClass, Notice, Table, useToast, type Column } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from './hooks';
import type { Category } from './types';

export function CategoriesPanel() {
  const categories = useCategories();
  const create = useCreateCategory();
  const rename = useUpdateCategory();
  const remove = useDeleteCategory();
  const toast = useToast();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Category name is required');
    if (await run(() => create.mutateAsync(name.trim()))) {
      toast.success('Category added', name.trim());
      setName('');
    }
  };

  const onRename = async () => {
    if (!editing) return;
    if (!editing.name.trim()) return setError('Category name is required');
    if (await run(() => rename.mutateAsync({ id: editing.id, name: editing.name.trim() }))) setEditing(null);
  };

  const columns: Column<Category>[] = [
    {
      key: 'name',
      header: 'Category',
      render: (c) =>
        editing?.id === c.id ? (
          <input
            autoFocus
            aria-label="Category name"
            className={cn(inputClass, 'h-9 max-w-xs')}
            value={editing.name}
            onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRename();
              if (e.key === 'Escape') setEditing(null);
            }}
          />
        ) : (
          <span className="font-semibold text-ink">{c.name}</span>
        ),
    },
    {
      key: 'productCount',
      header: 'Products',
      align: 'right',
      render: (c) => <span className="tabular text-ink-2">{c.productCount}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-32',
      render: (c) =>
        editing?.id === c.id ? (
          <span className="inline-flex gap-1">
            <IconButton tone="plain" label="Save name" size="sm" onClick={onRename}>
              <Check className="h-4 w-4" />
            </IconButton>
            <IconButton tone="plain" label="Cancel rename" size="sm" onClick={() => setEditing(null)}>
              <X className="h-4 w-4" />
            </IconButton>
          </span>
        ) : (
          <span className="inline-flex gap-1">
            <IconButton tone="plain" label={`Rename ${c.name}`} size="sm" onClick={() => setEditing({ id: c.id, name: c.name })}>
              <Pencil className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton tone="plain"
              label={c.productCount > 0 ? 'Move its products to another category first' : `Delete ${c.name}`}
              size="sm"
              disabled={c.productCount > 0}
              onClick={() => run(() => remove.mutateAsync(c.id)).then((ok) => ok && toast.success('Category deleted', c.name))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </IconButton>
          </span>
        ),
    },
  ];

  return (
    <div className="space-y-5">
      <form onSubmit={onAdd} className="flex flex-wrap items-center gap-2" noValidate>
        <input
          aria-label="New category name"
          placeholder="New category name"
          className={cn(inputClass, 'h-10 w-full max-w-xs')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
        />
        <Button type="submit" loading={create.isPending} icon={<Plus className="h-4 w-4" />}>
          Add category
        </Button>
      </form>
      {error && <Notice tone="danger">{error}</Notice>}
      <Table
        caption="Categories"
        columns={columns}
        rows={Array.isArray(categories.data) ? categories.data : []}
        loading={categories.isLoading}
        error={categories.error?.message}
        onRetry={() => categories.refetch()}
        empty={<EmptyState compact icon={Tags} title="No categories yet" description="Group products so they're easier to filter." />}
      />
    </div>
  );
}
