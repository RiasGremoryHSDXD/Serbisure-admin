import React from 'react';
import type { VerificationStatus } from '../../types/admin';

export const VerificationStatusBadge: React.FC<{ status: VerificationStatus }> = ({ status }) => {
  const colors = status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700'
    : status === 'REJECTED' ? 'bg-rose-50 text-rose-700'
    : status === 'NO_DOCUMENTS' ? 'bg-zinc-100 text-zinc-500' : 'bg-amber-50 text-amber-800';
  const label = status === 'VERIFIED' ? 'Verified' : status === 'REJECTED' ? 'Rejected'
    : status === 'NO_DOCUMENTS' ? 'No documents' : 'Pending Review';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap ${colors}`}>{label}</span>;
};
