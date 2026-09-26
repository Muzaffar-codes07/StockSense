import { Navigate, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { getCurrentUser } from '../../lib/auth';

// App shell: persistent sidebar + routed content area, gated behind a valid
// session. GET /auth/me confirms the stored JWT is still good; if it isn't
// (401, or no token at all), we bounce to /login instead of leaving every
// nested screen to fail its own API calls silently.
export function AppShell() {
  const hasToken = Boolean(localStorage.getItem('accessToken'));

  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getCurrentUser,
    enabled: hasToken,
    retry: false,
  });

  if (!hasToken || isError) {
    localStorage.removeItem('accessToken');
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Checking session…
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <Sidebar user={user} />
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
