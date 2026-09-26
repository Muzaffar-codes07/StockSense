import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
const get = vi.mocked(api.get);

function renderAt(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/login" element={<p>login page</p>} />
          <Route path="/" element={<AppShell />}>
            <Route index element={<p>dashboard</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AppShell session gate', () => {
  beforeEach(() => {
    get.mockReset();
    localStorage.clear();
  });

  it('sends a visitor without a token to /login', async () => {
    renderAt(new QueryClient());
    expect(await screen.findByText('login page')).toBeInTheDocument();
  });

  it('lets a fresh login in even after an earlier session expired', async () => {
    const client = new QueryClient();
    // The expired session's /auth/me failure is still in the cache...
    await client.prefetchQuery({
      queryKey: ['auth', 'me'],
      queryFn: () => Promise.reject(new Error('Unauthorized')),
      retry: false,
    });
    // ...then the user logs in again and gets a new, valid token.
    localStorage.setItem('accessToken', 'new-valid-token');
    get.mockResolvedValue({ data: { id: 'u1', name: 'Admin', email: 'a@b.co', createdAt: '' } });

    renderAt(client);
    expect(await screen.findByText('dashboard')).toBeInTheDocument();
    expect(localStorage.getItem('accessToken')).toBe('new-valid-token');
  });
});
