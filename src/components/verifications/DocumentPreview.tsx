import React, { useState, useEffect } from 'react';
import { Eye, CheckCircle, XCircle, AlertTriangle, X, FileText, RotateCcw, RotateCw, Send, ExternalLink, Copy, Check, UserCheck, Mail, Phone, FileQuestion, MapPin, Clock } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { IdentityComparisonModal } from './IdentityComparisonModal';
import { getOptimizedWebpUrl } from '../../utils/imageOptimizer';

export const DocumentPreview: React.FC = () => {
  const { 
    verifications, 
    selectedVerificationId, 
    approveVerification, 
    rejectVerification, 
    resetVerification,
    isComparisonModalOpen,
    setIsComparisonModalOpen
  } = useAdmin();
  const [rejectReason, setRejectReason] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  const [idSide, setIdSide] = useState<'front' | 'back'>('front');
  const [imageRotation, setImageRotation] = useState<number>(0);
  const [copiedNumber, setCopiedNumber] = useState<boolean>(false);

  const selectedItem = verifications.find(v => v.id === selectedVerificationId) || verifications[0];

  useEffect(() => {
    setIdSide('front');
    setImageRotation(0);
    setCopiedNumber(false);
  }, [selectedVerificationId]);

  if (!selectedItem) {
    return (
      <div className="bg-white rounded-3xl p-8 flex items-center justify-center h-full text-zinc-400 text-sm font-medium">
        Select a verification request to preview.
      </div>
    );
  }

  const isUnsubmitted = selectedItem.status === 'NO_DOCUMENTS' || selectedItem.hasDocuments === false;

  if (isUnsubmitted) {
    const isKasambahay = selectedItem.role === 'KASAMBAHAY';
    return (
      <>
        <div className="bg-white rounded-3xl p-6 sm:p-8 h-full flex flex-col justify-between overflow-y-auto">
        <div>
          {/* Header Bar */}
          <div className="pb-5 border-b border-zinc-100">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 font-display">
                Resident Profile
              </span>

              {/* Minimalist, cleanly centered badges */}
              <div className="flex items-center gap-1.5 shrink-0 flex-nowrap">
                <span className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F0F0EC] text-zinc-600 text-xs font-semibold whitespace-nowrap">
                  <MapPin className="w-3 h-3 text-zinc-400 shrink-0" />
                  <span>Brgy. {(selectedItem.barangay || 'Unassigned').replace(/^Brgy\.?\s*/i, '')}</span>
                </span>
                {selectedItem.hasLguCoverage === false && (
                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-amber-50/90 text-amber-700 text-[10px] font-semibold border border-amber-200/50 whitespace-nowrap">
                    No LGU Coverage
                  </span>
                )}
              </div>
            </div>

            <h3 className="text-xl font-black font-display text-[#0D0D11] tracking-tight">
              Awaiting Document Submission
            </h3>
          </div>

          {/* Feedback Toast */}
          {feedbackMessage && (
            <div className="my-4 px-4 py-3 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-2xl flex items-center justify-between animate-in fade-in">
              <span>{feedbackMessage}</span>
              <Check className="w-4 h-4 text-emerald-600" />
            </div>
          )}

          {/* Empty Status Banner */}
          <div className="my-6 p-6 rounded-3xl bg-amber-50/60 border border-amber-200/60 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0 text-amber-600">
              <FileQuestion className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-950 font-display">
                No Clearances or Identification Uploaded
              </h4>
              <p className="text-xs text-amber-800/80 mt-1 leading-relaxed">
                {isKasambahay
                  ? `${selectedItem.name} is registered as a Kasambahay worker. Statutory clearances (NBI and Police Clearances) are required to complete verification and enable work placements.`
                  : `${selectedItem.name} is registered as a Homeowner. PhilSys National ID (Front & Back) is required for identity verification and account approval.`}
              </p>
            </div>
          </div>

          {/* User Profile Summary Card */}
          <div className="p-5 rounded-3xl bg-[#FBFBFA] border border-zinc-100 space-y-4">
            <div className="flex items-center gap-3.5">
              <div 
                onClick={() => setIsComparisonModalOpen(true)}
                className="w-12 h-12 rounded-2xl overflow-hidden bg-zinc-200 shrink-0 cursor-pointer hover:ring-2 hover:ring-[#FFB380] transition-all relative group"
                title="Click to view full profile photo"
              >
                {selectedItem.avatar ? (
                  <img
                    src={getOptimizedWebpUrl(selectedItem.avatar, { width: 96, height: 96, quality: 'auto' })}
                    alt={selectedItem.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-bold text-zinc-500">
                    {selectedItem.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-base font-black font-display text-zinc-900 leading-tight truncate">
                    {selectedItem.name}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsComparisonModalOpen(true)}
                    className="text-[11px] font-bold text-[#FFB380] hover:text-[#e89965] flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                    title="Inspect Profile Photo"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect Photo</span>
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-800">
                    {isKasambahay ? 'Kasambahay Worker' : 'Homeowner'}
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                    Not Submitted
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs border-t border-zinc-200/50">
              <div className="flex items-center gap-2 text-zinc-600">
                <Mail className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="truncate">{selectedItem.email || 'No email provided'}</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-600">
                <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span>{selectedItem.contactNumber || 'No phone provided'}</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-600">
                <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="truncate">{selectedItem.address || `Brgy. ${selectedItem.barangay || 'Unassigned'}`}</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-600">
                <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span>Registered: Recent</span>
              </div>
            </div>
          </div>

          {/* Required Documents Checklist */}
          <div className="mt-6">
            <h5 className="text-[11px] font-black uppercase tracking-wider text-zinc-400 font-display mb-3">
              Required Submission Checklist
            </h5>
            <div className="space-y-2">
              {isKasambahay ? (
                <>
                  <div className="p-3.5 rounded-2xl bg-white border border-zinc-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-900">NBI Clearance</div>
                        <div className="text-[10px] text-zinc-400 font-medium">Valid statutory clearance with QR code</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                      Pending Upload
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white border border-zinc-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-900">National Police Clearance</div>
                        <div className="text-[10px] text-zinc-400 font-medium">Local PNP verification document</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                      Pending Upload
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-3.5 rounded-2xl bg-white border border-zinc-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-900">PhilSys National ID (Front)</div>
                        <div className="text-[10px] text-zinc-400 font-medium">Photo ID with full name and demographic data</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                      Pending Upload
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white border border-zinc-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-900">PhilSys National ID (Back)</div>
                        <div className="text-[10px] text-zinc-400 font-medium">QR code and security features</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                      Pending Upload
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-6 border-t border-zinc-100 flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const info = `${selectedItem.name} (${selectedItem.role})\nEmail: ${selectedItem.email}\nPhone: ${selectedItem.contactNumber}\nBarangay: ${selectedItem.barangay}`;
              navigator.clipboard.writeText(info);
              setCopiedNumber(true);
              setTimeout(() => setCopiedNumber(false), 2000);
            }}
            className="flex-1 py-3 px-4 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold font-display transition-all flex items-center justify-center gap-2 cursor-pointer border-0"
          >
            {copiedNumber ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-zinc-500" />}
            <span>{copiedNumber ? 'Contact Copied!' : 'Copy Contact Info'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFeedbackMessage(`Submission reminder sent to ${selectedItem.name}`);
              setTimeout(() => setFeedbackMessage(null), 3500);
            }}
            className="flex-1 py-3 px-4 rounded-full bg-[#0D0D11] hover:bg-black text-white text-xs font-bold font-display transition-all flex items-center justify-center gap-2 cursor-pointer border-0"
          >
            <Send className="w-4 h-4 text-[#FFB380]" />
            <span>Send Reminder</span>
          </button>
        </div>
      </div>

      {/* Profile Photo Zoom & Inspect Modal for Unsubmitted Resident */}
      <IdentityComparisonModal
        isOpen={isComparisonModalOpen}
        onClose={() => setIsComparisonModalOpen(false)}
        hasDocuments={false}
        user={{
          name: selectedItem.name,
          role: selectedItem.role,
          email: selectedItem.email,
          contactNumber: selectedItem.contactNumber,
          avatar: selectedItem.avatar,
          barangay: selectedItem.barangay,
          hasLguCoverage: selectedItem.hasLguCoverage,
          idName: 'N/A (No Documents Submitted)',
        }}
        document={{
          documentType: selectedItem.documentType || 'No Documents Submitted',
          documentNumber: selectedItem.documentNumber || 'Not Available',
          documentImage: '',
          status: 'NO_DOCUMENTS',
          hasDocuments: false,
        }}
      />
    </>
  );
}

  const handleApproveById = async (targetId: string, docLabel?: string) => {
    try {
      await approveVerification(targetId);
      setFeedbackMessage('Approved only this document: ' + (docLabel || selectedItem.documentType));
    } catch (error) {
      setFeedbackMessage('Approval failed: ' + (error instanceof Error ? error.message : 'Please try again.'));
    }
  };

  const handleApprove = async () => {
    const targetDocId = (idSide === 'back' && selectedItem.secondaryDocumentId)
      ? selectedItem.secondaryDocumentId
      : selectedItem.id;
    const targetLabel = (idSide === 'back' && hasSecondary) ? secondaryDocLabel : primaryDocLabel;
    await handleApproveById(targetDocId, targetLabel);
  };

  const handleRejectById = async (targetId: string, reason?: string, docLabel?: string) => {
    await rejectVerification(targetId, reason || 'Document criteria not met');
    setFeedbackMessage(`Rejected ${selectedItem.name}'s ${docLabel || 'document'}`);
    setRejectReason('');
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  const handleReject = async () => {
    const targetDocId = (idSide === 'back' && selectedItem.secondaryDocumentId)
      ? selectedItem.secondaryDocumentId
      : selectedItem.id;
    const targetLabel = (idSide === 'back' && hasSecondary) ? secondaryDocLabel : primaryDocLabel;
    await handleRejectById(targetDocId, rejectReason, targetLabel);
  };

  const handleResetById = async (targetId: string, docLabel?: string) => {
    await resetVerification(targetId);
    setFeedbackMessage(`Reset ${selectedItem.name}'s ${docLabel || 'document'} to Pending Review`);
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  const handleReset = async () => {
    const targetDocId = (idSide === 'back' && selectedItem.secondaryDocumentId)
      ? selectedItem.secondaryDocumentId
      : selectedItem.id;
    const targetLabel = (idSide === 'back' && hasSecondary) ? secondaryDocLabel : primaryDocLabel;
    await handleResetById(targetDocId, targetLabel);
  };

  // Dual-sided or dual-clearance package document resolution
  const hasSecondary = Boolean(selectedItem.secondaryDocumentImage || selectedItem.documentImageBack);
  const secondaryImageUrl = selectedItem.secondaryDocumentImage || selectedItem.documentImageBack;

  const isHomeowner = selectedItem.role?.toUpperCase() === 'HOMEOWNER';
  const baseDocTypeLower = (selectedItem.documentType || '').toLowerCase();
  const packageLabelLower = (selectedItem.packageLabel || '').toLowerCase();
  const isNationalId = isHomeowner || baseDocTypeLower.includes('national id') || packageLabelLower.includes('national id') || (selectedItem.rawDocumentType || '').toLowerCase().includes('national_id');
  const isKasambahayPackage = !isNationalId && (
    selectedItem.role?.toUpperCase() === 'KASAMBAHAY' ||
    baseDocTypeLower.includes('clearance') ||
    packageLabelLower.includes('clearance') ||
    baseDocTypeLower.includes('nbi') ||
    baseDocTypeLower.includes('police')
  );

  const primaryDocLabel = isKasambahayPackage ? 'NBI Clearance' : 'Front';
  const secondaryDocLabel = isKasambahayPackage ? 'Police Clearance' : 'Back';

  const activeImageUrl = (idSide === 'back' && hasSecondary)
    ? (secondaryImageUrl || selectedItem.documentImage)
    : selectedItem.documentImage;

  // Active OCR Data and active metadata depending on selected tab (front vs back / NBI vs Police)
  const activeOcrData = (idSide === 'back' && hasSecondary && selectedItem.secondaryOcrData)
    ? selectedItem.secondaryOcrData
    : (selectedItem.ocrExtractedData || {});

  // OCR Name extraction: strictly from OCR data, never falling back to profile username/account name
  const ocrExtractedName = 
    activeOcrData?.full_name ||
    [activeOcrData?.first_name, activeOcrData?.middle_name, activeOcrData?.last_name].filter(Boolean).join(' ') ||
    (activeOcrData?.name ? String(activeOcrData.name) : undefined);
  const idName = ocrExtractedName || 'Not Detected in OCR';

  const docNumber = (idSide === 'back' && hasSecondary && selectedItem.secondaryDocumentNumber)
    ? selectedItem.secondaryDocumentNumber
    : (activeOcrData?.clearance_number || activeOcrData?.philsys_number || activeOcrData?.document_number || selectedItem.documentNumber || 'Not Detected');
  
  // PhilSys National IDs do not have an issuance date printed on the card
  const issuedDate = isNationalId 
    ? 'N/A (PhilSys National ID)' 
    : ((idSide === 'back' && hasSecondary && selectedItem.secondaryIssuedDate)
        ? selectedItem.secondaryIssuedDate
        : (activeOcrData?.date_issued || selectedItem.issuedDate || 'Not Detected'));
  
  const rawValidity = (idSide === 'back' && hasSecondary && selectedItem.secondaryValidityDate)
    ? selectedItem.secondaryValidityDate
    : (activeOcrData?.valid_until || selectedItem.validityDate);
  const validityDate = isNationalId 
    ? 'Permanent' 
    : (rawValidity && rawValidity !== 'Not Detected' ? rawValidity : 'Not Detected');

  const resolvedIdType = (idSide === 'back' && hasSecondary)
    ? (selectedItem.secondaryDocumentType || (isKasambahayPackage ? 'Police Clearance' : 'National ID (Back)'))
    : (isKasambahayPackage ? 'NBI Clearance' : (hasSecondary ? 'National ID (Front)' : (selectedItem.documentType || 'Government ID')));

  const activeDocLabel = resolvedIdType;

  // Tab-specific document status and rejection notes
  const isPrimaryRejected = selectedItem.primaryStatus === 'REJECTED' || (selectedItem.status === 'REJECTED' && selectedItem.secondaryStatus !== 'REJECTED');
  const isSecondaryRejected = selectedItem.secondaryStatus === 'REJECTED';
  const isPrimaryVerified = selectedItem.primaryStatus === 'VERIFIED' || (selectedItem.status === 'VERIFIED' && !isPrimaryRejected);
  const isSecondaryVerified = selectedItem.secondaryStatus === 'VERIFIED' || (selectedItem.status === 'VERIFIED' && !isSecondaryRejected);

  const currentDocStatus = (idSide === 'back' && hasSecondary)
    ? (selectedItem.secondaryStatus || 'PENDING / REVIEW')
    : (selectedItem.primaryStatus || (selectedItem.secondaryStatus === 'REJECTED' ? 'PENDING / REVIEW' : selectedItem.status) || 'PENDING / REVIEW');

  const currentDocNotes = (idSide === 'back' && hasSecondary)
    ? (selectedItem.secondaryNotes || (selectedItem.secondaryStatus === 'REJECTED' ? selectedItem.notes : undefined))
    : selectedItem.notes;

  const otherDocRejected = hasSecondary && (idSide === 'front' ? isSecondaryRejected : isPrimaryRejected);
  const otherDocLabel = idSide === 'front' ? secondaryDocLabel : primaryDocLabel;

  const docTypeLower = (selectedItem.documentType || selectedItem.rawDocumentType || resolvedIdType || '').toLowerCase();
  const isNbi = docTypeLower.includes('nbi');
  const isPolice = docTypeLower.includes('police') || docTypeLower.includes('pnp');
  const numberLabel = isNbi ? 'Transaction Number' : 'ID Number';

  const handleCopyNumber = () => {
    if (docNumber && docNumber !== 'Not Detected') {
      navigator.clipboard.writeText(docNumber);
      setCopiedNumber(true);
      setTimeout(() => setCopiedNumber(false), 2000);
    }
  };

  const formatOcrDate = (val?: string) => {
    if (!val || val === 'Not Detected' || val === 'N/A') return 'Not Detected';
    if (val === 'Permanent (PhilSys)' || val === 'Permanent') return 'Permanent';
    if (val.includes('PhilSys') || val.includes('N/A')) return val;
    if (/^[A-Za-z]{3}\s+\d{1,2},\s+\d{4}$/.test(val)) return val;
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    } catch {}
    return val;
  };

  return (
    <>
      <div className="bg-white rounded-3xl p-8 flex flex-col justify-between h-full">
        <div>
          {/* Title and Barangay */}
          <div className="flex items-center justify-between pb-5 border-b border-zinc-100">
            <h3 className="text-xl font-black font-display text-[#0D0D11] tracking-tight">
              Document Preview
            </h3>
            <div className="flex items-center gap-1.5 shrink-0 flex-nowrap">
              <span className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F0F0EC] text-zinc-600 text-xs font-semibold whitespace-nowrap">
                <MapPin className="w-3 h-3 text-zinc-400 shrink-0" />
                <span>Brgy. {(selectedItem.barangay || 'Pagatpat').replace(/^Brgy\.?\s*/i, '')}</span>
              </span>
              {selectedItem.hasLguCoverage === false && (
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-amber-50/90 text-amber-700 text-[10px] font-semibold border border-amber-200/50 whitespace-nowrap">
                  No LGU Coverage
                </span>
              )}
            </div>
          </div>

          {/* Feedback Alert Toast */}
          {feedbackMessage && (
            <div className="my-3 p-3 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-2xl flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{feedbackMessage}</span>
            </div>
          )}

          {/* Dual-document switcher toggle if secondary doc exists */}
          {hasSecondary && (
            <div className="flex items-center justify-between mt-3 mb-1 px-1">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-display">
                {isKasambahayPackage ? 'Statutory Clearances' : 'Document Scan'}
              </span>
              <div className="flex items-center bg-[#F0F0EC] p-0.5 rounded-full">
                <button
                  type="button"
                  onClick={() => setIdSide('front')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer border-0 flex items-center gap-1.5 ${
                    idSide === 'front' ? 'bg-[#0D0D11] text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
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
                  onClick={() => setIdSide('back')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer border-0 flex items-center gap-1.5 ${
                    idSide === 'back' ? 'bg-[#0D0D11] text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
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
            </div>
          )}

          {/* Clean Scanned Image Preview Card */}
          <div 
            onClick={() => setShowImageModal(true)}
            className="relative mt-2 rounded-3xl overflow-hidden bg-zinc-100 hover:bg-zinc-200/70 transition-colors group cursor-pointer"
            title="Click to expand full resolution scan"
          >
            {activeImageUrl ? (
              <div className="relative h-[220px] flex items-center justify-center p-3">
                <img
                  src={getOptimizedWebpUrl(activeImageUrl, { width: 800, quality: 'auto' })}
                  alt={`${selectedItem.name} ${resolvedIdType}`}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-contain group-hover:scale-102 transition-transform duration-200 rounded-2xl"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-xs font-bold font-display backdrop-blur-[2px]">
                  <Eye className="w-4 h-4" />
                  <span>Click to Zoom Scan</span>
                </div>
              </div>
            ) : (
              <div className="p-8 flex flex-col items-center justify-center text-zinc-400 text-xs bg-zinc-50">
                <FileText className="w-8 h-8 mb-2" />
                <span className="font-medium">No scan image available</span>
              </div>
            )}
          </div>

          {/* Compact one-line status note below image */}
          {currentDocStatus === 'REJECTED' ? (
            <div className="mt-2 px-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                <span>
                  {currentDocNotes
                    ? `Rejected · ${currentDocNotes}`
                    : 'This document was rejected'}
                </span>
              </div>
            </div>
          ) : otherDocRejected ? (
            <div className="mt-2 px-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                <span>{otherDocLabel} rejected</span>
              </div>
              <button
                type="button"
                onClick={() => setIdSide(idSide === 'front' ? 'back' : 'front')}
                className="text-xs font-bold text-[#E07A38] hover:underline cursor-pointer border-0 bg-transparent shrink-0"
              >
                Review →
              </button>
            </div>
          ) : null}

          {/* User Metadata & Face Liveness Card */}
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Interactive Clickable Profile Picture */}
                <div 
                  onClick={() => setIsComparisonModalOpen(true)}
                  className="w-12 h-12 min-w-[48px] min-h-[48px] max-w-[48px] max-h-[48px] rounded-full overflow-hidden shrink-0 bg-zinc-200 flex items-center justify-center relative group cursor-pointer ring-2 ring-transparent hover:ring-[#FFB380] transition-all shadow-xs"
                  title="Click to compare face with submitted document"
                >
                  {selectedItem.avatar ? (
                    <img
                      src={getOptimizedWebpUrl(selectedItem.avatar, { width: 120, height: 120, quality: 'auto' })}
                      alt={selectedItem.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className="font-bold text-xs text-zinc-600 font-display">
                      {selectedItem.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  {/* Hover lens indicator */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white backdrop-blur-[1px] rounded-full">
                    <Eye className="w-4 h-4 text-[#FFB380]" />
                  </div>
                </div>

                <div>
                  <h4 className="text-base font-black font-display text-[#0D0D11]">
                    {selectedItem.name}
                  </h4>
                  {selectedItem.barangay && (
                    <p className="text-[11px] text-zinc-700 flex items-center gap-1 mt-0.5 font-bold">
                      <MapPin className="w-3 h-3 text-[#FFB380] shrink-0" />
                      <span>Brgy. {selectedItem.barangay}</span>
                      {selectedItem.hasLguCoverage === false && (
                        <span className="ml-1 text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                          No LGU
                        </span>
                      )}
                    </p>
                  )}
                  {selectedItem.email && (
                    <p className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5 font-medium">
                      <Mail className="w-3 h-3 text-zinc-400 shrink-0" />
                      <span className="truncate max-w-[200px]">{selectedItem.email}</span>
                    </p>
                  )}
                  {selectedItem.contactNumber && (
                    <p className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5 font-medium">
                      <Phone className="w-3 h-3 text-zinc-400 shrink-0" />
                      <span className="font-mono">{selectedItem.contactNumber}</span>
                    </p>
                  )}
                  <span className="inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded-full mt-1 bg-zinc-100 text-zinc-600">
                    {selectedItem.role}
                  </span>
                </div>
              </div>

              {/* Compare Face Action Pill */}
              <button
                type="button"
                onClick={() => setIsComparisonModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FFF4ED] hover:bg-[#FFE5D6] text-[#E07A38] hover:text-[#C86423] rounded-full text-[11px] font-black font-display transition-all cursor-pointer border-0 shadow-xs"
                title="Open Side-by-Side Face & Identity Comparison"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Compare Face</span>
              </button>
            </div>

            {/* Details list (Clean, airy key-value block without grey zebra stripes) */}
            <div className="space-y-2.5 text-xs pt-3 border-t border-zinc-100">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-display">ID Name</span>
                <span className="font-bold text-[#0D0D11] text-xs font-display">{idName}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-display">ID Type</span>
                <span className="font-bold text-[#0D0D11] text-xs font-display">{resolvedIdType}</span>
              </div>
              <div className="py-0.5">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-display">
                    {numberLabel}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-zinc-800 text-xs">{docNumber}</span>
                    {docNumber && docNumber !== 'Not Detected' && (
                      <button
                        type="button"
                        onClick={handleCopyNumber}
                        title={copiedNumber ? "Copied!" : "Copy to clipboard"}
                        className="p-1 hover:bg-zinc-100 rounded-full text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer border-0"
                      >
                        {copiedNumber ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Direct External Verification Portal Link */}
                {(isNbi || isPolice || isNationalId) && (
                  <div className="flex justify-end pt-1 pb-0.5">
                    <a
                      href={
                        isNationalId
                          ? "https://everify.gov.ph/check"
                          : isNbi
                          ? "https://verification.nbi-clearance.io"
                          : "https://pnpclearance.ph/#call-to-action"
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FFF4ED] hover:bg-[#FFE5D6] text-[#FFB380] hover:text-[#F5A066] rounded-full text-[11px] font-black font-display transition-all cursor-pointer border-0"
                      title={`Open official ${isNationalId ? 'PhilSys National ID (eVerify)' : isNbi ? 'NBI' : 'PNP'} verification portal`}
                    >
                      <span>
                        Verify on {isNationalId ? 'PhilSys eVerify' : isNbi ? 'NBI Portal' : 'PNP Portal'}
                      </span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-display">Date Issued</span>
                <span className="font-medium text-zinc-700 text-xs">{formatOcrDate(issuedDate)}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-display">Validity</span>
                <span className="font-medium text-zinc-700 text-xs">{formatOcrDate(validityDate)}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-display">Status</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider font-display ${
                  currentDocStatus === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700' :
                  currentDocStatus === 'REJECTED' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'
                }`}>
                  {currentDocStatus === 'PENDING / REVIEW' ? 'In Review' : currentDocStatus}
                </span>
              </div>
            </div>

            {/* Discrepancies if any */}
            {selectedItem.ocrDiscrepancies && selectedItem.ocrDiscrepancies.length > 0 && (
              <div className="mt-2 p-3 bg-amber-50 rounded-2xl space-y-1">
                <div className="flex items-center gap-1 text-amber-900 text-[11px] font-black font-display">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Flagged Discrepancies ({selectedItem.ocrDiscrepancies.length})</span>
                </div>
                {selectedItem.ocrDiscrepancies.map((disc, idx) => (
                  <div key={idx} className="text-[11px] text-amber-900/80 pl-4 list-disc font-medium">
                    • {disc.message || `${disc.field}: expected '${disc.profile_value}', got '${disc.document_value}'`}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons & Status Lifecycle Controls */}
        <div className="mt-6 pt-4 space-y-3">
          {currentDocStatus === 'REJECTED' ? (
            <div className="space-y-3">
              <div className="p-3.5 bg-rose-50 rounded-2xl text-xs text-rose-800">
                <div className="font-black font-display flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-rose-700">
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>{hasSecondary ? activeDocLabel : 'Document'} Currently Rejected</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-[11px] font-bold text-rose-700 hover:underline cursor-pointer border-0 bg-transparent"
                  >
                    Reset to Review
                  </button>
                </div>
                {currentDocNotes && (
                  <p className="mt-1 text-[11px] text-rose-600 font-medium pl-5">
                    Reason: {currentDocNotes}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full py-3 rounded-full bg-[#F0F0EC] text-zinc-800 hover:bg-[#E5E5E0] text-xs font-black font-display tracking-wider uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 border-0"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-zinc-500" />
                  <span>RESET</span>
                </button>

                <button
                  type="button"
                  onClick={handleApprove}
                  className="w-full py-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black font-display tracking-wider uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 border-0"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>OVERRIDE</span>
                </button>
              </div>
            </div>
          ) : currentDocStatus === 'VERIFIED' ? (
            <div className="space-y-3">
              <div className="p-3.5 bg-emerald-50 rounded-2xl text-xs text-emerald-800 flex items-center justify-between">
                <div className="flex items-center gap-2 font-black font-display">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{hasSecondary ? activeDocLabel : 'Document'} Verified</span>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer border-0 bg-transparent"
                >
                  Re-open
                </button>
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="w-full py-3 rounded-full bg-[#F0F0EC] text-zinc-700 hover:bg-[#E5E5E0] text-xs font-black font-display transition-all cursor-pointer flex items-center justify-center gap-1.5 border-0"
              >
                <RotateCcw className="w-3.5 h-3.5 text-zinc-500" />
                <span>Move to Pending Review</span>
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleReject}
                  className="w-full py-3.5 rounded-full bg-[#0D0D11] hover:bg-black text-white text-xs font-black font-display tracking-wider uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 border-0"
                >
                  <XCircle className="w-4 h-4" />
                  <span>REJECT {hasSecondary ? activeDocLabel : ''}</span>
                </button>
                
                <button
                  type="button"
                  onClick={handleApprove}
                  className="w-full py-3.5 rounded-full bg-[#FFB380] hover:bg-[#F5A066] text-white text-xs font-black font-display tracking-wider uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 border-0"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>APPROVE</span>
                </button>
              </div>

              {/* Optional Reason Input with Integrated Send Button */}
              <div className="relative flex items-center bg-zinc-100 rounded-full p-1 pl-4 focus-within:ring-2 focus-within:ring-[#FFB380]/40 transition-all">
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleReject();
                    }
                  }}
                  placeholder={`Optional rejection reason for ${hasSecondary ? activeDocLabel : 'document'}...`}
                  className="w-full py-2 bg-transparent text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none font-medium border-0"
                />
                <button
                  type="button"
                  onClick={handleReject}
                  className="px-4 py-2 bg-[#0D0D11] hover:bg-black text-white text-xs font-black font-display rounded-full flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer border-0 shrink-0"
                  title="Submit Rejection"
                >
                  <span>Send</span>
                  <Send className="w-3 h-3 text-[#FFB380]" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Full-Screen Zoom Modal for Cloudinary Document Scan */}
      {showImageModal && activeImageUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full bg-white rounded-3xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 bg-[#0D0D11] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h4 className="font-black font-display text-sm">{selectedItem.name} — {selectedItem.documentType}</h4>
                  <p className="text-[11px] text-zinc-400 font-medium">Authenticated Scan</p>
                </div>
                {hasSecondary && (
                  <div className="flex items-center gap-1 bg-zinc-800 p-1 rounded-full">
                    <button
                      type="button"
                      onClick={() => { setIdSide('front'); setImageRotation(0); }}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        idSide === 'front' ? 'bg-white text-zinc-900' : 'text-zinc-300 hover:text-white'
                      }`}
                    >
                      {primaryDocLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIdSide('back'); setImageRotation(0); }}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        idSide === 'back' ? 'bg-white text-zinc-900' : 'text-zinc-300 hover:text-white'
                      }`}
                    >
                      {secondaryDocLabel}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setImageRotation((prev) => (prev + 90) % 360)}
                  className="px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                  title="Rotate Scan 90°"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Rotate ({imageRotation}°)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowImageModal(false)}
                  className="p-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 max-h-[80vh] overflow-auto flex items-center justify-center bg-[#0D0D11]">
              <img
                src={activeImageUrl}
                alt={`Document Full Scan ${idSide}`}
                style={{ transform: `rotate(${imageRotation}deg)`, transition: 'transform 0.25s ease' }}
                className="max-h-[75vh] w-auto object-contain rounded-2xl"
              />
            </div>
          </div>
        </div>
      )}

      {/* Side-by-Side Face & Identity Verification Comparison Modal */}
      <IdentityComparisonModal
        isOpen={isComparisonModalOpen}
        onClose={() => setIsComparisonModalOpen(false)}
        user={{
          name: selectedItem.name,
          role: selectedItem.role,
          email: selectedItem.email,
          contactNumber: selectedItem.contactNumber,
          avatar: selectedItem.avatar,
          barangay: selectedItem.barangay,
          hasLguCoverage: selectedItem.hasLguCoverage,
          idName: idName,
        }}
        document={{
          id: selectedItem.id,
          primaryDocumentId: selectedItem.id,
          documentType: selectedItem.documentType,
          documentNumber: docNumber,
          documentImage: selectedItem.documentImage,
          documentImageBack: selectedItem.documentImageBack,
          isPackage: selectedItem.isPackage,
          packageLabel: selectedItem.packageLabel,
          secondaryDocumentId: selectedItem.secondaryDocumentId,
          secondaryDocumentImage: selectedItem.secondaryDocumentImage,
          secondaryDocumentType: selectedItem.secondaryDocumentType,
          secondaryDocumentNumber: selectedItem.secondaryDocumentNumber,
          secondaryIssuedDate: selectedItem.secondaryIssuedDate,
          secondaryValidityDate: selectedItem.secondaryValidityDate,
          secondaryStatus: selectedItem.secondaryStatus,
          secondaryNotes: selectedItem.secondaryNotes,
          secondaryOcrData: selectedItem.secondaryOcrData,
          status: selectedItem.status,
          primaryStatus: selectedItem.primaryStatus,
          notes: selectedItem.notes,
          issuedDate: selectedItem.issuedDate,
          validityDate: selectedItem.validityDate,
          ocrExtractedData: selectedItem.ocrExtractedData,
        }}
        onApprove={selectedItem.status !== 'VERIFIED' ? (targetDocId) => {
          const targetId = targetDocId || (idSide === 'back' && selectedItem.secondaryDocumentId ? selectedItem.secondaryDocumentId : selectedItem.id);
          const targetLabel = targetId === selectedItem.secondaryDocumentId ? secondaryDocLabel : primaryDocLabel;
          handleApproveById(targetId, targetLabel);
        } : undefined}
        onReject={(reason, documentId) => {
          const targetId = documentId || (idSide === 'back' && selectedItem.secondaryDocumentId ? selectedItem.secondaryDocumentId : selectedItem.id);
          const targetLabel = targetId === selectedItem.secondaryDocumentId ? secondaryDocLabel : primaryDocLabel;
          handleRejectById(targetId, reason, targetLabel);
        }}
        onReset={(documentId) => {
          const targetId = documentId || (idSide === 'back' && selectedItem.secondaryDocumentId ? selectedItem.secondaryDocumentId : selectedItem.id);
          const targetLabel = targetId === selectedItem.secondaryDocumentId ? secondaryDocLabel : primaryDocLabel;
          handleResetById(targetId, targetLabel);
        }}
      />
    </>
  );
};
