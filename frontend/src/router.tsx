import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { Login } from './pages/Login';
import {
  Dashboard,
  Operations,
  MoveHistory,
  Settings,
  Profile,
} from './pages/placeholders';
import { ProductsPage } from './features/products/ProductsPage';
import { ProductFormPage } from './features/products/ProductFormPage';
import { StockPage } from './features/stock/StockPage';

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
      { path: 'stock', element: <StockPage /> },
      { path: 'operations', element: <Operations /> },
      { path: 'move-history', element: <MoveHistory /> },
      { path: 'settings', element: <Settings /> },
      { path: 'profile', element: <Profile /> },
    ],
  },
]);
