import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import type { VerificationRequest, VerificationStatus } from '../../types/admin';
import { getOptimizedWebpUrl, isDefaultAvatar } from '../../utils/imageOptimizer';
import { ReviewImageViewer, type ReviewImageStatus } from './ReviewImageViewer';
import { VerificationStatusBadge } from './VerificationStatusBadge';

type ComparisonDocument = Partial<VerificationRequest> & {
  primaryDocumentId?: string;
  documentType: string;
  documentNumber: string;
  documentImage: string;
};

export interface IdentityComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id?: string;
    name: string;
    role: string;
    email?: string;
    contactNumber?: string;
    avatar?: string;
    barangay?: string;
    hasLguCoverage?: boolean;
    idName?: string;
  };
  document: ComparisonDocument;
  documents?: VerificationRequest[];
  onDocumentChange?: (id: string) => void;
  hasDocuments?: boolean;
  onApprove?: (documentId?: string) => void | Promise<void>;
  onReject?: (reason?: string, documentId?: string) => void | Promise<void>;
  onReset?: (documentId?: string) => void | Promise<void>;
}

/** Kept separate from the portal so the comparison UI can also be rendered in tests. */
export const IdentityComparisonContent: React.FC<IdentityComparisonModalProps> = ({
  onClose, user, document: selectedDocument, documents, onDocumentChange, hasDocuments, onApprove, onReject, onReset,
}) => {
  const dialog = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [rejectDraft, setRejectDraft] = useState<{ id: string; reason: string } | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; error: boolean; text: string } | null>(null);
  const activeId = selectedDocument.id || selectedDocument.primaryDocumentId || '';
  const noDocuments = hasDocuments === false || selectedDocument.hasDocuments === false || selectedDocument.status === 'NO_DOCUMENTS';
  const availableDocuments = documents?.length ? documents : noDocuments ? [] : [selectedDocument];
  const currentStatus: VerificationStatus = noDocuments ? 'NO_DOCUMENTS' : selectedDocument.primaryStatus || selectedDocument.status || 'PENDING / REVIEW';
  const avatarUrl = isDefaultAvatar(user.avatar) ? '' : getOptimizedWebpUrl(user.avatar, { width: 1200, quality: 'auto:good' });
  const documentUrl = getOptimizedWebpUrl(selectedDocument.documentImage, { width: 2000, quality: 'auto:good' });
  const documentKey = `${activeId}:${documentUrl}`;
  const [photoState, setPhotoState] = useState<{ key: string; status: ReviewImageStatus }>({ key: '', status: 'missing' });
  const [documentState, setDocumentState] = useState<{ key: string; status: ReviewImageStatus }>({ key: '', status: 'missing' });
  const photoStatus = useCallback((status: ReviewImageStatus) => setPhotoState({ key: avatarUrl, status }), [avatarUrl]);
  const documentStatus = useCallback((status: ReviewImageStatus) => setDocumentState({ key: documentKey, status }), [documentKey]);
  const imagesReady = photoState.key === avatarUrl && photoState.status === 'ready'
    && documentState.key === documentKey && documentState.status === 'ready';
  const activeFeedback = feedback?.id === activeId ? feedback : null;
  const close = useCallback(() => { if (!saving.current) onClose(); }, [onClose]);

  useEffect(() => {
    mounted.current = true;
    const previousFocus = window.document.activeElement as HTMLElement | null;
    const previousOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = 'hidden';
    // The portal leaves the app and other overlays inert while the comparison is open.
    const siblings = [...window.document.body.children].filter((node): node is HTMLElement => node instanceof HTMLElement && !node.contains(overlay.current));
    const previousInert = siblings.map(node => node.inert);
    siblings.forEach(node => { node.inert = true; });
    dialog.current?.focus();
    return () => {
      mounted.current = false;
      window.document.body.style.overflow = previousOverflow;
      siblings.forEach((node, index) => { node.inert = previousInert[index]; });
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  const decide = async (action: 'approve' | 'reject' | 'reset') => {
    if (saving.current || noDocuments || !activeId || (action === 'approve' && !imagesReady)) return;
    const callback = action === 'approve' ? onApprove : action === 'reject' ? onReject : onReset;
    if (!callback) return;
    saving.current = true; setBusy(true); setFeedback(null);
    try {
      if (action === 'reject') await onReject?.(rejectDraft?.id === activeId ? rejectDraft.reason.trim() || 'Document criteria not met' : 'Document criteria not met', activeId);
      else if (action === 'approve') await onApprove?.(activeId);
      else await onReset?.(activeId);
      if (mounted.current) {
        setRejectDraft(null);
        setFeedback({ id: activeId, error: false, text: `${selectedDocument.documentType} ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'reopened for review'}.` });
      }
    } catch (error) {
      if (mounted.current) setFeedback({ id: activeId, error: true, text: error instanceof Error ? error.message : 'Could not save this review. Please try again.' });
    } finally {
      saving.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <div ref={overlay} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-2 sm:p-5" >
      <div
        ref={dialog} role="dialog" aria-modal="true" aria-labelledby="identity-comparison-title" tabIndex={-1}
        className="flex max-h-[94dvh] w-full max-w-[1440px] flex-col overflow-hidden rounded-2xl bg-[#F6F5F2] shadow-2xl outline-none sm:rounded-3xl"
        onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
          if (event.key !== 'Tab') return;
          const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || [])]
            .filter(node => node.getClientRects().length > 0);
          const first = controls[0], last = controls[controls.length - 1], active = window.document.activeElement;
          if (!first) { event.preventDefault(); dialog.current?.focus(); }
          else if (event.shiftKey && (active === first || active === dialog.current)) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && (active === last || active === dialog.current)) { event.preventDefault(); first.focus(); }
        }}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-200/70 bg-white px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="identity-comparison-title" className="text-lg font-bold text-zinc-950">Review applicant</h2>
            <p className="mt-1 break-words text-sm font-semibold text-zinc-800">{user.name}</p>
            <p className="mt-0.5 text-xs text-zinc-500">{user.role === 'KASAMBAHAY' ? 'Kasambahay' : user.role === 'HOMEOWNER' ? 'Homeowner' : user.role}{user.barangay ? ` · Brgy. ${user.barangay.replace(/^(brgy\.?|barangay)\s+/i, '')}` : ''}</p>
          </div>
          <button type="button" disabled={busy} onClick={close} aria-label="Close applicant review" title="Close (Esc)" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 disabled:opacity-40"><X className="h-5 w-5" /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">Compare the submitted photo with the face shown on the document.</p>
            {availableDocuments.length > 1 && onDocumentChange && <select
              aria-label="Document to review" disabled={busy} value={activeId}
              onChange={event => { if (!saving.current) { setRejectDraft(null); setFeedback(null); onDocumentChange(event.target.value); } }}
              className="max-w-full rounded-full border border-zinc-200 bg-white py-2 pl-3 pr-8 text-xs font-semibold text-zinc-800 disabled:opacity-50"
            >{availableDocuments.map(item => <option key={item.id} value={item.id}>{item.documentType}</option>)}</select>}
          </div>
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
            <ReviewImageViewer key={`photo:${avatarUrl}`} src={avatarUrl} label="Profile photo" onStatus={photoStatus} />
            <ReviewImageViewer key={`document:${documentKey}`} src={documentUrl} label={noDocuments ? 'Document' : selectedDocument.documentType} onStatus={documentStatus} />
          </div>
          {isDefaultAvatar(user.avatar) && <p role="status" className="mt-3 text-xs text-amber-800">This account has no personal profile photo. A generated avatar cannot be used for face comparison.</p>}
          {selectedDocument.notes && currentStatus === 'REJECTED' && <p className="mt-3 break-words text-xs text-rose-700">Rejection reason: {selectedDocument.notes}</p>}
        </div>

        <footer aria-busy={busy} className="shrink-0 space-y-3 border-t border-zinc-200/70 bg-white px-4 py-3 sm:px-6">
          {activeFeedback && <p role={activeFeedback.error ? 'alert' : 'status'} className={`text-sm ${activeFeedback.error ? 'text-rose-700' : 'text-emerald-700'}`}>{activeFeedback.text}</p>}
          {rejectDraft?.id === activeId && <form className="flex flex-wrap items-center gap-2" onSubmit={event => { event.preventDefault(); void decide('reject'); }}>
            <input autoFocus aria-label="Reason for rejecting this document" disabled={busy} value={rejectDraft.reason} placeholder="Reason for rejection (optional)" maxLength={2000} onChange={event => setRejectDraft({ id: activeId, reason: event.target.value })} className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
            <button type="button" disabled={busy} onClick={() => setRejectDraft(null)} className="rounded-full px-3 py-2 text-xs text-zinc-500">Cancel</button>
            <button type="submit" disabled={busy} className="rounded-full bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40">Confirm rejection</button>
          </form>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-zinc-800">{selectedDocument.documentType}</span><VerificationStatusBadge status={currentStatus} /></div>
              {!noDocuments && !imagesReady && currentStatus !== 'VERIFIED' && <p className="mt-1 text-[11px] text-zinc-500">Both images must load before approving.</p>}
              {busy && <p role="status" className="mt-1 inline-flex items-center gap-2 text-xs text-zinc-500"><Loader2 className="h-3 w-3 animate-spin" />Saving review…</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!noDocuments && activeId && <>
                {currentStatus === 'VERIFIED' || currentStatus === 'REJECTED' ? onReset && <button type="button" disabled={busy} onClick={() => void decide('reset')} className="rounded-full bg-zinc-100 px-4 py-2.5 text-xs font-semibold text-zinc-700 disabled:opacity-40">Re-open document</button>
                  : onReject && <button type="button" disabled={busy} onClick={() => setRejectDraft({ id: activeId, reason: '' })} className="rounded-full bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700 disabled:opacity-40">Reject document</button>}
                {currentStatus !== 'VERIFIED' && onApprove && <button type="button" disabled={busy || !imagesReady || rejectDraft?.id === activeId} onClick={() => void decide('approve')} className="rounded-full bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">Approve document</button>}
              </>}
              <button type="button" disabled={busy} onClick={close} className="rounded-full bg-zinc-100 px-4 py-2.5 text-xs font-semibold text-zinc-700 disabled:opacity-40">Done</button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export const IdentityComparisonModal: React.FC<IdentityComparisonModalProps> = props => {
  if (!props.isOpen || typeof window === 'undefined') return null;
  return createPortal(<IdentityComparisonContent key={props.user.id || props.user.email || props.user.avatar || props.user.name} {...props} />, window.document.body);
};
