import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button, Modal, Notice } from '@/components/ui';
import { getLocations, type LocationItem } from '@/lib/operations';
import { FieldLabel, locationOptions, NativeSelect } from './parts';

interface Props {
  open: boolean;
  title: string;
  locationLabel: string;
  initialLocationId?: string;
  /** What validating will do, e.g. "Adds 3 lines to stock". */
  summary?: ReactNode;
  onClose: () => void;
  onConfirm: (locationId: string) => Promise<void>;
}

const FORM_ID = 'validate-location-form';

export function ValidateLocationModal({ open, title, locationLabel, initialLocationId, summary, onClose, onConfirm }: Props) {
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [locationId, setLocationId] = useState(initialLocationId ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLocationId(initialLocationId ?? '');
    getLocations()
      .then((locs) => {
        const list = Array.isArray(locs) ? locs : [];
        setLocations(list);
        if (!initialLocationId && list.length > 0) setLocationId(list[0].id);
      })
      .catch(() => setError("Couldn't load locations. Try again in a moment."));
  }, [open, initialLocationId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!locationId) return setError('Choose a location.');
    setLoading(true);
    setError(null);
    try {
      await onConfirm(locationId);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      description="Validating posts the stock movements to the ledger. This can't be undone."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} loading={loading} icon={<CheckCircle2 className="h-4 w-4" />}>
            Validate
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4" noValidate>
        {summary && <div className="rounded-card-sm bg-canvas p-4 text-[13.5px] text-ink-2">{summary}</div>}
        <div>
          <FieldLabel htmlFor={`${FORM_ID}-loc`}>{locationLabel}</FieldLabel>
          <NativeSelect id={`${FORM_ID}-loc`} value={locationId} onChange={setLocationId} placeholder="Select location" options={locationOptions(locations)} />
        </div>
        {error && <Notice tone="danger">{error}</Notice>}
      </form>
    </Modal>
  );
}
