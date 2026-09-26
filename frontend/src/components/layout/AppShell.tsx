import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from '@/lib/auth';
import { LogoMark, PageMetaProvider } from '@/components/ui';
import { useOverlay } from '@/components/ui/useOverlay';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { CommandPalette } from './CommandPalette';

// App shell: canvas → dark rounded frame → icon rail + white working panel,
// gated behind a valid session. GET /auth/me confirms the stored JWT is still
// good; if it isn't (401, or no token at all), we bounce to /login instead of
// leaving every nested screen to fail its own API calls silently.
export function AppShell() {
  const hasToken = Boolean(localStorage.getItem('accessToken'));

  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getCurrentUser,
    enabled: hasToken,
    retry: false,
  });

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Each route starts at the top of the working panel.
  useEffect(() => {
    document.getElementById('main')?.scrollTo({ top: 0 });
  }, [pathname]);

  if (!hasToken || isError) {
    localStorage.removeItem('accessToken');
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4" role="status">
        <LogoMark className="animate-pulse" />
        <p className="text-[13px] text-ink-2">Checking session…</p>
      </div>
    );
  }

  return (
    <PageMetaProvider>
      <a
        href="#main"
        className="sr-only z-[70] rounded-full bg-raspberry px-4 py-2 text-[13px] font-medium text-ondark focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <div className="flex h-full p-2 sm:p-3 lg:p-4">
        <div className="flex h-full w-full overflow-hidden rounded-[28px] bg-raspberry p-2 shadow-[0_30px_80px_rgb(22_15_12/0.22)] sm:rounded-shell sm:p-2.5">
          <div className="hidden md:flex">
            <Sidebar user={user} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[22px] bg-surface sm:rounded-panel">
            <TopBar user={user} onOpenSearch={() => setPaletteOpen(true)} onOpenNav={() => setNavOpen(true)} />
            <main id="main" tabIndex={-1} className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-5 pb-10 outline-none sm:px-8">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <MobileNav open={navOpen} onClose={() => setNavOpen(false)} user={user} />
    </PageMetaProvider>
  );
}

function MobileNav({ open, onClose, user }: { open: boolean; onClose: () => void; user?: Awaited<ReturnType<typeof getCurrentUser>> }) {
  const panelRef = useOverlay<HTMLDivElement>(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 bg-raspberry/40 animate-fade-in md:hidden" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Navigation" className="h-full w-[260px] rounded-r-[28px] bg-raspberry animate-sheet-in">
        <Sidebar user={user} variant="drawer" onNavigate={onClose} />
      </div>
    </div>,
    document.body,
  );
}
