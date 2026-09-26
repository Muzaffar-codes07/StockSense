import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, Menu as MenuIcon, Search, Settings, User } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ROLE_LABEL, signOut, type CurrentUser } from '@/lib/auth';
import { Avatar, IconButton, StockStatusBadge, usePageMetaValue } from '@/components/ui';
import { useStockAlerts } from '@/features/stock/hooks';
import { formatQty } from '@/features/stock/format';

interface TopBarProps {
  user?: CurrentUser;
  onOpenSearch: () => void;
  onOpenNav: () => void;
}

export function TopBar({ user, onOpenSearch, onOpenNav }: TopBarProps) {
  const { title, subtitle, eyebrow } = usePageMetaValue();
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pb-6 pt-5 sm:flex-nowrap sm:px-8 sm:pt-7">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <IconButton label="Open navigation" onClick={onOpenNav} className="mt-0.5 md:hidden">
          <MenuIcon className="h-[18px] w-[18px]" />
        </IconButton>
        <div className="min-w-0">
          {eyebrow && <div className="mb-1.5 text-[13px] text-ink-2">{eyebrow}</div>}
          <h1 className="break-words pt-1 text-[22px] font-bold leading-7 tracking-[-0.03em] text-ink sm:truncate sm:pt-0 sm:text-display">{title}</h1>
          {subtitle && <p className="mt-1 hidden text-[14px] text-ink-2 sm:block">{subtitle}</p>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenSearch}
          className="hidden h-10 w-64 items-center gap-2.5 rounded-full bg-canvas pl-4 pr-2 text-[13px] text-ink-2 transition-colors hover:bg-dove/25 xl:flex"
        >
          <Search className="h-4 w-4" aria-hidden />
          <span className="flex-1 text-left">Search products, pages…</span>
          <kbd className="rounded-[7px] bg-surface px-1.5 py-0.5 font-sans text-[11px] font-medium text-ink-2 shadow-[0_1px_0_rgb(22_15_12/0.08)]">
            ⌘K
          </kbd>
        </button>
        <IconButton label="Search (Ctrl+K)" onClick={onOpenSearch} className="xl:hidden">
          <Search className="h-[18px] w-[18px]" />
        </IconButton>
        <Notifications />
        <UserMenu user={user} />
      </div>
      {/* Phones: the subtitle gets its own full-width line under the title row. */}
      {subtitle && <p className="w-full text-[13.5px] text-ink-2 sm:hidden">{subtitle}</p>}
    </header>
  );
}

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  return { open, setOpen, ref };
}

/** Real alerts only: products the ledger shows as low or out of stock. */
function Notifications() {
  const { open, setOpen, ref } = usePopover();
  const alerts = useStockAlerts();
  const rows = Array.isArray(alerts.data) ? alerts.data : [];
  const count = rows.length;

  return (
    <div ref={ref} className="relative">
      <IconButton
        label={count > 0 ? `Notifications: ${count} stock alerts` : 'Notifications'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-[18px] w-[18px]" />
        {count > 0 && (
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger ring-2 ring-canvas" aria-hidden />
        )}
      </IconButton>
      {open && (
        <div className="glass-strong absolute -right-[58px] top-full z-30 mt-2 w-[calc(100vw-72px)] rounded-card-sm p-2 shadow-pop animate-pop-in sm:right-0 sm:w-[340px]">
          <div className="flex items-center justify-between px-3 pb-2 pt-2">
            <p className="text-[14px] font-semibold text-ink">Stock alerts</p>
            <span className="text-[12px] text-ink-2">{count} item{count === 1 ? '' : 's'}</span>
          </div>
          {alerts.isLoading ? (
            <p className="px-3 py-6 text-center text-[13px] text-ink-2">Checking stock…</p>
          ) : alerts.isError ? (
            <p className="px-3 py-6 text-center text-[13px] text-ink-2">Alerts are unavailable right now.</p>
          ) : count === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-ink-2">Everything is above its reorder point.</p>
          ) : (
            <ul className="scroll-quiet max-h-[320px] overflow-y-auto">
              {rows.slice(0, 8).map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/products/${r.id}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between gap-3 rounded-[12px] px-3 py-2.5 transition-colors hover:bg-dove/15"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-ink">{r.name}</span>
                      <span className="block text-[12px] text-ink-2">
                        {formatQty(r.onHand)} {r.uom} on hand
                        {r.minQty !== null && ` · min ${formatQty(r.minQty)}`}
                      </span>
                    </span>
                    <StockStatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/stock?status=LOW"
            onClick={() => setOpen(false)}
            className="mt-1 block rounded-[12px] px-3 py-2.5 text-center text-[13px] font-medium text-sienna transition-colors hover:bg-dove/15"
          >
            Review stock levels
          </Link>
        </div>
      )}
    </div>
  );
}

function UserMenu({ user }: { user?: CurrentUser }) {
  const { open, setOpen, ref } = usePopover();
  const navigate = useNavigate();
  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 items-center gap-2 rounded-full bg-canvas py-1 pl-1 pr-3 transition-colors hover:bg-dove/25"
      >
        <Avatar name={user?.name} />
        <span className="hidden max-w-[120px] truncate text-[13px] font-semibold text-ink sm:block">{user?.name ?? 'Account'}</span>
        <ChevronDown className={cn('hidden h-3.5 w-3.5 text-ink-2 transition-transform sm:block', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div role="menu" className="glass-strong absolute right-0 top-full z-30 mt-2 w-[248px] rounded-card-sm p-1.5 shadow-pop animate-pop-in">
          <div className="flex items-center gap-3 px-3 pb-3 pt-2.5">
            <Avatar name={user?.name} />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-ink">{user?.name}</p>
              <p className="truncate text-[12px] text-ink-2">{user?.email}</p>
            </div>
          </div>
          {user?.role && (
            <p className="mx-3 mb-2 inline-flex rounded-full bg-sienna/[0.07] px-2.5 py-1 text-[11px] font-semibold text-sienna">
              {ROLE_LABEL[user.role]}
            </p>
          )}
          <div className="border-t hairline pt-1.5">
            <MenuRow icon={User} label="My profile" onClick={() => go('/profile')} />
            <MenuRow icon={Settings} label="Settings" onClick={() => go('/settings')} />
            <MenuRow icon={LogOut} label="Log out" onClick={signOut} danger />
          </div>
        </div>
      )}
    </div>
  );
}

function MenuRow({ icon: Icon, label, onClick, danger }: { icon: typeof User; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-[13px] font-medium transition-colors',
        danger ? 'text-danger-fg hover:bg-danger/[0.07]' : 'text-ink hover:bg-dove/20',
      )}
    >
      <Icon className="h-4 w-4 opacity-80" aria-hidden />
      {label}
    </button>
  );
}
