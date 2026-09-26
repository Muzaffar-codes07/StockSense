import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Boxes, History, ShieldCheck } from 'lucide-react';
import { login, requestResetCode, resetPassword, signUp } from '@/lib/auth';
import { Button, FormField, LogoMark, Notice, friendlyError } from '@/components/ui';

type Mode = 'signin' | 'signup' | 'forgot' | 'reset';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Login() {
  const [params, setParams] = useSearchParams();
  const mode = (params.get('mode') as Mode) || 'signin';
  const setMode = (m: Mode) => setParams(m === 'signin' ? {} : { mode: m });

  return (
    <div className="flex min-h-full items-stretch p-3 lg:p-4">
      <div className="flex w-full overflow-hidden rounded-shell bg-surface shadow-[0_30px_80px_rgb(22_15_12/0.12)]">
        <BrandPanel />
        <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-12">
          <div className="w-full max-w-[380px]">
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <LogoMark />
              <span className="text-[18px] font-bold tracking-tight">StockSense</span>
            </div>
            {mode === 'signup' ? (
              <SignUpForm onSwitch={setMode} />
            ) : mode === 'forgot' || mode === 'reset' ? (
              <ResetFlow onSwitch={setMode} />
            ) : (
              <SignInForm onSwitch={setMode} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BrandPanel() {
  const points: Array<{ icon: typeof Boxes; title: string; text: string }> = [
    { icon: Boxes, title: 'Stock you can trust', text: 'Every quantity is derived from an append-only ledger.' },
    { icon: History, title: 'Full movement history', text: 'Receipts, deliveries, transfers and counts — all traceable.' },
    { icon: ShieldCheck, title: 'Safe by design', text: 'Stock can never go negative, even under concurrent use.' },
  ];
  return (
    <aside className="relative hidden w-[44%] max-w-[560px] flex-col justify-between overflow-hidden bg-raspberry p-10 text-ondark lg:flex">
      {/* Structural grid lines — the subtle warehouse motif. */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]" aria-hidden>
        <defs>
          <pattern id="grid" width="56" height="56" patternUnits="userSpaceOnUse">
            <path d="M56 0H0V56" fill="none" stroke="white" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      <div className="pointer-events-none absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-sienna/60 blur-[90px]" aria-hidden />

      <div className="relative flex items-center gap-3">
        <LogoMark />
        <div>
          <p className="text-[18px] font-bold tracking-tight">StockSense</p>
          <p className="text-[12px] text-ondark/55">Inventory Control</p>
        </div>
      </div>

      <div className="relative">
        <h2 className="max-w-[380px] text-[36px] font-bold leading-[42px] tracking-[-0.035em]">
          Every unit, accounted for.
        </h2>
        <p className="mt-4 max-w-[360px] text-[15px] leading-6 text-ondark/65">
          Receive, move, deliver and count inventory across every warehouse — with numbers that always add up.
        </p>
        <ul className="mt-10 space-y-5">
          {points.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-white/[0.07] ring-1 ring-inset ring-white/[0.08]">
                <Icon className="h-[18px] w-[18px] text-dove" aria-hidden />
              </span>
              <span>
                <span className="block text-[14px] font-semibold">{title}</span>
                <span className="block text-[13px] text-ondark/55">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="relative text-[12px] text-ondark/40">© StockSense</p>
    </aside>
  );
}

function Heading({ title, subtitle }: { title: string; subtitle: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-display text-ink">{title}</h1>
      <p className="mt-2 text-[14px] text-ink-2">{subtitle}</p>
    </div>
  );
}

function useSubmit() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setLoading(true);
    try {
      await fn();
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : 'Something went wrong'));
    } finally {
      setLoading(false);
    }
  };
  return { error, setError, loading, run };
}

function SignInForm({ onSwitch }: { onSwitch: (m: Mode) => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { error, setError, loading, run } = useSubmit();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL.test(email)) return setError('Enter a valid email address.');
    if (!password) return setError('Enter your password.');
    run(async () => {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Heading title="Welcome back" subtitle="Sign in to your inventory workspace." />
      {error && <Notice tone="danger">{error}</Notice>}
      <FormField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
      <div>
        <FormField label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        <button type="button" onClick={() => onSwitch('forgot')} className="mt-2 text-[13px] font-medium text-sienna hover:underline">
          Forgot password?
        </button>
      </div>
      <Button type="submit" size="lg" loading={loading} className="w-full">
        Sign in <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>
      {import.meta.env.DEV && (
        <button
          type="button"
          onClick={() => {
            setEmail('admin@stocksense.dev');
            setPassword('password123');
          }}
          className="w-full text-center text-[12px] text-ink-2 hover:text-ink"
        >
          Use demo account
        </button>
      )}
      <p className="pt-2 text-center text-[13px] text-ink-2">
        New to StockSense?{' '}
        <button type="button" onClick={() => onSwitch('signup')} className="font-semibold text-sienna hover:underline">
          Create an account
        </button>
      </p>
    </form>
  );
}

function SignUpForm({ onSwitch }: { onSwitch: (m: Mode) => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { error, setError, loading, run } = useSubmit();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError('Enter your name (at least 2 characters).');
    if (!EMAIL.test(email)) return setError('Enter a valid email address.');
    if (password.length < 8) return setError('Use a password of at least 8 characters.');
    run(async () => {
      await signUp(name.trim(), email.trim(), password);
      navigate('/', { replace: true });
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Heading title="Create your account" subtitle="New accounts start with warehouse staff access." />
      {error && <Notice tone="danger">{error}</Notice>}
      <FormField label="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Lee" />
      <FormField label="Work email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
      <FormField
        label="Password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        hint="At least 8 characters."
      />
      <Button type="submit" size="lg" loading={loading} className="w-full">
        Create account
      </Button>
      <p className="pt-2 text-center text-[13px] text-ink-2">
        Already have an account?{' '}
        <button type="button" onClick={() => onSwitch('signin')} className="font-semibold text-sienna hover:underline">
          Sign in
        </button>
      </p>
    </form>
  );
}

function ResetFlow({ onSwitch }: { onSwitch: (m: Mode) => void }) {
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [devOtp, setDevOtp] = useState<string | undefined>();
  const { error, setError, loading, run } = useSubmit();

  const onRequest = (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL.test(email)) return setError('Enter a valid email address.');
    run(async () => {
      const res = await requestResetCode(email.trim());
      setDevOtp(res.devOtp);
      setStep('reset');
    });
  };

  const onReset = (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError('Enter the 6-digit code.');
    if (password.length < 8) return setError('Use a password of at least 8 characters.');
    run(async () => {
      await resetPassword(email.trim(), code, password);
      setStep('done');
    });
  };

  const back = (
    <button type="button" onClick={() => onSwitch('signin')} className="mb-8 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Back to sign in
    </button>
  );

  if (step === 'done') {
    return (
      <div className="space-y-5">
        <Heading title="Password updated" subtitle="You can now sign in with your new password." />
        <Button size="lg" className="w-full" onClick={() => onSwitch('signin')}>
          Continue to sign in
        </Button>
      </div>
    );
  }

  if (step === 'reset') {
    return (
      <form onSubmit={onReset} noValidate className="space-y-5">
        {back}
        <Heading title="Check your code" subtitle={<>If <strong className="text-ink">{email}</strong> has an account, a 6-digit code is on its way. It expires in 10 minutes.</>} />
        {devOtp && (
          <Notice tone="info">
            Development build — your code is <strong className="font-mono tracking-wider">{devOtp}</strong>
          </Notice>
        )}
        {error && <Notice tone="danger">{error}</Notice>}
        <FormField
          label="6-digit code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className="[&_input]:font-mono [&_input]:tracking-[0.4em]"
        />
        <FormField label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} hint="At least 8 characters." />
        <Button type="submit" size="lg" loading={loading} className="w-full">
          Reset password
        </Button>
        <button type="button" onClick={() => setStep('request')} className="w-full text-center text-[13px] font-medium text-ink-2 hover:text-ink">
          Send a new code
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={onRequest} noValidate className="space-y-5">
      {back}
      <Heading title="Reset your password" subtitle="We'll send a one-time code to your email." />
      {error && <Notice tone="danger">{error}</Notice>}
      <FormField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
      <Button type="submit" size="lg" loading={loading} className="w-full">
        Send code
      </Button>
    </form>
  );
}
