import { api } from './api';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

// Role 1's login-state check: GET /auth/me returns the user when the stored
// JWT is still valid, or rejects (401) when it's missing/expired.
export async function getCurrentUser(): Promise<CurrentUser> {
  const res = await api.get<CurrentUser>('/auth/me');
  return res.data;
}
