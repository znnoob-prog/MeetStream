import { useState } from 'react';
import { AlertTriangle, ShieldCheck, X } from 'lucide-react';
import { PendingConfirmation } from '../types/meet';

interface ConfirmActionModalProps {
  confirmation: PendingConfirmation | null;
  onClose: () => void;
}

export function ConfirmActionModal({
  confirmation,
  onClose,
}: ConfirmActionModalProps) {
  const [submitting, setSubmitting] = useState(false);

  if (!confirmation) return null;

  const isDanger = confirmation.tone === 'danger';

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await confirmation.onConfirm();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                isDanger
                  ? 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400'
                  : 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
              }`}
            >
              {isDanger ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2
                id="confirm-modal-title"
                className="text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                {confirmation.title}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {confirmation.description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label="Close confirmation dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {confirmation.affectedDetails.length > 0 && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Changes to apply ({confirmation.affectedDetails.length})
            </p>
            <ul className="mt-2 space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
              {confirmation.affectedDetails.map((detail, idx) => (
                <li key={idx} className="font-mono leading-relaxed">
                  {detail}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className={`whitespace-nowrap shrink-0 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700 focus-visible:outline-red-600'
                : 'bg-blue-600 hover:bg-blue-700 focus-visible:outline-blue-600'
            }`}
          >
            {submitting ? 'Applying...' : confirmation.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
