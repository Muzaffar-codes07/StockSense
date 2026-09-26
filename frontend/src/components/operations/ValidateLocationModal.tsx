import { useState, useEffect, type FormEvent } from 'react';
import { Modal } from '../ui/Modal';
import { getLocations, LocationItem } from '../../lib/operations';

interface Props {
  open: boolean;
  title: string;
  locationLabel: string;
  initialLocationId?: string;
  onClose: () => void;
  onConfirm: (locationId: string) => Promise<void>;
}

export function ValidateLocationModal({
  open,
  title,
  locationLabel,
  initialLocationId,
  onClose,
  onConfirm,
}: Props) {
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [locationId, setLocationId] = useState(initialLocationId ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setLocationId(initialLocationId ?? '');
      getLocations()
        .then((locs) => {
          setLocations(locs);
          if (!initialLocationId && locs.length > 0) {
            setLocationId(locs[0].id);
          }
        })
        .catch(() => {});
    }
  }, [open, initialLocationId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!locationId) {
      setError('Please select a location');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onConfirm(locationId);
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Validation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200">
            {error}
          </div>
        )}

        <p className="text-sm text-slate-600">
          Validating this document will automatically post stock movements to the immutable Stock Ledger.
        </p>

        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
            {locationLabel}
          </label>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none bg-white"
            required
          >
            <option value="">Select Location</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.warehouse?.name ? `${loc.warehouse.name} - ` : ''}
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? 'Validating...' : 'Confirm & Validate'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
