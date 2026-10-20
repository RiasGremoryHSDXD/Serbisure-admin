import React from 'react';
import { VerificationQueue } from '../components/verifications/VerificationQueue';
import { DocumentPreview } from '../components/verifications/DocumentPreview';

export const VerificationsPage: React.FC = () => {
  return (
    <div className="min-w-0 space-y-5 sm:space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black font-display text-[#0D0D11] tracking-tight">
          Verification Queue
        </h1>
        <p className="text-xs text-zinc-500 leading-relaxed font-medium mt-1">
          Review credentials and statutory IDs submitted by Kasambahays and Homeowners
        </p>
      </div>

      {/* Grid matching Mockup #3 (Active Requests on Left, Document Preview on Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        <div className="min-w-0 lg:col-span-7">
          <VerificationQueue />
        </div>
        <div className="min-w-0 lg:col-span-5">
          <DocumentPreview />
        </div>
      </div>
    </div>
  );
};
