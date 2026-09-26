import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

// App shell: persistent sidebar + routed content area.
export function AppShell() {
  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
