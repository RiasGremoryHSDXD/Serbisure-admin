import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  FileText, 
  Mail, 
  Phone,
  MapPin
} from 'lucide-react';
import { getOptimizedWebpUrl, isDefaultAvatar } from '../../utils/imageOptimizer';

export interface IdentityComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    name: string;
    role: string;
    email?: string;
    contactNumber?: string;
    avatar?: string;
    barangay?: string;
    hasLguCoverage?: boolean;
    idName?: string;
  };
  document: {
    id?: string;
    primaryDocumentId?: string;
    documentType: string;
    documentNumber: string;
    documentImage: string;
    documentImageBack?: string;
    isPackage?: boolean;
    packageLabel?: string;
    secondaryDocumentId?: string;
    secondaryDocumentImage?: string;
    secondaryDocumentType?: string;
    secondaryDocumentNumber?: string;
    secondaryIssuedDate?: string;
    secondaryValidityDate?: string;
    secondaryStatus?: string;
    secondaryNotes?: string;
    secondaryOcrData?: Record<string, any>;
    status?: string;
    primaryStatus?: string;
    notes?: string;
    issuedDate?: string;
    validityDate?: string;
    ocrExtractedData?: Record<string, any>;
    hasDocuments?: boolean;
  };
  hasDocuments?: boolean;
  onApprove?: (documentId?: string) => void;
  onReject?: (reason?: string, documentId?: string) => void;
  onReset?: (documentId?: string) => void;
}

interface InteractiveImageFrameProps {
  src?: string;
  alt: string;
  zoom: number;
  rotation: number;
  pan: { x: number; y: number };
  onZoomChange: (updater: (prev: number) => number) => void;
  onPanChange: (newPan: { x: number; y: number }) => void;
  onReset: () => void;
  hasError: boolean;
  onError: () => void;
  fallbackContent: React.ReactNode;
  frameHeight?: string;
}

