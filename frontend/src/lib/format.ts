const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const shortDateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' });

const valid = (d: Date) => !Number.isNaN(d.getTime());

export const formatDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return valid(d) ? dateFmt.format(d) : '—';
};

export const formatShortDate = (d: Date) => shortDateFmt.format(d);

export const formatTime = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return valid(d) ? timeFmt.format(d) : '';
};

export const formatDateTime = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return valid(d) ? `${dateFmt.format(d)}, ${timeFmt.format(d)}` : '—';
};

/** "just now", "5 min ago", "3 h ago", "2 d ago", then a date. */
export function timeAgo(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!valid(d)) return '—';
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  if (s < 7 * 86_400) return `${Math.round(s / 86_400)} d ago`;
  return dateFmt.format(d);
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Local YYYY-MM-DD for a Date (for day bucketing and date inputs). */
export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
