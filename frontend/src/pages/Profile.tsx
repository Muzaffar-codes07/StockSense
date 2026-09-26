import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { Avatar, Badge, Button, Card, CardHeader, DetailRow, ErrorState, Skeleton, usePageMeta } from '@/components/ui';
import { getCurrentUser, ROLE_LABEL, signOut } from '@/lib/auth';
import { formatDate } from '@/lib/format';

const ROLE_SUMMARY = {
  ADMIN: 'Full access, including every manager permission.',
  MANAGER: 'Manages the catalogue, reorder rules, warehouses and locations, plus all warehouse operations.',
  STAFF: 'Runs day-to-day warehouse operations: receipts, deliveries, transfers and counts.',
} as const;

export function Profile() {
  usePageMeta('My Profile', 'Your account and access.');
  // Same key as the shell's session check, so this reads the cached user.
  const me = useQuery({ queryKey: ['auth', 'me'], queryFn: getCurrentUser });
  const user = me.data;

  if (me.isLoading) {
    return (
      <div className="grid gap-6 xl:grid-cols-3">
        <Skeleton className="h-64 rounded-card xl:col-span-2" />
        <Skeleton className="h-64 rounded-card" />
      </div>
    );
  }
  if (me.isError || !user) {
    return (
      <Card>
        <ErrorState title="Couldn't load your profile" message={me.error?.message} onRetry={() => me.refetch()} />
      </Card>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <div className="mb-6 flex flex-wrap items-center gap-5">
          <Avatar name={user.name} size="lg" />
          <div className="min-w-0 flex-1 basis-40">
            <h2 className="truncate text-[24px] font-bold leading-8 tracking-tight text-ink">{user.name}</h2>
            <p className="truncate text-[13.5px] text-ink-2">{user.email}</p>
          </div>
          {user.role && <Badge tone="info">{ROLE_LABEL[user.role]}</Badge>}
        </div>
        <dl className="divide-y divide-sienna/[0.06]">
          <DetailRow label="Full name">{user.name}</DetailRow>
          <DetailRow label="Email">{user.email}</DetailRow>
          <DetailRow label="Role">{user.role ? ROLE_LABEL[user.role] : '—'}</DetailRow>
          <DetailRow label="Member since">{formatDate(user.createdAt)}</DetailRow>
        </dl>
        <p className="mt-4 text-[12.5px] text-ink-2">Name and email changes aren't available in the app yet. Ask an administrator if they need updating.</p>
      </Card>

      <div className="space-y-6">
        <Card tone="dove">
          <CardHeader title="Access" subtitle={user.role ? ROLE_SUMMARY[user.role] : 'Role information is unavailable.'} />
          <Link to="/settings?tab=workspace" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-sienna hover:underline">
            <ShieldCheck className="h-4 w-4" aria-hidden /> See roles & permissions
          </Link>
        </Card>
        <Card>
          <CardHeader title="Security" subtitle="Reset your password with a one-time code." />
          <div className="flex flex-wrap gap-2">
            <Link
              to="/login?mode=forgot"
              className="inline-flex h-10 items-center gap-2 rounded-control px-4 text-sm font-medium text-ink ring-1 ring-inset ring-sienna/[0.12] hover:bg-dove/15"
            >
              <KeyRound className="h-4 w-4" aria-hidden /> Reset password
            </Link>
            <Button variant="dark" icon={<LogOut className="h-4 w-4" />} onClick={signOut}>
              Log out
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