const InteractiveImageFrame: React.FC<InteractiveImageFrameProps> = ({
  src,
  alt,
  zoom,
  rotation,
  pan,
  onZoomChange,
  onPanChange,
  onReset,
  hasError,
  onError,
  fallbackContent,
  frameHeight = 'h-[360px] sm:h-[420px]',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; panX: number; panY: number }>({
    clientX: 0,
    clientY: 0,
    panX: 0,
    panY: 0,
  });

  // Non-passive wheel event listener to enable smooth wheel zoom and prevent background modal scrolling
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      onZoomChange((prev) => {
        const next = prev * zoomFactor;
        return Math.min(5, Math.max(0.5, Number(next.toFixed(2))));
      });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [onZoomChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.clientX;
      const dy = e.clientY - dragStartRef.current.clientY;
      onPanChange({
        x: dragStartRef.current.panX + dx,
        y: dragStartRef.current.panY + dy,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onPanChange]);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onDoubleClick={onReset}
      className={`mt-3 bg-zinc-950 rounded-2xl border border-zinc-800/60 overflow-hidden relative flex items-center justify-center ${frameHeight} select-none ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      title="Scroll to zoom in/out • Click & drag to move • Double-click to reset"
    >
      {!hasError && src ? (
        <div className="w-full h-full flex items-center justify-center overflow-hidden pointer-events-none">
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={onError}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.2, 0, 0, 1)',
            }}
            className="max-h-full max-w-full object-contain rounded-xl select-none"
          />
        </div>
      ) : (
        fallbackContent
      )}

      {/* Subtle micro-hint */}
      {!hasError && src && (
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-xs px-2.5 py-0.5 rounded-full text-[10px] text-zinc-500 font-normal border border-zinc-800/40 pointer-events-none opacity-60">
          Scroll to zoom · Drag to pan
        </div>
      )}
    </div>
  );
};

export const IdentityComparisonModal: React.FC<IdentityComparisonModalProps> = ({
  isOpen,
  onClose,
  hasDocuments,
  user,
  document,
  onApprove,
  onReject,
  onReset,
}) => {
  // Transformation states
  const [avatarZoom, setAvatarZoom] = useState<number>(1);
  const [avatarRotation, setAvatarRotation] = useState<number>(0);
  const [avatarPan, setAvatarPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [docZoom, setDocZoom] = useState<number>(1);
  const [docRotation, setDocRotation] = useState<number>(0);
  const [docPan, setDocPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [docSide, setDocSide] = useState<'front' | 'back'>('front');

  // Error and UI states
  const [avatarError, setAvatarError] = useState<boolean>(false);
  const [docError, setDocError] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [showRejectInput, setShowRejectInput] = useState<boolean>(false);

  // Reset transforms whenever modal opens or user changes
  useEffect(() => {
    if (isOpen) {
      setAvatarZoom(1);
      setAvatarRotation(0);
      setAvatarPan({ x: 0, y: 0 });
      setDocZoom(1);
      setDocRotation(0);
      setDocPan({ x: 0, y: 0 });
      setDocSide('front');
      setAvatarError(false);
      setDocError(false);
      setShowRejectInput(false);
      setRejectionReason('');
    }
  }, [isOpen, user.name]);

  // Handle ESC key to exit safely
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      window.document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  // Dual-sided or dual-clearance package document resolution
  const hasSecondary = Boolean(document.secondaryDocumentImage || document.documentImageBack);
  const secondaryImageUrl = document.secondaryDocumentImage || document.documentImageBack;

  // Determine dynamic tab labels (Clearances for Kasambahay; Front/Back for Homeowner & National ID)
  const isHomeowner = user.role?.toUpperCase() === 'HOMEOWNER';
  const docTypeLower = (document.documentType || '').toLowerCase();
  const packageLabelLower = (document.packageLabel || '').toLowerCase();
  const isNationalId = isHomeowner || docTypeLower.includes('national id') || packageLabelLower.includes('national id');
  const isClearancePackage = !isNationalId && (
    user.role?.toUpperCase() === 'KASAMBAHAY' ||
    docTypeLower.includes('clearance') ||
    packageLabelLower.includes('clearance') ||
    docTypeLower.includes('nbi') ||
    docTypeLower.includes('police')
  );

  const primaryDocLabel = isClearancePackage ? 'NBI Clearance' : 'Front';
  const secondaryDocLabel = isClearancePackage ? 'Police Clearance' : 'Back';

  const activeDocImage = (docSide === 'back' && hasSecondary)
    ? secondaryImageUrl
    : document.documentImage;

  const activeDocLabel = (docSide === 'back' && hasSecondary)
    ? (document.secondaryDocumentType || (isClearancePackage ? 'Police Clearance' : 'National ID (Back)'))
    : (isClearancePackage ? 'NBI Clearance' : (hasSecondary ? 'National ID (Front)' : document.documentType));

  // Status evaluation for tabs and per-document views
  const isPrimaryRejected = document.primaryStatus === 'REJECTED' || (document.status === 'REJECTED' && document.secondaryStatus !== 'REJECTED');
  const isSecondaryRejected = document.secondaryStatus === 'REJECTED';
  const isPrimaryVerified = document.primaryStatus === 'VERIFIED' || (document.status === 'VERIFIED' && !isPrimaryRejected);
  const isSecondaryVerified = document.secondaryStatus === 'VERIFIED' || (document.status === 'VERIFIED' && !isSecondaryRejected);

  const currentDocStatus = (docSide === 'back' && hasSecondary)
    ? (document.secondaryStatus || 'PENDING / REVIEW')
    : (document.primaryStatus || (document.secondaryStatus === 'REJECTED' ? 'PENDING / REVIEW' : document.status) || 'PENDING / REVIEW');

  const currentDocNotes = (docSide === 'back' && hasSecondary)
    ? (document.secondaryNotes || (document.secondaryStatus === 'REJECTED' ? document.notes : undefined))
    : document.notes;

  const otherDocRejected = hasSecondary && (docSide === 'front' ? isSecondaryRejected : isPrimaryRejected);
  const otherDocLabel = docSide === 'front' ? secondaryDocLabel : primaryDocLabel;

  // WebP optimized URLs
  const optimizedAvatarUrl = getOptimizedWebpUrl(user.avatar, { width: 800, quality: 'auto' });
  const optimizedDocUrl = getOptimizedWebpUrl(activeDocImage, { width: 1400, quality: 'auto' });
  const isFallbackAvatar = isDefaultAvatar(user.avatar);

  const resetAvatar = () => {
    setAvatarZoom(1);
    setAvatarRotation(0);
    setAvatarPan({ x: 0, y: 0 });
  };

  const resetDoc = () => {
    setDocZoom(1);
    setDocRotation(0);
    setDocPan({ x: 0, y: 0 });
  };

  const currentTargetDocId = (docSide === 'back' && document.secondaryDocumentId)
    ? document.secondaryDocumentId
    : (document.primaryDocumentId || document.id);

  const handleApproveClick = () => {
    if (onApprove) {
      onApprove(currentTargetDocId);
      onClose();
    }
  };

  const handleRejectClick = () => {
    if (onReject) {
      onReject(
        rejectionReason || `${activeDocLabel} does not meet verification criteria or details do not match`,
        currentTargetDocId
      );
      onClose();
    }
  };

  // Check whether the resident has submitted documents or is in unsubmitted status
  const isNoDocuments = hasDocuments === false ||
    document.hasDocuments === false ||
    document.status === 'NO_DOCUMENTS' ||
    document.documentType === 'No Documents Submitted' ||
    !document.documentImage;

  const displayBarangay = user.barangay ? user.barangay.replace(/^Brgy\.?\s*/i, '') : '';

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className={`relative bg-[#0D0D11] text-white rounded-3xl border border-zinc-800 shadow-2xl ${
          isNoDocuments ? 'max-w-2xl sm:max-w-3xl' : 'max-w-5xl'
        } w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-800/80 flex items-center justify-between gap-3 bg-[#111116]">
          <div>
            <div className="flex items-center gap-2">
              <h3 id="modal-title" className="font-bold text-base text-white tracking-tight">
                Face & Identity Verification
              </h3>
              <span className="text-zinc-600 text-xs">·</span>
              <span className="text-xs text-zinc-300 font-medium">{user.name}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                {user.role}
              </span>
            </div>
            {(displayBarangay || user.email || user.contactNumber) && (
              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 mt-1 text-[11px] text-zinc-400 font-medium">
                {displayBarangay && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-[#FFB380] shrink-0" />
                    <span className="text-zinc-200 font-bold">
                      Brgy. {displayBarangay}
                    </span>
                    {user.hasLguCoverage === false && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-800/60">
                        No LGU Coverage
                      </span>
                    )}
                  </span>
                )}
                {user.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-[#FFB380] shrink-0" />
                    <span className="text-zinc-300 font-mono">{user.email}</span>
                  </span>
                )}
                {user.contactNumber && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-[#FFB380] shrink-0" />
                    <span className="text-zinc-300 font-mono">{user.contactNumber}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Comparison Viewport OR Single Profile Photo Frame for Unsubmitted */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {isNoDocuments ? (
            /* Single Centered Profile Photo Frame for users without documents */
            <div className="w-full">
              <div className="bg-[#14141A] rounded-2xl border border-zinc-800/80 p-4 sm:p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-800/60">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-semibold text-zinc-300">
                        Profile Photo
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/60">
                        Awaiting Document Submission
                      </span>
                    </div>

                    {/* Avatar Controls */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setAvatarZoom((z) => Math.max(0.5, Number((z - 0.2).toFixed(2))))}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Zoom Out (or scroll down)"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={resetAvatar}
                        className="text-xs font-mono text-zinc-400 hover:text-white hover:bg-zinc-800 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                        title="Click to reset zoom & rotation (100%)"
                      >
                        {Math.round(avatarZoom * 100)}%
                      </button>
                      <button
                        type="button"
                        onClick={() => setAvatarZoom((z) => Math.min(5, Number((z + 0.2).toFixed(2))))}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Zoom In (or scroll up)"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setAvatarRotation((r) => (r + 90) % 360)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                        title={`Rotate 90° (${avatarRotation}°)`}
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Fallback Notice if User hasn't uploaded custom photo */}
                  {isFallbackAvatar ? (
                    <div className="my-3 p-3 bg-amber-950/30 border border-amber-800/40 text-amber-300/90 text-xs rounded-xl flex items-center gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Applicant has not uploaded a personal profile picture yet. Showing system avatar.</span>
                    </div>
                  ) : (
                    <div className="my-3 p-3 bg-zinc-900/60 border border-zinc-800/60 text-zinc-400 text-xs rounded-xl flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        <span>No identification or statutory clearances uploaded yet.</span>
                      </span>
                      <span className="text-[11px] text-zinc-500 hidden sm:inline">
                        Scroll to zoom · Drag to pan · Double-click to reset
                      </span>
                    </div>
                  )}

                  {/* Interactive Drag & Scroll Frame */}
                  <InteractiveImageFrame
                    src={optimizedAvatarUrl}
                    alt={`${user.name} Profile`}
                    zoom={avatarZoom}
                    rotation={avatarRotation}
                    pan={avatarPan}
                    onZoomChange={setAvatarZoom}
                    onPanChange={setAvatarPan}
                    onReset={resetAvatar}
                    hasError={avatarError}
                    onError={() => setAvatarError(true)}
                    frameHeight="h-[400px] sm:h-[480px]"
                    fallbackContent={
                      <div className="flex flex-col items-center justify-center text-center p-8 text-zinc-500">
                        <div className="w-20 h-20 rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center text-2xl font-bold mb-3 border border-zinc-700">
                          {user.name.slice(0, 2).toUpperCase()}
                        </div>
                        <p className="text-sm font-semibold text-zinc-300">No profile photo uploaded</p>
                        <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                          {avatarError ? 'Failed to load profile photo.' : 'The user has not uploaded a profile picture yet.'}
                        </p>
                      </div>
                    }
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
              {/* Panel 1: Account Profile Picture */}
              <div className="bg-[#14141A] rounded-2xl border border-zinc-800/80 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-800/60">
                    <h4 className="text-xs font-semibold text-zinc-300">
                      Profile Photo
                    </h4>

                    {/* Avatar Controls */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setAvatarZoom((z) => Math.max(0.5, Number((z - 0.2).toFixed(2))))}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Zoom Out (or scroll down)"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={resetAvatar}
                        className="text-xs font-mono text-zinc-400 hover:text-white hover:bg-zinc-800 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                        title="Click to reset zoom & rotation (100%)"
                      >
                        {Math.round(avatarZoom * 100)}%
                      </button>
                      <button
                        type="button"
                        onClick={() => setAvatarZoom((z) => Math.min(5, Number((z + 0.2).toFixed(2))))}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Zoom In (or scroll up)"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setAvatarRotation((r) => (r + 90) % 360)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                        title={`Rotate 90° (${avatarRotation}°)`}
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Fallback Notice if User hasn't uploaded custom photo */}
                  {isFallbackAvatar && (
                    <div className="my-2.5 p-2.5 bg-amber-950/30 border border-amber-800/40 text-amber-300/90 text-xs rounded-xl flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Applicant has not uploaded a personal profile picture yet.</span>
                    </div>
                  )}

                  {/* Interactive Drag & Scroll Frame */}
                  <InteractiveImageFrame
                    src={optimizedAvatarUrl}
                    alt={`${user.name} Profile`}
                    zoom={avatarZoom}
                    rotation={avatarRotation}
                    pan={avatarPan}
                    onZoomChange={setAvatarZoom}
                    onPanChange={setAvatarPan}
                    onReset={resetAvatar}
                    hasError={avatarError}
                    onError={() => setAvatarError(true)}
                    fallbackContent={
                      <div className="flex flex-col items-center justify-center text-center p-6 text-zinc-500">
                        <div className="w-16 h-16 rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center text-xl font-bold mb-2 border border-zinc-700">
                          {user.name.slice(0, 2).toUpperCase()}
                        </div>
                        <p className="text-xs font-medium text-zinc-400">No photo available</p>
                        <p className="text-[11px] text-zinc-600 mt-0.5 max-w-xs">
                          {avatarError ? 'Failed to load profile photo.' : 'Default avatar placeholder.'}
                        </p>
                      </div>
                    }
                  />
                </div>
              </div>

              {/* Panel 2: Submitted Official Document Scan */}
              <div className="bg-[#14141A] rounded-2xl border border-zinc-800/80 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-800/60 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-semibold text-zinc-300">
                        Document Scan
                      </h4>
                      {/* Dual-sided or Dual-clearance Toggle */}
                      {hasSecondary && (
                        <div className="flex items-center bg-zinc-900/90 p-0.5 rounded-xl border border-zinc-800 gap-0.5">
                          <button
                            type="button"
                            onClick={() => { setDocSide('front'); resetDoc(); }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                              docSide === 'front'
                                ? 'bg-zinc-800 text-white font-semibold shadow-xs'
                                : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            {isPrimaryRejected ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                            ) : isPrimaryVerified ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            ) : null}
                            <span>{primaryDocLabel}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => { setDocSide('back'); resetDoc(); }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                              docSide === 'back'
                                ? 'bg-zinc-800 text-white font-semibold shadow-xs'
                                : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            {isSecondaryRejected ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                            ) : isSecondaryVerified ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            ) : null}
                            <span>{secondaryDocLabel}</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Document Controls */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setDocZoom((z) => Math.max(0.5, Number((z - 0.2).toFixed(2))))}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Zoom Out (or scroll down)"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={resetDoc}
                        className="text-xs font-mono text-zinc-400 hover:text-white hover:bg-zinc-800 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                        title="Click to reset zoom & rotation (100%)"
                      >
                        {Math.round(docZoom * 100)}%
                      </button>
                      <button
                        type="button"
                        onClick={() => setDocZoom((z) => Math.min(5, Number((z + 0.2).toFixed(2))))}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Zoom In (or scroll up)"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDocRotation((r) => (r + 90) % 360)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                        title={`Rotate 90° (${docRotation}°)`}
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Compact one-line status note below tabs */}
                  {currentDocStatus === 'REJECTED' ? (
                    <div className="mt-1.5 flex items-center justify-between gap-2 px-0.5">
                      <div className="flex items-center gap-1.5 text-[11px] text-rose-400 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                        <span>
                          {currentDocNotes ? `Rejected · ${currentDocNotes}` : 'This document was rejected'}
                        </span>
                      </div>
                      {onReset && (
                        <button
                          type="button"
                          onClick={() => {
                            onReset(currentTargetDocId);
                            onClose();
                          }}
                          className="text-[11px] font-bold text-zinc-400 hover:text-white cursor-pointer hover:underline shrink-0 border-0 bg-transparent"
                        >
                          Reset →
                        </button>
                      )}
                    </div>
                  ) : otherDocRejected ? (
                    <div className="mt-1.5 flex items-center justify-between gap-2 px-0.5">
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                        <span>{otherDocLabel} rejected</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setDocSide(docSide === 'front' ? 'back' : 'front'); resetDoc(); }}
                        className="text-[11px] font-bold text-[#FFB380] hover:underline cursor-pointer shrink-0 border-0 bg-transparent"
                      >
                        Review →
                      </button>
                    </div>
                  ) : null}

                  {/* Interactive Drag & Scroll Frame */}
                  <InteractiveImageFrame
                    src={optimizedDocUrl}
                    alt={`${activeDocLabel} scan`}
                    zoom={docZoom}
                    rotation={docRotation}
                    pan={docPan}
                    onZoomChange={setDocZoom}
                    onPanChange={setDocPan}
                    onReset={resetDoc}
                    hasError={docError}
                    onError={() => setDocError(true)}
                    fallbackContent={
                      <div className="flex flex-col items-center justify-center gap-2 text-zinc-500 text-xs p-4 text-center">
                        <FileText className="w-8 h-8 text-zinc-600" />
                        <span>Failed to load document scan</span>
                      </div>
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {/* Rejection Note Drawer */}
          {showRejectInput && !isNoDocuments && (
            <div className="mt-4 p-4 bg-rose-950/30 border border-rose-900/40 rounded-2xl animate-in slide-in-from-bottom-2 duration-150">
              <div className="flex items-center gap-2 text-rose-300 text-xs font-medium mb-2">
                <XCircle className="w-4 h-4 text-rose-400" />
                <span>
                  Rejecting: <strong className="text-white underline underline-offset-2">{activeDocLabel}</strong> — Specify reason:
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder={`e.g. ${activeDocLabel} is blurred, fake, or details do not match...`}
                  className="flex-1 bg-zinc-900 border border-zinc-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-rose-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleRejectClick}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-xl cursor-pointer transition-colors"
                >
                  Confirm Rejection
                </button>
                <button
                  type="button"
                  onClick={() => setShowRejectInput(false)}
                  className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer: Verdict Guidance & Quick Review Actions */}
        <div className="px-5 py-3.5 border-t border-zinc-800/80 bg-[#111116] flex flex-col sm:flex-row items-center justify-between gap-3">
          {isNoDocuments ? (
            <>
              <p className="text-xs text-zinc-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span>No identification documents submitted yet · Resident profile photo view only</span>
              </p>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-zinc-500">
                Manual visual comparison only. No automated facial-liveness or face-match score is available.
              </p>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {currentDocStatus === 'REJECTED' && onReset ? (
                  <button
                    type="button"
                    onClick={() => {
                      onReset(currentTargetDocId);
                      onClose();
                    }}
                    className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Reset {hasSecondary ? activeDocLabel : ''} to Review</span>
                  </button>
                ) : onReject && !showRejectInput ? (
                  <button
                    type="button"
                    onClick={() => setShowRejectInput(true)}
                    className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-rose-950/50 text-zinc-400 hover:text-rose-300 border border-zinc-800 hover:border-rose-800/50 text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Reject {hasSecondary ? activeDocLabel : ''}</span>
                  </button>
                ) : null}

                {onApprove && (
                  <button
                    type="button"
                    onClick={handleApproveClick}
                    className="px-4 py-2 rounded-xl bg-[#FFB380] hover:bg-[#F5A066] text-[#0D0D11] text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-[#0D0D11]" />
                    <span>Approve</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
