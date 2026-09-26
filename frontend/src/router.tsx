import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { Login } from './pages/Login';
import Dashboard from './pages/Dashboard';
import { Settings, Profile } from './pages/placeholders';
import { Operations } from './pages/Operations';
import { MoveHistory } from './pages/MoveHistory';
import { ProductsPage } from './features/products/ProductsPage';
import { ProductFormPage } from './features/products/ProductFormPage';
import { StockPageWithAdjust } from './features/stock/UpdateStockModal';

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'products/new', element: <ProductFormPage /> },
      { path: 'products/:id', element: <ProductFormPage /> },
      { path: 'stock', element: <StockPageWithAdjust /> },
      { path: 'operations', element: <Operations /> },
      { path: 'move-history', element: <MoveHistory /> },
      { path: 'settings', element: <Settings /> },
      { path: 'profile', element: <Profile /> },
    ],
  },
]);
