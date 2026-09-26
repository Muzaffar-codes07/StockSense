import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getReceipts,
  updateReceiptStatus,
  validateReceipt,
  cancelReceipt,
  getDeliveries,
  updateDeliveryStatus,
  validateDelivery,
  cancelDelivery,
  getTransfers,
  updateTransferStatus,
  validateTransfer,
  cancelTransfer,
  getAdjustments,
  validateAdjustment,
  cancelAdjustment,
  DocStatus,
  Receipt,
  Delivery,
  Transfer,
  Adjustment,
} from '../lib/operations';
import { Table, Column } from '../components/ui/Table';
import { FilterBar } from '../components/ui/FilterBar';
import { DocStatusBadge } from '../components/operations/DocStatusBadge';
import { CreateReceiptModal } from '../components/operations/CreateReceiptModal';
import { CreateDeliveryModal } from '../components/operations/CreateDeliveryModal';
import { CreateTransferModal } from '../components/operations/CreateTransferModal';
import { CreateAdjustmentModal } from '../components/operations/CreateAdjustmentModal';
import { ValidateLocationModal } from '../components/operations/ValidateLocationModal';
import {
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  SlidersHorizontal,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';

type TabType = 'receipts' | 'deliveries' | 'transfers' | 'adjustments';

export function Operations() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('receipts');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DocStatus | ''>('');

  // Modals state
  const [openReceiptModal, setOpenReceiptModal] = useState(false);
  const [openDeliveryModal, setOpenDeliveryModal] = useState(false);
  const [openTransferModal, setOpenTransferModal] = useState(false);
  const [openAdjustmentModal, setOpenAdjustmentModal] = useState(false);

  // Validate location modal state
  const [validateTarget, setValidateTarget] = useState<{
    id: string;
    type: 'receipt' | 'delivery';
  } | null>(null);

  // Query Receipts
  const { data: receiptsData, isLoading: receiptsLoading } = useQuery({
    queryKey: ['operations', 'receipts', statusFilter, search],
    queryFn: () => getReceipts({ status: statusFilter, search: search || undefined }),
    enabled: activeTab === 'receipts',
  });

  // Query Deliveries
  const { data: deliveriesData, isLoading: deliveriesLoading } = useQuery({
    queryKey: ['operations', 'deliveries', statusFilter, search],
    queryFn: () => getDeliveries({ status: statusFilter, search: search || undefined }),
    enabled: activeTab === 'deliveries',
  });

  // Query Transfers
  const { data: transfersData, isLoading: transfersLoading } = useQuery({
    queryKey: ['operations', 'transfers', statusFilter, search],
    queryFn: () => getTransfers({ status: statusFilter, search: search || undefined }),
    enabled: activeTab === 'transfers',
  });

  // Query Adjustments
  const { data: adjustmentsData, isLoading: adjustmentsLoading } = useQuery({
    queryKey: ['operations', 'adjustments', statusFilter, search],
    queryFn: () => getAdjustments({ status: statusFilter, search: search || undefined }),
    enabled: activeTab === 'adjustments',
  });

  const refreshCurrent = () => {
    queryClient.invalidateQueries({ queryKey: ['operations'] });
  };

  // Receipt Actions
  const handleMarkReceiptReady = async (id: string) => {
    await updateReceiptStatus(id, 'READY');
    refreshCurrent();
  };

  const handleCancelReceipt = async (id: string) => {
    if (confirm('Are you sure you want to cancel this receipt?')) {
      await cancelReceipt(id);
      refreshCurrent();
    }
  };

  // Delivery Actions
  const handleMarkDeliveryReady = async (id: string) => {
    await updateDeliveryStatus(id, 'READY');
    refreshCurrent();
  };

  const handleCancelDelivery = async (id: string) => {
    if (confirm('Are you sure you want to cancel this delivery?')) {
      await cancelDelivery(id);
      refreshCurrent();
    }
  };

  // Transfer Actions
  const handleMarkTransferReady = async (id: string) => {
    await updateTransferStatus(id, 'READY');
    refreshCurrent();
  };

  const handleValidateTransfer = async (id: string) => {
    await validateTransfer(id);
    refreshCurrent();
  };

  const handleCancelTransfer = async (id: string) => {
    if (confirm('Are you sure you want to cancel this transfer?')) {
      await cancelTransfer(id);
      refreshCurrent();
    }
  };

  // Adjustment Actions
  const handleValidateAdjustment = async (id: string) => {
    await validateAdjustment(id);
    refreshCurrent();
  };

  const handleCancelAdjustment = async (id: string) => {
    if (confirm('Are you sure you want to cancel this adjustment?')) {
      await cancelAdjustment(id);
      refreshCurrent();
    }
  };

  const handleConfirmValidateLocation = async (locationId: string) => {
    if (!validateTarget) return;
    if (validateTarget.type === 'receipt') {
      await validateReceipt(validateTarget.id, locationId);
    } else {
      await validateDelivery(validateTarget.id, locationId);
    }
    refreshCurrent();
  };

  // Columns for Receipts
  const receiptColumns: Column<Receipt>[] = [
    {
      key: 'id',
      header: 'Reference',
      render: (r) => (
        <div>
          <span className="font-mono text-xs font-semibold text-slate-800">
            REC-{r.id.slice(0, 8).toUpperCase()}
          </span>
          <div className="text-[11px] text-slate-400">
            {new Date(r.createdAt).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      key: 'partner',
      header: 'Vendor / Supplier',
      render: (r) => (
        <span className="font-medium text-slate-700">
          {r.partner?.name ?? '—'}
        </span>
      ),
    },
    {
      key: 'lines',
      header: 'Products',
      render: (r) => (
        <div className="space-y-0.5">
          {r.lines.map((l) => (
            <div key={l.id} className="text-xs text-slate-600">
              <span className="font-semibold text-slate-800">{Number(l.qty)}</span> {l.product?.uom ?? 'units'} × {l.product?.name ?? 'Product'}
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <DocStatusBadge status={r.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => {
        if (r.status === 'DONE' || r.status === 'CANCELED') {
          return <span className="text-xs text-slate-400">Completed</span>;
        }
        return (
          <div className="flex items-center gap-1.5">
            {r.status === 'DRAFT' && (
              <button
                onClick={() => handleMarkReceiptReady(r.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md"
                title="Mark as Ready"
              >
                <Clock className="w-3.5 h-3.5" /> Ready
              </button>
            )}
            <button
              onClick={() => setValidateTarget({ id: r.id, type: 'receipt' })}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Validate
            </button>
            <button
              onClick={() => handleCancelReceipt(r.id)}
              className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
              title="Cancel Receipt"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        );
      },
    },
  ];

  // Columns for Deliveries
  const deliveryColumns: Column<Delivery>[] = [
    {
      key: 'id',
      header: 'Reference',
      render: (d) => (
        <div>
          <span className="font-mono text-xs font-semibold text-slate-800">
            DEL-{d.id.slice(0, 8).toUpperCase()}
          </span>
          <div className="text-[11px] text-slate-400">
            {new Date(d.createdAt).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      key: 'partner',
      header: 'Customer',
      render: (d) => (
        <span className="font-medium text-slate-700">
          {d.partner?.name ?? '—'}
        </span>
      ),
    },
    {
      key: 'lines',
      header: 'Items to Pick/Pack',
      render: (d) => (
        <div className="space-y-0.5">
          {d.lines.map((l) => (
            <div key={l.id} className="text-xs text-slate-600">
              <span className="font-semibold text-slate-800">{Number(l.qty)}</span> {l.product?.uom ?? 'units'} × {l.product?.name ?? 'Product'}
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (d) => <DocStatusBadge status={d.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (d) => {
        if (d.status === 'DONE' || d.status === 'CANCELED') {
          return <span className="text-xs text-slate-400">Completed</span>;
        }
        return (
          <div className="flex items-center gap-1.5">
            {d.status === 'DRAFT' && (
              <button
                onClick={() => handleMarkDeliveryReady(d.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md"
                title="Mark Pick & Pack Ready"
              >
                <Clock className="w-3.5 h-3.5" /> Ready
              </button>
            )}
            <button
              onClick={() => setValidateTarget({ id: d.id, type: 'delivery' })}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Validate
            </button>
            <button
              onClick={() => handleCancelDelivery(d.id)}
              className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
              title="Cancel Delivery"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        );
      },
    },
  ];

  // Columns for Transfers
  const transferColumns: Column<Transfer>[] = [
    {
      key: 'id',
      header: 'Reference',
      render: (t) => (
        <div>
          <span className="font-mono text-xs font-semibold text-slate-800">
            TRF-{t.id.slice(0, 8).toUpperCase()}
          </span>
          <div className="text-[11px] text-slate-400">
            {new Date(t.createdAt).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      key: 'lines',
      header: 'Transferred Items & Path',
      render: (t) => (
        <div className="space-y-1">
          {t.lines.map((l) => (
            <div key={l.id} className="text-xs text-slate-600">
              <span className="font-semibold text-slate-800">{Number(l.qty)}</span> {l.product?.uom ?? 'units'} × {l.product?.name ?? 'Product'}:
              <span className="ml-1 text-slate-500 font-mono text-[11px]">
                {l.fromLocation?.name} → {l.toLocation?.name}
              </span>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (t) => <DocStatusBadge status={t.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (t) => {
        if (t.status === 'DONE' || t.status === 'CANCELED') {
          return <span className="text-xs text-slate-400">Completed</span>;
        }
        return (
          <div className="flex items-center gap-1.5">
            {t.status === 'DRAFT' && (
              <button
                onClick={() => handleMarkTransferReady(t.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md"
              >
                <Clock className="w-3.5 h-3.5" /> Ready
              </button>
            )}
            <button
              onClick={() => handleValidateTransfer(t.id)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Validate
            </button>
            <button
              onClick={() => handleCancelTransfer(t.id)}
              className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
              title="Cancel Transfer"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        );
      },
    },
  ];

  // Columns for Adjustments
  const adjustmentColumns: Column<Adjustment>[] = [
    {
      key: 'id',
      header: 'Reference',
      render: (a) => (
        <div>
          <span className="font-mono text-xs font-semibold text-slate-800">
            ADJ-{a.id.slice(0, 8).toUpperCase()}
          </span>
          <div className="text-[11px] text-slate-400">
            {new Date(a.createdAt).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (a) => (
        <span className="font-medium text-slate-700">
          {a.location?.name ?? '—'}
        </span>
      ),
    },
    {
      key: 'lines',
      header: 'Products & Discrepancies',
      render: (a) => (
        <div className="space-y-1">
          {a.lines.map((l) => {
            const diff = Number(l.diff);
            return (
              <div key={l.id} className="text-xs text-slate-600 flex items-center gap-2">
                <span>{l.product?.name ?? 'Product'}</span>
                <span className="text-[11px] text-slate-400">
                  (Rec: {Number(l.recordedQty)} | Count: {Number(l.countedQty)})
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                    diff > 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : diff < 0
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {diff > 0 ? `+${diff}` : `${diff}`}
                </span>
              </div>
            );
          })}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (a) => <DocStatusBadge status={a.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (a) => {
        if (a.status === 'DONE' || a.status === 'CANCELED') {
          return <span className="text-xs text-slate-400">Completed</span>;
        }
        return (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleValidateAdjustment(a.id)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Validate Diff
            </button>
            <button
              onClick={() => handleCancelAdjustment(a.id)}
              className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
              title="Cancel Adjustment"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Warehouse Operations</h1>
          <p className="text-sm text-slate-500">
            Manage receipts, customer deliveries, internal transfers, and inventory reconciliations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'receipts' && (
            <button
              onClick={() => setOpenReceiptModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm"
            >
              <Plus className="w-4 h-4" /> New Receipt
            </button>
          )}
          {activeTab === 'deliveries' && (
            <button
              onClick={() => setOpenDeliveryModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm"
            >
              <Plus className="w-4 h-4" /> New Delivery
            </button>
          )}
          {activeTab === 'transfers' && (
            <button
              onClick={() => setOpenTransferModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm"
            >
              <Plus className="w-4 h-4" /> New Transfer
            </button>
          )}
          {activeTab === 'adjustments' && (
            <button
              onClick={() => setOpenAdjustmentModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm"
            >
              <Plus className="w-4 h-4" /> New Adjustment
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('receipts')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'receipts'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" /> Receipts (Incoming)
        </button>
        <button
          onClick={() => setActiveTab('deliveries')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'deliveries'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" /> Delivery Orders (Outgoing)
        </button>
        <button
          onClick={() => setActiveTab('transfers')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'transfers'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <ArrowLeftRight className="w-4 h-4" /> Internal Transfers
        </button>
        <button
          onClick={() => setActiveTab('adjustments')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'adjustments'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" /> Inventory Adjustments
        </button>
      </div>

      {/* Filter Bar */}
      <FilterBar search={search} onSearch={setSearch}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as DocStatus | '')}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-indigo-500 focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="WAITING">Waiting</option>
          <option value="READY">Ready</option>
          <option value="DONE">Done</option>
          <option value="CANCELED">Canceled</option>
        </select>
      </FilterBar>

      {/* Tables based on active tab */}
      {activeTab === 'receipts' && (
        <Table
          columns={receiptColumns as any}
          rows={(receiptsData?.data ?? []) as any}
          empty={receiptsLoading ? 'Loading receipts...' : 'No receipts found'}
        />
      )}

      {activeTab === 'deliveries' && (
        <Table
          columns={deliveryColumns as any}
          rows={(deliveriesData?.data ?? []) as any}
          empty={deliveriesLoading ? 'Loading deliveries...' : 'No deliveries found'}
        />
      )}

      {activeTab === 'transfers' && (
        <Table
          columns={transferColumns as any}
          rows={(transfersData?.data ?? []) as any}
          empty={transfersLoading ? 'Loading transfers...' : 'No transfers found'}
        />
      )}

      {activeTab === 'adjustments' && (
        <Table
          columns={adjustmentColumns as any}
          rows={(adjustmentsData?.data ?? []) as any}
          empty={adjustmentsLoading ? 'Loading adjustments...' : 'No adjustments found'}
        />
      )}

      {/* Modals */}
      <CreateReceiptModal
        open={openReceiptModal}
        onClose={() => setOpenReceiptModal(false)}
        onSuccess={refreshCurrent}
      />
      <CreateDeliveryModal
        open={openDeliveryModal}
        onClose={() => setOpenDeliveryModal(false)}
        onSuccess={refreshCurrent}
      />
      <CreateTransferModal
        open={openTransferModal}
        onClose={() => setOpenTransferModal(false)}
        onSuccess={refreshCurrent}
      />
      <CreateAdjustmentModal
        open={openAdjustmentModal}
        onClose={() => setOpenAdjustmentModal(false)}
        onSuccess={refreshCurrent}
      />

      <ValidateLocationModal
        open={!!validateTarget}
        title={
          validateTarget?.type === 'receipt'
            ? 'Validate Goods Receipt'
            : 'Validate Goods Delivery'
        }
        locationLabel={
          validateTarget?.type === 'receipt'
            ? 'Receive Goods Into Destination Location'
            : 'Ship Goods Out Of Source Location'
        }
        onClose={() => setValidateTarget(null)}
        onConfirm={handleConfirmValidateLocation}
      />
    </div>
  );
}
