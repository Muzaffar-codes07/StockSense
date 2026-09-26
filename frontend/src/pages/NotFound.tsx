import { Compass } from 'lucide-react';
import { ButtonLink, Card, EmptyState, usePageMeta } from '@/components/ui';

export function NotFound() {
  usePageMeta('Page not found');
  return (
    <Card>
      <EmptyState
        icon={Compass}
        title="This page doesn't exist"
        description="The link may be old or mistyped. Head back to the dashboard or use search (⌘K) to jump anywhere."
        action={<ButtonLink to="/">Go to dashboard</ButtonLink>}
      />
    </Card>
  );
}
