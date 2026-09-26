import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ROLE_LABEL, signOut, type CurrentUser } from '@/lib/auth';
import { Avatar, LogoMark } from '@/components/ui';
import { MAIN_NAV, SETTINGS_NAV, type NavItem } from './nav';

const STORAGE_KEY = 'ss.rail.expanded';

function readExpanded() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

interface SidebarProps {
  user?: CurrentUser;
  /** Mobile drawer always shows labels and closes itself on navigation. */
  variant?: 'rail' | 'drawer';
  onNavigate?: () => void;
}

// The dark navigation rail — the strongest StockSense identity element. Narrow
// and icon-led by default (like the reference); expands to show labels and the
// Operations sub-pages.
export function Sidebar({ user, variant = 'rail', onNavigate }: SidebarProps) {
  const [stored, setStored] = useState(readExpanded);
  const expanded = variant === 'drawer' || stored;
  const { pathname } = useLocation();

  const toggle = () => {
    setStored((v) => {
      try {
        localStorage.setItem(STORAGE_KEY, v ? '0' : '1');
      } catch {
        /* storage unavailable (private mode) — keep it in memory */
      }
      return !v;
    });
  };

  return (
    <aside
      aria-label="Primary"
      className={cn(
        'flex h-full shrink-0 flex-col py-3 text-ondark transition-[width] duration-300 ease-soft',
        expanded ? 'w-[228px] px-3' : 'w-[76px] items-center',
      )}
    >
      <Link
        to="/"
        onClick={onNavigate}
        aria-label="StockSense home"
        className={cn('flex items-center gap-3 rounded-[16px] p-1', expanded && 'px-1.5')}
      >
        <LogoMark />
        {expanded && (
          <span className="leading-none">
            <span className="block text-[16px] font-bold tracking-tight text-ondark">StockSense</span>
            <span className="mt-1 block text-[11px] font-medium text-ondark/55">Inventory Control</span>
          </span>
        )}
      </Link>

      <nav className="flex flex-1 flex-col justify-center py-6">
        <ul className={cn('flex flex-col', expanded ? 'gap-1' : 'items-center gap-2')}>
          {MAIN_NAV.map((item) => (
            <RailItem key={item.to} item={item} expanded={expanded} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </ul>
      </nav>

      <div className={cn('flex flex-col gap-2', !expanded && 'items-center')}>
        <ul className={cn('flex flex-col', !expanded && 'items-center')}>
          <RailItem item={SETTINGS_NAV} expanded={expanded} pathname={pathname} onNavigate={onNavigate} />
        </ul>

        <div className={cn('my-1 h-px bg-white/[0.07]', expanded ? 'mx-2' : 'w-8')} />

        <NavLink
          to="/profile"
          onClick={onNavigate}
          aria-label="My profile"
          className={({ isActive }) =>
            cn(
              'group relative flex items-center gap-3 rounded-[14px] transition-colors',
              expanded ? 'px-2 py-2' : 'p-1.5',
              isActive ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05]',
            )
          }
        >
          <Avatar name={user?.name} size={expanded ? 'md' : 'sm'} />
          {expanded ? (
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-ondark">{user?.name ?? 'Account'}</span>
              <span className="block truncate text-[11px] text-ondark/55">
                {user?.role ? ROLE_LABEL[user.role] : user?.email}
              </span>
            </span>
          ) : (
            <Tooltip>My profile</Tooltip>
          )}
        </NavLink>

        <button
          type="button"
          onClick={signOut}
          aria-label="Log out"
          className={cn(
            'group relative flex items-center gap-3 rounded-[14px] text-ondark/60 transition-colors hover:bg-white/[0.05] hover:text-ondark',
            expanded ? 'px-3 py-2.5 text-[13px] font-medium' : 'h-11 w-11 justify-center',
          )}
        >
          <LogOut className="h-[19px] w-[19px]" aria-hidden />
          {expanded ? 'Log out' : <Tooltip>Log out</Tooltip>}
        </button>

        {variant === 'rail' && (
          <button
            type="button"
            onClick={toggle}
            aria-label={expanded ? 'Collapse navigation' : 'Expand navigation'}
            aria-expanded={expanded}
            className={cn(
              'group relative flex items-center gap-3 rounded-[14px] text-ondark/40 transition-colors hover:bg-white/[0.05] hover:text-ondark/80',
              expanded ? 'px-3 py-2 text-[12px]' : 'h-9 w-11 justify-center',
            )}
          >
            {expanded ? <PanelLeftClose className="h-4 w-4" aria-hidden /> : <PanelLeftOpen className="h-4 w-4" aria-hidden />}
            {expanded ? 'Collapse' : <Tooltip>Expand navigation</Tooltip>}
          </button>
        )}
      </div>
    </aside>
  );
}

function RailItem({
  item,
  expanded,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  expanded: boolean;
  pathname: string;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const sectionActive = item.children ? pathname.startsWith(item.to) : false;
  return (
    <li className={cn(expanded && 'w-full')}>
      <NavLink
        to={item.to}
        end={item.end}
        onClick={onNavigate}
        aria-label={item.label}
        className={({ isActive }) => {
          const active = isActive || sectionActive;
          return cn(
            'group relative flex items-center transition-[background-color,color] duration-200 ease-soft',
            expanded ? 'h-11 w-full gap-3 rounded-[14px] px-3 text-[13.5px] font-medium' : 'h-12 w-12 justify-center rounded-[16px]',
            active
              ? 'bg-[linear-gradient(150deg,rgb(192_186_179/0.16),rgb(192_186_179/0.07))] text-white ring-1 ring-inset ring-white/[0.06]'
              : 'text-ondark/55 hover:bg-white/[0.05] hover:text-ondark',
          );
        }}
      >
        {({ isActive }) => {
          const active = isActive || sectionActive;
          return (
            <>
              {/* Reference-style active marker on the rail's outer edge. */}
              <span
                aria-hidden
                className={cn(
                  'absolute top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-dove transition-opacity duration-200',
                  expanded ? '-left-3' : '-left-[14px]',
                  active ? 'opacity-100' : 'opacity-0',
                )}
              />
              <Icon className="h-[20px] w-[20px] shrink-0" strokeWidth={active ? 2.1 : 1.8} aria-hidden />
              {expanded ? item.label : <Tooltip>{item.label}</Tooltip>}
            </>
          );
        }}
      </NavLink>

      {expanded && item.children && sectionActive && (
        <ul className="ml-[22px] mt-1 space-y-0.5 border-l border-white/[0.08] pl-3">
          {item.children.map((child) => (
            <li key={child.to}>
              <NavLink
                to={child.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex h-8 items-center rounded-[10px] px-2.5 text-[13px] transition-colors',
                    isActive ? 'bg-white/[0.07] font-medium text-white' : 'text-ondark/55 hover:text-ondark',
                  )
                }
              >
                {child.label}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** Label that appears beside a collapsed rail icon on hover / keyboard focus. */
function Tooltip({ children }: { children: string }) {
  return (
    <span
      role="tooltip"
      className="glass-dark pointer-events-none absolute left-full top-1/2 z-40 ml-3 -translate-y-1/2 whitespace-nowrap rounded-[10px] px-2.5 py-1.5 text-[12px] font-medium text-ondark opacity-0 shadow-pop transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {children}
    </span>
  );
}
