import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { Login } from './pages/Login';
import type { OperationKind } from './features/operations/config';

// Keep page code behind its route while preserving keyed operation screens.
const operationRoute = (kind: OperationKind) => async () => {
  const { OperationListPage } = await import('./features/operations/OperationListPage');
  return { element: <OperationListPage key={kind} kind={kind} /> };
};

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, lazy: async () => ({ Component: (await import('./pages/Dashboard')).default }) },
      { path: 'products', lazy: async () => ({ Component: (await import('./features/products/ProductsPage')).ProductsPage }) },
      { path: 'products/new', element: <Navigate to="/products?new=1" replace /> },
      { path: 'products/:id', lazy: async () => ({ Component: (await import('./features/products/ProductFormPage')).ProductFormPage }) },
      { path: 'stock', lazy: async () => ({ Component: (await import('./features/stock/UpdateStockModal')).StockPageWithAdjust }) },
      { path: 'operations', lazy: async () => ({ Component: (await import('./pages/Operations')).Operations }) },
      { path: 'operations/receipts', lazy: operationRoute('receipt') },
      { path: 'operations/deliveries', lazy: operationRoute('delivery') },
      { path: 'operations/transfers', lazy: operationRoute('transfer') },
      { path: 'operations/adjustments', lazy: operationRoute('adjustment') },
      { path: 'move-history', lazy: async () => ({ Component: (await import('./pages/MoveHistory')).MoveHistory }) },
      { path: 'warehouses', lazy: async () => ({ Component: (await import('./pages/Warehouses')).Warehouses }) },
      { path: 'reports', lazy: async () => ({ Component: (await import('./pages/Reports')).Reports }) },
      { path: 'settings', lazy: async () => ({ Component: (await import('./pages/Settings')).Settings }) },
      { path: 'profile', lazy: async () => ({ Component: (await import('./pages/Profile')).Profile }) },
      { path: '*', lazy: async () => ({ Component: (await import('./pages/NotFound')).NotFound }) },
    ],
  },
]);
