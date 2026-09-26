import { useState, type FormEvent } from 'react';
import { Table, type Column } from '@/components/ui';
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from './hooks';
import type { Category } from './types';

const input =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none';
const link = 'text-sm font-medium text-brand-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline';

export function CategoriesPanel() {
  const categories = useCategories();
  const create = useCreateCategory();
  const rename = useUpdateCategory();
  const remove = useDeleteCategory();
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
    if (await run(() => create.mutateAsync(name.trim()))) setName('');
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
            className={input}
            value={editing.name}
            onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRename();
              if (e.key === 'Escape') setEditing(null);
            }}
          />
        ) : (
          c.name
        ),
    },
    { key: 'productCount', header: 'Products' },
    {
      key: 'actions',
      header: '',
      render: (c) =>
        editing?.id === c.id ? (
          <span className="flex gap-3">
            <button type="button" className={link} onClick={onRename}>Save</button>
            <button type="button" className={link} onClick={() => setEditing(null)}>Cancel</button>
          </span>
        ) : (
          <span className="flex gap-3">
            <button type="button" className={link} onClick={() => setEditing({ id: c.id, name: c.name })}>
              Rename
            </button>
            <button
              type="button"
              className={link}
              disabled={c.productCount > 0}
              title={c.productCount > 0 ? 'Move its products to another category first' : undefined}
              onClick={() => run(() => remove.mutateAsync(c.id))}
            >
              Delete
            </button>
          </span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <form onSubmit={onAdd} className="flex gap-2" noValidate>
        <input
          aria-label="New category name"
          placeholder="New category name"
          className={`${input} w-64`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
        />
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Add category
        </button>
      </form>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <Table
        columns={columns}
        rows={categories.data ?? []}
        empty={categories.isLoading ? 'Loading…' : 'No categories yet'}
      />
    </div>
  );
}
