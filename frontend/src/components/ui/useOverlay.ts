import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// A confirmation can sit above a sheet. Only the top overlay handles keys;
// scrolling stays locked until the last overlay closes, in any cleanup order.
const overlays: symbol[] = [];
let originalOverflow = '';

/**
 * Shared behaviour for modal surfaces (Modal, SideSheet, command palette):
 * Escape closes, Tab stays inside, focus returns to the trigger, and the page
 * behind stops scrolling.
 */
export function useOverlay<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const panelRef = useRef<T>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const overlay = Symbol('overlay');
    const previouslyFocused = document.activeElement as HTMLElement | null;
    if (overlays.length === 0) originalOverflow = document.body.style.overflow;
    overlays.push(overlay);
    document.body.style.overflow = 'hidden';

    // Focus the first field (or the panel) once it has rendered.
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (overlays[overlays.length - 1] !== overlay || !panel || panel.contains(document.activeElement)) return;
      const target =
        panel.querySelector<HTMLElement>('[data-autofocus]') ??
        panel.querySelector<HTMLElement>('input:not([readonly]):not([type="hidden"]), select, textarea') ??
        panel;
      target.focus({ preventScroll: true });
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (overlays[overlays.length - 1] !== overlay) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null || n === document.activeElement,
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!panelRef.current.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown);
      const wasTop = overlays[overlays.length - 1] === overlay;
      overlays.splice(overlays.indexOf(overlay), 1);
      if (overlays.length === 0) document.body.style.overflow = originalOverflow;
      if (wasTop && previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, [open]);

  return panelRef;
}
