import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, FileText, RotateCw, Clock, CheckCircle, XCircle, FileQuestion } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { AccountRole } from '../../types/admin';
import { getOptimizedWebpUrl } from '../../utils/imageOptimizer';

type StatusFilter = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'NO_DOCUMENTS' | 'ALL';

export const VerificationQueue: React.FC = () => {
  const { 
    verifications, 
    selectedVerificationId, 
    setSelectedVerificationId,
    openComparisonModal,
    isLoadingVerifications,
    refreshVerifications,
    currentRole,
    selectedBarangay,
    userBarangays,
  } = useAdmin();
  
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
  const [roleFilter, setRoleFilter] = useState<'ALL' | AccountRole>('ALL');
  const [barangayFilter, setBarangayFilter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'RECENT' | 'OLDEST'>('RECENT');

  // Helper to normalize barangay strings
  const cleanBarangayName = (name?: string) => {
    return (name || '').replace(/^(brgy\.?|barangay)\s+/i, '').trim();
  };

  // Dynamically compute all distinct barangays across registered residents and queue verifications
  const allBarangayOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    (userBarangays || []).forEach((b) => {
      const cleaned = cleanBarangayName(b);
      if (cleaned && cleaned.toLowerCase() !== 'all' && cleaned.toLowerCase() !== 'all barangays' && cleaned.toLowerCase() !== 'unassigned') {
        const key = cleaned.toLowerCase();
        if (!map.has(key)) {
          const formatted = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
          map.set(key, formatted);
        }
      }
    });

    verifications.forEach((v) => {
      const cleaned = cleanBarangayName(v.barangay);
      if (cleaned && cleaned.toLowerCase() !== 'all' && cleaned.toLowerCase() !== 'all barangays' && cleaned.toLowerCase() !== 'unassigned') {
        const key = cleaned.toLowerCase();
        if (!map.has(key)) {
          const formatted = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
          map.set(key, formatted);
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [userBarangays, verifications]);

  const hasUnassigned = React.useMemo(() => {
    return verifications.some(
      v => v.hasLguCoverage === false || !v.barangay || cleanBarangayName(v.barangay).toLowerCase() === 'unassigned'
    );
  }, [verifications]);

  // Strictly scope queue to assigned barangay if logged in as local LGU officer or unassigned perspective
  const scopedVerifications = (currentRole === 'ADMIN' && selectedBarangay)
    ? verifications.filter(v => (v.barangay || '').toLowerCase() === selectedBarangay.toLowerCase())
    : (selectedBarangay === 'UNASSIGNED'
        ? verifications.filter(v => v.hasLguCoverage === false || (v.barangay || '').toLowerCase() === 'unassigned')
        : verifications);

  // Barangay filter strictly for Superadmin (specific LGU admins are already scoped to their assigned LGU)
  const barangayScopedVerifications = (currentRole === 'SUPERADMIN' && barangayFilter !== 'ALL')
    ? scopedVerifications.filter(v => {
        if (barangayFilter === 'UNASSIGNED') {
          return v.hasLguCoverage === false || !v.barangay || cleanBarangayName(v.barangay).toLowerCase() === 'unassigned';
        }
        return cleanBarangayName(v.barangay).toLowerCase() === cleanBarangayName(barangayFilter).toLowerCase();
      })
    : scopedVerifications;

  const pendingCount = barangayScopedVerifications.filter(v => v.status === 'PENDING / REVIEW').length;
  const verifiedCount = barangayScopedVerifications.filter(v => v.status === 'VERIFIED').length;
  const rejectedCount = barangayScopedVerifications.filter(v => v.status === 'REJECTED').length;
  const noDocumentsCount = barangayScopedVerifications.filter(v => v.status === 'NO_DOCUMENTS').length;
  const totalCount = barangayScopedVerifications.length;

  const filteredVerifications = barangayScopedVerifications
    .filter(v => {
      // Status filter
      if (statusFilter === 'PENDING' && v.status !== 'PENDING / REVIEW') return false;
      if (statusFilter === 'VERIFIED' && v.status !== 'VERIFIED') return false;
      if (statusFilter === 'REJECTED' && v.status !== 'REJECTED') return false;
      if (statusFilter === 'NO_DOCUMENTS' && v.status !== 'NO_DOCUMENTS') return false;

      // Role filter
      if (roleFilter !== 'ALL' && v.role !== roleFilter) return false;

      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.submittedDate).getTime() || 0;
      const dateB = new Date(b.submittedDate).getTime() || 0;
      return sortOrder === 'RECENT' ? dateB - dateA : dateA - dateB;
    });

  // Pagination State (10 items per page)
  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Total filtered records
  const totalRecords = filteredVerifications.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / ITEMS_PER_PAGE));

  // Reset pagination to page 1 whenever any filter or sorting criteria changes
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, roleFilter, barangayFilter, sortOrder, selectedBarangay]);

  // Idiot-proof clamp: If currentPage is somehow greater than totalPages, clamp safely
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Sliced paginated records for the current page
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalRecords);
  const paginatedVerifications = filteredVerifications.slice(startIndex, endIndex);

  // Auto-select first item on the current page if current selection is not visible on this page
  useEffect(() => {
    if (paginatedVerifications.length > 0) {
      const isVisibleOnPage = paginatedVerifications.some(v => v.id === selectedVerificationId);
      if (!isVisibleOnPage) {
        setSelectedVerificationId(paginatedVerifications[0].id);
      }
    }
  }, [paginatedVerifications, selectedVerificationId, setSelectedVerificationId]);

  // Generate page numbers with ellipsis for large page counts
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 h-full flex flex-col">
      {/* Header with Filters */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between pb-5 gap-3.5">
        <div>
          <h3 className="text-xl font-black font-display text-[#0D0D11] tracking-tight">
            Verification Queue
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5 font-medium">
            {currentRole === 'SUPERADMIN' && barangayFilter !== 'ALL' && (
              <span className="text-zinc-700 font-bold mr-1">
                [{barangayFilter === 'UNASSIGNED' ? 'Unassigned' : `Brgy. ${barangayFilter}`}]
              </span>
            )}
            {statusFilter === 'PENDING' 
              ? `${pendingCount} document${pendingCount === 1 ? '' : 's'} awaiting review`
              : statusFilter === 'NO_DOCUMENTS'
              ? `${noDocumentsCount} user${noDocumentsCount === 1 ? '' : 's'} without documents`
              : `${filteredVerifications.length} record${filteredVerifications.length === 1 ? '' : 's'} listed`}
          </p>
        </div>

        {/* Filter Controls Bar - Strictly flex-nowrap so Refresh Button is always beside Recent First */}
        <div className="flex items-center gap-2 flex-nowrap shrink-0 overflow-x-auto max-w-full py-0.5">
          {/* Barangay Filter Dropdown - SUPERADMIN ONLY */}
          {currentRole === 'SUPERADMIN' && (
            <div className="relative shrink-0">
              <select
                value={barangayFilter}
                onChange={(e) => setBarangayFilter(e.target.value)}
                className="appearance-none bg-[#F0F0EC] hover:bg-[#EBEBE6] text-zinc-800 text-xs font-bold py-2 pl-3.5 pr-8 rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FFB380]/40 border-0 transition-colors"
                title="Filter residents by Barangay"
              >
                <option value="ALL">All Barangays</option>
                {allBarangayOptions.map((bgy) => (
                  <option key={bgy} value={bgy}>
                    Brgy. {bgy}
                  </option>
                ))}
                {hasUnassigned && (
                  <option value="UNASSIGNED">Unassigned / No LGU</option>
                )}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-600 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {/* Role Filter Dropdown */}
          <div className="relative shrink-0">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="appearance-none bg-[#F0F0EC] hover:bg-[#EBEBE6] text-zinc-800 text-xs font-bold py-2 pl-3.5 pr-8 rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FFB380]/40 border-0 transition-colors"
            >
              <option value="ALL">All Roles</option>
              <option value="KASAMBAHAY">Kasambahay</option>
              <option value="HOMEOWNER">Homeowner</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-600 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Sort Order Dropdown */}
          <div className="relative shrink-0">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="appearance-none bg-[#F0F0EC] hover:bg-[#EBEBE6] text-zinc-800 text-xs font-bold py-2 pl-3.5 pr-8 rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FFB380]/40 border-0 transition-colors"
            >
              <option value="RECENT">Recent First</option>
              <option value="OLDEST">Oldest First</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-600 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Live Sync Refresh Button - Sleek, integrated, always beside Recent First filter */}
          <button
            type="button"
            onClick={() => refreshVerifications()}
            title="Sync with Backend"
            className="w-[34px] h-[34px] rounded-full bg-[#F0F0EC] text-zinc-700 hover:bg-[#E5E5E0] hover:text-zinc-900 transition-all flex items-center justify-center shrink-0 cursor-pointer border-0 active:scale-95"
            aria-label="Refresh Queue"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoadingVerifications ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Status Filter Tabs - Unified Pill Badges */}
      <div className="flex items-center gap-2 pb-4 overflow-x-auto">
        {[
          { id: 'PENDING', label: 'Pending', icon: Clock, count: pendingCount },
          { id: 'VERIFIED', label: 'Verified', icon: CheckCircle, count: verifiedCount },
          { id: 'REJECTED', label: 'Rejected', icon: XCircle, count: rejectedCount },
          { id: 'NO_DOCUMENTS', label: 'No Documents', icon: FileQuestion, count: noDocumentsCount },
          { id: 'ALL', label: 'All', icon: null, count: totalCount },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-4 py-2 rounded-full text-xs font-bold font-display transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-[#0D0D11] text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900'
              }`}
            >
              {Icon && (
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#FFB380]' : 'text-zinc-400'}`} />
              )}
              <span>{tab.label}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                isActive ? 'bg-[#FFB380] text-white' : 'bg-white text-zinc-600'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Requests Table or Empty State */}
      {filteredVerifications.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center text-center my-auto">
          <div className="w-14 h-14 rounded-3xl bg-zinc-100 text-zinc-500 flex items-center justify-center mb-3">
            <CheckCircle className="w-7 h-7" />
          </div>
          <h4 className="text-base font-black font-display text-[#0D0D11]">
            {statusFilter === 'PENDING' 
              ? 'No Pending Requests' 
              : statusFilter === 'NO_DOCUMENTS'
              ? 'No Unsubmitted Users'
              : 'No Records Found'}
          </h4>
          <p className="text-xs text-zinc-400 max-w-xs mt-1 font-medium">
            {statusFilter === 'PENDING'
              ? 'All submitted documents in this category have been reviewed.'
              : statusFilter === 'NO_DOCUMENTS'
              ? 'All registered users in this category have submitted their verification documents.'
              : `There are currently no records matching the selected filters.`}
          </p>
          {statusFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className="mt-4 px-5 py-2 rounded-full bg-[#0D0D11] text-white text-xs font-bold font-display hover:bg-black transition-all cursor-pointer"
            >
              View All Records ({totalCount})
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead>
              <tr className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 font-display">
                <th className="py-2.5 px-2.5">User & Role</th>
                <th className="py-2.5 px-2.5">Document</th>
                <th className="py-2.5 px-2.5">Submitted</th>
                <th className="py-2.5 px-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="text-xs space-y-1">
              {paginatedVerifications.map((item) => {
                const isSelected = selectedVerificationId === item.id;
                const isUnsubmitted = item.status === 'NO_DOCUMENTS' || item.hasDocuments === false;
                const displayStatus = item.status === 'PENDING / REVIEW' 
                  ? 'In Review' 
                  : item.status === 'VERIFIED' 
                  ? 'Verified' 
                  : item.status === 'REJECTED' 
                  ? 'Rejected' 
                  : 'Not Submitted';

                return (
                  <tr
                    key={item.id}
                    onClick={() => {
                      setSelectedVerificationId(item.id);
                      openComparisonModal(item.id);
                    }}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-zinc-100 text-zinc-950'
                        : 'hover:bg-zinc-50/80 text-zinc-700'
                    }`}
                    title={isUnsubmitted ? "Click to view resident profile photo & details" : "Click to inspect Face & Identity comparison"}
                  >
                    {/* User & Role */}
                    <td className="py-2.5 px-2.5 rounded-l-2xl whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 min-w-[32px] min-h-[32px] rounded-full overflow-hidden shrink-0 bg-zinc-100 flex items-center justify-center">
                          {item.avatar ? (
                            <img
                              src={getOptimizedWebpUrl(item.avatar, { width: 64, height: 64, quality: 'auto' })}
                              alt={item.name}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className="font-bold text-xs text-zinc-500">
                              {item.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-[#0D0D11] leading-tight">
                            {item.name}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-zinc-600 font-bold">
                              {item.barangay ? (item.barangay.toLowerCase().startsWith('brgy') ? item.barangay : `Brgy. ${item.barangay}`) : 'Brgy. Unassigned'}
                            </span>
                            <span className="text-[10px] text-zinc-300">•</span>
                            <span className="text-[10px] text-zinc-400 font-medium">
                              {item.role === 'KASAMBAHAY' ? 'Kasambahay' : item.role === 'HOMEOWNER' ? 'Homeowner' : item.role}
                            </span>
                            {item.hasLguCoverage === false && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                                No LGU
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Document Type (Consolidated Package or Single Doc or Unsubmitted) */}
                    <td className="py-2.5 px-2.5 whitespace-nowrap">
                      {isUnsubmitted ? (
                        <div className="flex items-center gap-1.5 text-zinc-400">
                          <FileQuestion className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="font-medium text-xs text-zinc-500 italic">
                            No Documents Uploaded
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span className="font-medium text-xs text-zinc-800">
                            {item.isPackage ? (item.packageLabel || item.documentType) : item.documentType}
                          </span>
                          {item.isPackage && (
                            <span className="text-[10px] text-zinc-400 font-normal">
                              · 2 docs
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Submitted Date */}
                    <td className="py-2.5 px-2.5 text-xs font-medium text-zinc-400 whitespace-nowrap" title={item.submittedDate}>
                      {isUnsubmitted ? '—' : item.submittedDate.split(' ').slice(0, 3).join(' ')}
                    </td>

                    {/* Status Pill (Minimal with dot indicator) */}
                    <td className="py-2.5 px-2.5 text-right rounded-r-2xl whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap ${
                          item.status === 'VERIFIED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : item.status === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700'
                            : item.status === 'NO_DOCUMENTS'
                            ? 'bg-zinc-100 text-zinc-600'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            item.status === 'VERIFIED'
                              ? 'bg-emerald-500'
                              : item.status === 'REJECTED'
                              ? 'bg-rose-500'
                              : item.status === 'NO_DOCUMENTS'
                              ? 'bg-zinc-400'
                              : 'bg-amber-500'
                          }`}
                        />
                        {item.isPackage && item.status === 'REJECTED' && (item.primaryStatus !== 'REJECTED' || item.secondaryStatus !== 'REJECTED')
                          ? 'Partial Reject'
                          : displayStatus}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Bar - Idiot-proof, edge-case safe, and responsive */}
      {filteredVerifications.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-zinc-100 mt-auto">
          {/* Left: Summary text */}
          <div className="text-xs text-zinc-500 font-medium">
            Showing <span className="font-bold text-zinc-900">{startIndex + 1}</span> to{' '}
            <span className="font-bold text-zinc-900">{endIndex}</span> of{' '}
            <span className="font-bold text-zinc-900">{totalRecords}</span> records
            {totalPages > 1 && (
              <span className="ml-2 text-zinc-400 font-normal">
                (Page {currentPage} of {totalPages})
              </span>
            )}
          </div>

          {/* Right: Pagination Controls */}
          <div className="flex items-center gap-1.5 select-none">
            {/* Previous Page */}
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 border-0 ${
                currentPage === 1
                  ? 'bg-zinc-100 text-zinc-300 cursor-not-allowed pointer-events-none'
                  : 'bg-[#F0F0EC] text-zinc-700 hover:bg-[#E5E5E0] hover:text-zinc-950 cursor-pointer active:scale-95'
              }`}
              aria-label="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Prev</span>
            </button>

            {/* Page Number Pills */}
            <div className="flex items-center gap-1">
              {getPageNumbers().map((page, idx) => {
                if (page === '...') {
                  return (
                    <span
                      key={`ellipsis-${idx}`}
                      className="w-7 h-7 flex items-center justify-center text-xs text-zinc-400 font-bold select-none"
                    >
                      ...
                    </span>
                  );
                }

                const pageNum = page as number;
                const isActive = pageNum === currentPage;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => pageNum !== currentPage && setCurrentPage(pageNum)}
                    className={`w-7 h-7 rounded-full text-xs font-bold font-display transition-all flex items-center justify-center cursor-pointer border-0 ${
                      isActive
                        ? 'bg-[#0D0D11] text-white shadow-xs pointer-events-none'
                        : 'bg-[#F0F0EC] text-zinc-600 hover:bg-[#E5E5E0] hover:text-zinc-950 active:scale-95'
                    }`}
                    aria-label={`Page ${pageNum}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            {/* Next Page */}
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 border-0 ${
                currentPage === totalPages
                  ? 'bg-zinc-100 text-zinc-300 cursor-not-allowed pointer-events-none'
                  : 'bg-[#F0F0EC] text-zinc-700 hover:bg-[#E5E5E0] hover:text-zinc-950 cursor-pointer active:scale-95'
              }`}
              aria-label="Next Page"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
