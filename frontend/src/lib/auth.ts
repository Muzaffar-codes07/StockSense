import { api } from './api';
import { queryClient } from './queryClient';

export type UserRole = 'ADMIN' | 'MANAGER' | 'STAFF';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role?: UserRole;
  createdAt: string;
}

export const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: 'Administrator',
  MANAGER: 'Inventory Manager',
  STAFF: 'Warehouse Staff',
};

// Role 1's login-state check: GET /auth/me returns the user when the stored
// JWT is still valid, or rejects (401) when it's missing/expired.
export async function getCurrentUser(): Promise<CurrentUser> {
  const res = await api.get<CurrentUser>('/auth/me');
  return res.data;
}

export async function login(email: string, password: string) {
  const { data } = await api.post<{ accessToken: string }>('/auth/login', { email, password });
  localStorage.setItem('accessToken', data.accessToken);
}

export async function signUp(name: string, email: string, password: string) {
  const { data } = await api.post<{ accessToken: string }>('/auth/signup', { name, email, password });
  localStorage.setItem('accessToken', data.accessToken);
}

/** Returns `devOtp` only in non-production builds of the API (for demos). */
export async function requestResetCode(email: string) {
  const { data } = await api.post<{ message: string; devOtp?: string }>('/auth/request-otp', { email });
  return data;
}

export async function resetPassword(email: string, otpCode: string, newPassword: string) {
  const { data } = await api.post<{ message: string }>('/auth/reset-password', { email, otpCode, newPassword });
  return data;
}

export function signOut() {
  localStorage.removeItem('accessToken');
  queryClient.clear();
  window.location.href = '/login';
}
