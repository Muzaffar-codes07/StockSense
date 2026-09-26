import { DocStatus } from '../../lib/operations';

interface Props {
  status: DocStatus;
}

export function DocStatusBadge({ status }: Props) {
  const styles: Record<DocStatus, { bg: string; text: string; label: string }> = {
    DRAFT: { bg: 'bg-slate-100 border-slate-200 text-slate-700', text: 'text-slate-700', label: 'Draft' },
    WAITING: { bg: 'bg-amber-50 border-amber-200 text-amber-800', text: 'text-amber-800', label: 'Waiting' },
    READY: { bg: 'bg-blue-50 border-blue-200 text-blue-800', text: 'text-blue-800', label: 'Ready' },
    DONE: { bg: 'bg-emerald-50 border-emerald-200 text-emerald-800', text: 'text-emerald-800', label: 'Done' },
    CANCELED: { bg: 'bg-rose-50 border-rose-200 text-rose-800', text: 'text-rose-800', label: 'Canceled' },
  };

  const style = styles[status] ?? styles.DRAFT;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style.bg}`}
    >
      {style.label}
    </span>
  );
}
