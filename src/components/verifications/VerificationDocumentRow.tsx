import React, { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import type { VerificationRequest } from '../../types/admin';
import { getOptimizedWebpUrl } from '../../utils/imageOptimizer';
import { VerificationStatusBadge } from './VerificationStatusBadge';

interface Props {
  document: VerificationRequest;
  selected: boolean;
  onReview: () => void;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason?: string) => Promise<void>;
  onReset: (id: string) => Promise<void>;
}

export const VerificationDocumentRow: React.FC<Props> = ({ document, selected, onReview, onApprove, onReject, onReset }) => {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const decide = async (action: 'approve' | 'reject' | 'reset') => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      if (action === 'approve') await onApprove(document.id);
      else if (action === 'reset') await onReset(document.id);
      else await onReject(document.id, reason.trim() || 'Document criteria not met');
      setRejecting(false); setReason('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save this review. Please try again.');
    } finally { setBusy(false); }
  };
  return (
    <div className={`rounded-xl border p-3 ${selected ? 'border-orange-200 bg-orange-50/40' : 'border-zinc-200/70 bg-white'}`}>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onReview} aria-label={`Review ${document.documentType}`} className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200">
          <span className="flex h-12 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-100">
            {document.documentImage ? <img src={getOptimizedWebpUrl(document.documentImage, { width: 80, height: 96, quality: 'auto' })} alt="" loading="lazy" className="h-full w-full object-cover" /> : <FileText className="h-5 w-5 text-zinc-400" />}
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-zinc-900">{document.documentType}</span>
            <span className="mt-1 block text-[11px] text-zinc-500">{document.submittedDate}</span>
          </span>
        </button>
        <VerificationStatusBadge status={document.status} />
        <div className="flex flex-wrap items-center gap-2" aria-busy={busy}>
          <button type="button" onClick={onReview} className="px-2 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-950 cursor-pointer">Review</button>
          {document.status === 'VERIFIED' ? (
            <button type="button" disabled={busy} onClick={() => void decide('reset')} className="rounded-full bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-50 cursor-pointer">Re-open</button>
          ) : (
            <>
              {document.status !== 'REJECTED' && <button type="button" disabled={busy} onClick={() => { setRejecting(value => !value); setError(null); }} className="rounded-full bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50 cursor-pointer">Reject</button>}
              <button type="button" disabled={busy} onClick={() => void decide('approve')} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer">
                {busy && <Loader2 className="h-3 w-3 animate-spin" />} Approve
              </button>
            </>
          )}
        </div>
      </div>
      {document.status === 'REJECTED' && document.notes && <p className="mt-2 text-xs text-rose-700 break-words">{document.notes}</p>}
      {rejecting && (
        <form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={event => { event.preventDefault(); void decide('reject'); }}>
          <input aria-label={`Rejection reason for ${document.documentType}`} placeholder="Reason for rejection (optional)" value={reason} onChange={event => setReason(event.target.value)} disabled={busy} className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-200" />
          <button type="button" onClick={() => setRejecting(false)} disabled={busy} className="px-2 py-2 text-xs text-zinc-500 cursor-pointer">Cancel</button>
          <button type="submit" disabled={busy} className="rounded-full bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer">Confirm rejection</button>
        </form>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
    </div>
  );
};
