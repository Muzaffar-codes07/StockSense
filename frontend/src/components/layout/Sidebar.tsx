import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Boxes,
  ArrowLeftRight,
  History,
  Settings,
  User,
  LogOut,
} from 'lucide-react';
import type { CurrentUser } from '../../lib/auth';
import { queryClient } from '../../lib/queryClient';

// Left sidebar nav (matches the problem-statement navigation).
// Role 2 owns styling/polish; Roles 3 & 4 fill the routed pages.
const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/stock', label: 'Stock', icon: Boxes },
  { to: '/operations', label: 'Operations', icon: ArrowLeftRight },
  { to: '/move-history', label: 'Move History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  user?: CurrentUser;
}

export function Sidebar({ user }: SidebarProps) {
  return (
    <aside className="flex w-60 flex-col border-r border-slate-200 bg-white">
      <div className="px-5 py-4 text-lg font-bold text-brand-600">StockSense</div>
      <nav className="flex-1 space-y-1 px-3">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-1 border-t border-slate-200 px-3 py-3">
        {user && (
          <div className="truncate px-3 pb-1 text-xs text-slate-400" title={user.email}>
            Signed in as <span className="font-medium text-slate-600">{user.name}</span>
          </div>
        )}
        <NavLink
          to="/profile"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
        >
          <User size={18} /> My Profile
        </NavLink>
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem('accessToken');
            queryClient.clear();
            window.location.href = '/login';
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
        >
          <LogOut size={18} /> Logout
        </button>
      </div>
    </aside>
  );
}
