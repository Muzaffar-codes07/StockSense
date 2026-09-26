import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  History,
  LayoutGrid,
  Package,
  Settings,
  SlidersHorizontal,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  description: string;
  children?: NavItem[];
}

export const OPERATION_NAV: NavItem[] = [
  { to: '/operations/receipts', label: 'Receipts', icon: ArrowDownLeft, description: 'Incoming goods from suppliers' },
  { to: '/operations/deliveries', label: 'Deliveries', icon: ArrowUpRight, description: 'Outgoing orders to customers' },
  { to: '/operations/transfers', label: 'Transfers', icon: ArrowLeftRight, description: 'Moves between locations' },
  { to: '/operations/adjustments', label: 'Adjustments', icon: SlidersHorizontal, description: 'Reconcile physical counts' },
];

/** The one navigation map — rail, mobile drawer and ⌘K palette all read it. */
export const MAIN_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true, description: 'What needs attention today' },
  { to: '/products', label: 'Products', icon: Package, description: 'Catalogue, categories, reorder rules' },
  { to: '/stock', label: 'Stock', icon: Boxes, description: 'On hand, reserved, forecast' },
  { to: '/operations', label: 'Operations', icon: ArrowLeftRight, description: 'Receipts, deliveries, transfers, adjustments', children: OPERATION_NAV },
  { to: '/move-history', label: 'Move History', icon: History, description: 'Every stock movement' },
  { to: '/warehouses', label: 'Warehouses', icon: Warehouse, description: 'Sites and locations' },
  { to: '/reports', label: 'Reports', icon: BarChart3, description: 'Valuation and activity' },
];

export const SETTINGS_NAV: NavItem = {
  to: '/settings',
  label: 'Settings',
  icon: Settings,
  description: 'Warehouses, locations, account',
};
