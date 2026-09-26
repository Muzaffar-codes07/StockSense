import { QueryClient } from '@tanstack/react-query';

// Central TanStack Query client. Real-time feel via refetch-on-focus and a
// short stale time; swap to WebSocket invalidation once Role 1 wires it up.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});
