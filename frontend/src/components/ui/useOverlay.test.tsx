import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useOverlay } from './useOverlay';

function Overlay({ label, close }: { label: string; close: () => void }) {
  const ref = useOverlay<HTMLDivElement>(true, close);
  return <div ref={ref} role="dialog" aria-label={label} tabIndex={-1}><button>Action</button></div>;
}

function Nested() {
  const [sheet, setSheet] = useState(true);
  const [confirmation, setConfirmation] = useState(true);
  return <>
    {sheet && <Overlay label="Document" close={() => setSheet(false)} />}
    {confirmation && <Overlay label="Confirm" close={() => setConfirmation(false)} />}
  </>;
}

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

describe('nested overlays', () => {
  it('Escape closes only the confirmation, retaining the sheet and its scroll lock', () => {
    document.body.style.overflow = 'auto';
    render(<Nested />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Confirm' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Document' })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('auto');
  });

  it('restores scrolling when navigation unmounts the whole overlay stack', () => {
    document.body.style.overflow = 'scroll';
    const view = render(<Nested />);
    expect(document.body.style.overflow).toBe('hidden');
    view.unmount();
    expect(document.body.style.overflow).toBe('scroll');
  });
});
