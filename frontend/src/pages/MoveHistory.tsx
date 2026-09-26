import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMoveHistory, MoveType, StockMove } from '../lib/operations';
import { Table, Column } from '../components/ui/Table';
import { FilterBar } from '../components/ui/FilterBar';
import { ArrowRight, History } from 'lucide-react';

export function MoveHistory() {
  const [search, setSearch] = useState('');
  const [moveTypeFilter, setMoveTypeFilter] = useState<MoveType | ''>('');

  const { data: movesData, isLoading } = useQuery({
    queryKey: ['operations', 'moves', moveTypeFilter, search],
    queryFn: () =>
      getMoveHistory({
        moveType: moveTypeFilter || undefined,
        search: search || undefined,
        pageSize: 50,
      }),
  });

  const moveTypeBadge = (type: MoveType) => {
    const map: Record<MoveType, { bg: string; text: string; label: string }> = {
      RECEIPT: { bg: 'bg-emerald-50 border-emerald-200 text-emerald-800', text: 'text-emerald-800', label: 'Receipt' },
      DELIVERY: { bg: 'bg-rose-50 border-rose-200 text-rose-800', text: 'text-rose-800', label: 'Delivery' },
      INTERNAL: { bg: 'bg-blue-50 border-blue-200 text-blue-800', text: 'text-blue-800', label: 'Internal' },
      ADJUSTMENT: { bg: 'bg-purple-50 border-purple-200 text-purple-800', text: 'text-purple-800', label: 'Adjustment' },
    };
    const style = map[type] ?? map.RECEIPT;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${style.bg}`}>
        {style.label}
      </span>
    );
  };

  const columns: Column<StockMove>[] = [
    {
      key: 'doneAt',
      header: 'Date & Time',
      render: (m) => (
        <div>
          <div className="text-xs font-medium text-slate-800">
            {new Date(m.doneAt).toLocaleDateString()}
          </div>
          <div className="text-[11px] text-slate-400">
            {new Date(m.doneAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      ),
    },
    {
      key: 'doc',
      header: 'Document Reference',
      render: (m) => (
        <div>
          <span className="font-mono text-xs font-semibold text-slate-700">
            {m.docType ? m.docType.toUpperCase() : 'MOVE'}
          </span>
          {m.docId && (
            <div className="text-[11px] font-mono text-slate-400">
              #{m.docId.slice(0, 8)}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'product',
      header: 'Product',
      render: (m) => (
        <div>
          <div className="text-xs font-semibold text-slate-800">{m.product?.name ?? '—'}</div>
          <div className="text-[11px] font-mono text-slate-500">{m.product?.sku}</div>
        </div>
      ),
    },
    {
      key: 'movement',
      header: 'From → To Location',
      render: (m) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
          <span>{m.fromLocation?.name ?? 'External Vendor / Opening'}</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          <span>{m.toLocation?.name ?? 'Customer Delivery'}</span>
        </div>
      ),
    },
    {
      key: 'qty',
      header: 'Quantity',
      render: (m) => {
        const qtyNum = Number(m.qty);
        let qtyColor = 'text-slate-700 font-semibold';
        let prefix = '';
        if (m.moveType === 'RECEIPT') {
          qtyColor = 'text-emerald-700 font-bold';
          prefix = '+';
        } else if (m.moveType === 'DELIVERY') {
          qtyColor = 'text-rose-700 font-bold';
          prefix = '-';
        }

        return (
          <span className={`text-xs ${qtyColor}`}>
            {prefix}{qtyNum} {m.product?.uom ?? 'units'}
          </span>
        );
      },
    },
    {
      key: 'moveType',
      header: 'Type',
      render: (m) => moveTypeBadge(m.moveType),
    },
    {
      key: 'user',
      header: 'Operator',
      render: (m) => (
        <span className="text-xs text-slate-600">
          {m.createdBy?.name ?? m.createdBy?.email ?? 'System'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Stock Ledger / Move History</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Complete, immutable audit trail of every stock change across all warehouses and locations.
          </p>
        </div>
      </div>

      <FilterBar search={search} onSearch={setSearch}>
        <select
          value={moveTypeFilter}
          onChange={(e) => setMoveTypeFilter(e.target.value as MoveType | '')}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-indigo-500 focus:outline-none"
        >
          <option value="">All Movement Types</option>
          <option value="RECEIPT">Receipt (+ Inflow)</option>
          <option value="DELIVERY">Delivery (− Outflow)</option>
          <option value="INTERNAL">Internal Transfer</option>
          <option value="ADJUSTMENT">Inventory Adjustment</option>
        </select>
      </FilterBar>

      <Table
        columns={columns}
        rows={movesData?.data ?? []}
        empty={isLoading ? 'Loading stock ledger movements...' : 'No ledger movements found'}
      />
    </div>
  );
}
