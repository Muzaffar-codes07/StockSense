import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';

// Minimal working login so the app is usable end-to-end.
// Role 1 extends with sign-up + OTP reset; Role 2 polishes the design.
export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@stocksense.dev');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('accessToken', data.accessToken);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center">
      <form onSubmit={handleSubmit} className="w-80 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-brand-600">StockSense</h1>
        {error && <p className="rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}
        <input
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
        />
        <input
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
