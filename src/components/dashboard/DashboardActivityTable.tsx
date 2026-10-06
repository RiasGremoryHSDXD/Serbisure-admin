import React, { useState, useEffect, useMemo, useRef } from 'react';
import clsx from 'clsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  Search, 
  Calendar, 
  ArrowUpRight, 
  Loader2, 
  Inbox, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  RotateCcw,
  Trash2,
  XCircle,
  History,
  ShieldCheck,
  Download
} from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import type { BookingCompliance, VerificationRequest, AuditLogEntry } from '../../types/admin';

const ITEMS_PER_PAGE = 5;

function getPageNumbers(currentPage: number, totalPages: number): (number | string)[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 3) {
    return [1, 2, 3, 4, '...', totalPages];
  }
  if (currentPage >= totalPages - 2) {
    return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
}

function formatAuditDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return String(dateStr);
  }
}

function formatDocType(type?: string | null): string {
  if (!type) return 'Document';
  const t = type.toLowerCase().trim();
  if (
    t === 'national_id_front' || 
    t === 'front' || 
    t.includes('national_id_front') || 
    (t.includes('national_id') && t.includes('front')) || 
    t.includes('id (front)')
  ) {
    return 'National ID (Front)';
  }
  if (
    t === 'national_id_back' || 
    t === 'back' || 
    t.includes('national_id_back') || 
    (t.includes('national_id') && t.includes('back')) || 
    t.includes('id (back)')
  ) {
    return 'National ID (Back)';
  }
  if (t === 'nbi_clearance' || t.includes('nbi')) return 'NBI Clearance';
  if (t === 'police_clearance' || t.includes('police')) return 'Police Clearance';
  if (t.includes('national_id') || t === 'national id') return 'National ID';
  return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function escapeHtml(val: unknown): string {
  if (val == null) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getDeploymentStatusPill(status: string): string {
  const s = (status || '').toUpperCase();
  let style = 'background:#F1F5F9; color:#475569; border:1px solid #CBD5E1;';
  let label = status || 'Pending';
  if (s.includes('COMPLIANT')) {
    style = 'background:#ECFDF5; color:#065F46; border:1px solid #A7F3D0;';
    label = 'RA 10361 Compliant';
  } else if (s.includes('BELOW_MINIMUM_WAGE') || s.includes('BELOW')) {
    style = 'background:#FEF2F2; color:#991B1B; border:1px solid #FECACA;';
    label = 'Below Min. Wage';
  } else if (s.includes('FLAGGED') || s.includes('THROTTLED')) {
    style = 'background:#FFFBEB; color:#92400E; border:1px solid #FDE68A;';
    label = 'Flagged / Review';
  } else if (s.includes('ACTIVE')) {
    style = 'background:#EFF6FF; color:#1E40AF; border:1px solid #BFDBFE;';
    label = 'Active Deployment';
  } else if (s.includes('PENDING')) {
    style = 'background:#FFFBEB; color:#92400E; border:1px solid #FDE68A;';
    label = 'Pending Review';
  }
  return `<span class="pill" style="${style}">${escapeHtml(label)}</span>`;
}

function getVerificationStatusPill(status: string): string {
  const s = (status || '').toUpperCase();
  if (s.includes('VERIFIED') || s.includes('APPROVED')) {
    return `<span class="pill" style="background:#ECFDF5; color:#065F46; border:1px solid #A7F3D0;">Verified</span>`;
  }
  if (s.includes('REJECTED')) {
    return `<span class="pill" style="background:#FEF2F2; color:#991B1B; border:1px solid #FECACA;">Rejected</span>`;
  }
  if (s.includes('PENDING') || s.includes('REVIEW')) {
    return `<span class="pill" style="background:#FFFBEB; color:#92400E; border:1px solid #FDE68A;">In Review</span>`;
  }
  return `<span class="pill" style="background:#F1F5F9; color:#475569; border:1px solid #CBD5E1;">${escapeHtml(status || 'Pending')}</span>`;
}

function getAuditActionPill(action: string): string {
  const a = (action || '').toUpperCase();
  let style = 'background:#F1F5F9; color:#475569; border:1px solid #CBD5E1;';
  if (a.includes('APPROV') || a.includes('VERIF')) {
    style = 'background:#ECFDF5; color:#065F46; border:1px solid #A7F3D0;';
  } else if (a.includes('REJECT') || a.includes('DELET')) {
    style = 'background:#FEF2F2; color:#991B1B; border:1px solid #FECACA;';
  } else if (a.includes('RESET')) {
    style = 'background:#FFFBEB; color:#92400E; border:1px solid #FDE68A;';
  } else if (a.includes('UPLOAD')) {
    style = 'background:#EFF6FF; color:#1E40AF; border:1px solid #BFDBFE;';
  }
  return `<span class="pill" style="${style}">${escapeHtml(action || 'ACTION')}</span>`;
}

function formatReason(raw?: string | null): string {
  if (!raw) return 'Routine administrative action';
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  if (['0', 'q', 'qw', 'kk', 'k', 'test', 'no', 'none', '-', '.', 'n/a'].includes(lower)) {
    return 'Routine administrative action';
  }
  return trimmed.length > 75 ? trimmed.slice(0, 75) + '...' : trimmed;
}

function formatStatusTransition(prev?: string | null, next?: string | null): string {
  if (!prev && !next) return '—';
  const p = prev || 'Pending';
  const n = next || 'Updated';
  return `<span style="font-weight:700;color:#64748B;">${escapeHtml(p)}</span> <span style="color:#94A3B8;font-weight:900;margin:0 4px;">&rarr;</span> <span style="font-weight:700;color:#0F172A;">${escapeHtml(n)}</span>`;
}

function buildPdfReport(
  tab: 'DEPLOYMENTS' | 'VERIFICATIONS' | 'AUDIT_TRAIL',
  filteredBookings: BookingCompliance[],
  filteredVerifications: VerificationRequest[],
  filteredAuditLogs: AuditLogEntry[],
  meta: { barangay: string; generatedAt: string; searchTerm: string }
): string {
  let title = '';
  let subtitle = '';
  let count = 0;
  let tableHeaders = '';
  let tableRows = '';
  let colSpan = 6;

  const barangayDisplay = meta.barangay && meta.barangay !== 'All Barangays'
    ? `Barangay ${meta.barangay}`
    : 'All Barangays (City-Wide)';

  if (tab === 'DEPLOYMENTS') {
    title = 'Placement & Bookings Compliance Report';
    subtitle = 'Republic Act No. 10361 (Batas Kasambahay) Mandatory Wage Baseline & Employment Placement Register';
    count = filteredBookings.length;
    colSpan = 6;
    tableHeaders = `
      <th style="width: 5%; text-align: center;">#</th>
      <th style="width: 25%;">Employer / Household</th>
      <th style="width: 25%;">Kasambahay / Worker</th>
      <th style="width: 17%;">Monthly Wage</th>
      <th style="width: 14%;">Contract Type</th>
      <th style="width: 14%; text-align: center;">Compliance Status</th>
    `;
    tableRows = filteredBookings.map((b, idx) => {
      const employerName = b.homeownerName || 'Unassigned Employer';
      const employerSub = b.barangay ? `Barangay ${b.barangay}` : 'Barangay Not Specified';
      const workerName = b.workerName || 'Unassigned Worker';
      const workerSub = b.serviceCategory || 'Domestic Worker';
      const wageDisplay = b.offeredWage != null ? `₱${Number(b.offeredWage).toLocaleString()}` : '—';
      const isBelowWage = Boolean(b.isBelowMinimumWage);
      const contract = b.contractType || 'Standard Agreement';
      const contractDisplay = contract.includes('Formal')
        ? 'Formal (Long-Term)'
        : contract.includes('Short')
        ? 'Short-Term On-Demand'
        : contract;
      const rawStatus = b.bookingStatus || b.status || 'Pending';

      return `
        <tr>
          <td style="text-align: center; color: #94A3B8; font-weight: 700;">${idx + 1}</td>
          <td>
            <div class="name-bold">${escapeHtml(employerName)}</div>
            <div class="sub-text">${escapeHtml(employerSub)}</div>
          </td>
          <td>
            <div class="name-bold">${escapeHtml(workerName)}</div>
            <div class="sub-text">${escapeHtml(workerSub)}</div>
          </td>
          <td>
            <div style="font-weight: 800; font-size: 13px; color: #0F172A;">
              ${escapeHtml(wageDisplay)} <span style="font-weight: 500; font-size: 11px; color: #64748B;">/ month</span>
            </div>
            ${isBelowWage 
              ? '<div style="font-size: 10px; font-weight: 700; color: #DC2626; margin-top: 3px;">⚠️ Below RA 10361 Min. Wage</div>' 
              : '<div style="font-size: 10px; font-weight: 700; color: #059669; margin-top: 3px;">✅ Wage Compliant</div>'}
          </td>
          <td>
            <span class="contract-badge">${escapeHtml(contractDisplay)}</span>
          </td>
          <td style="text-align: center;">${getDeploymentStatusPill(rawStatus)}</td>
        </tr>
      `;
    }).join('');
  } else if (tab === 'VERIFICATIONS') {
    title = 'Clearance & Document Verification Report';
    subtitle = 'Official Kasambahay & Homeowner Regulatory Identity Screening & Document Clearance Queue';
    count = filteredVerifications.length;
    colSpan = 7;
    tableHeaders = `
      <th style="width: 5%; text-align: center;">#</th>
      <th style="width: 24%;">Applicant Name</th>
      <th style="width: 12%;">Account Role</th>
      <th style="width: 22%;">Document Type</th>
      <th style="width: 15%;">Assigned Barangay</th>
      <th style="width: 11%;">Date Submitted</th>
      <th style="width: 11%; text-align: center;">Review Status</th>
    `;
    tableRows = filteredVerifications.map((v, idx) => {
      const applicantName = v.name || '—';
      const applicantSub = v.documentNumber ? `ID/Doc #: ${v.documentNumber}` : 'Standard Upload';
      const roleDisplay = v.role === 'KASAMBAHAY' ? 'Kasambahay' : v.role === 'HOMEOWNER' ? 'Homeowner' : (v.role || '—');
      const docDisplay = formatDocType(v.documentType);
      const brgyDisplay = v.barangay ? `Brgy. ${v.barangay}` : 'Barangay Not Stated';
      const dateDisplay = v.submittedDate || '—';
      const rawStatus = v.status || 'Pending';

      return `
        <tr>
          <td style="text-align: center; color: #94A3B8; font-weight: 700;">${idx + 1}</td>
          <td>
            <div class="name-bold">${escapeHtml(applicantName)}</div>
            <div class="sub-text">${escapeHtml(applicantSub)}</div>
          </td>
          <td>
            <span class="role-badge ${v.role === 'KASAMBAHAY' ? 'role-kasambahay' : 'role-homeowner'}">
              ${escapeHtml(roleDisplay)}
            </span>
          </td>
          <td>
            <div style="font-weight: 600; color: #1E293B;">${escapeHtml(docDisplay)}</div>
          </td>
          <td>
            <div style="font-weight: 600; color: #334155;">${escapeHtml(brgyDisplay)}</div>
          </td>
          <td style="color: #64748B; font-weight: 500;">${escapeHtml(dateDisplay)}</td>
          <td style="text-align: center;">${getVerificationStatusPill(rawStatus)}</td>
        </tr>
      `;
    }).join('');
  } else if (tab === 'AUDIT_TRAIL') {
    title = 'System Audit Trail & Administrative Activity Log';
    subtitle = 'Official Immutable Record of Administrative Reviews, Verifications, and Account Actions';
    count = filteredAuditLogs.length;
    colSpan = 7;
    tableHeaders = `
      <th style="width: 4%; text-align: center;">#</th>
      <th style="width: 18%;">Official / Actor</th>
      <th style="width: 11%; text-align: center;">Action</th>
      <th style="width: 24%;">Target Resident & Document</th>
      <th style="width: 16%;">Status Transition</th>
      <th style="width: 15%;">Reason / Remarks</th>
      <th style="width: 12%;">Recorded Timestamp</th>
    `;
    tableRows = filteredAuditLogs.map((a, idx) => {
      const actorName = a.actor_name || 'System Administrator';
      const actorSub = [a.actor_role, a.actor_barangay ? `Brgy. ${a.actor_barangay}` : ''].filter(Boolean).join(' • ') || 'LGU Administration';
      const actionPill = getAuditActionPill(a.action);
      const targetName = a.target_name || 'Resident';
      const targetSub = [formatDocType(a.document_type), a.target_barangay ? `Brgy. ${a.target_barangay}` : ''].filter(Boolean).join(' • ') || '—';
      const statusChange = formatStatusTransition(a.previous_status, a.new_status);
      const reasonDisplay = formatReason(a.reason);
      const timeDisplay = formatAuditDate(a.created_at);
      const logSub = a.log_id ? `ID #${String(a.log_id).slice(-6)}` : '';

      return `
        <tr>
          <td style="text-align: center; color: #94A3B8; font-weight: 700;">${idx + 1}</td>
          <td>
            <div class="name-bold">${escapeHtml(actorName)}</div>
            <div class="sub-text">${escapeHtml(actorSub)}</div>
          </td>
          <td style="text-align: center;">${actionPill}</td>
          <td>
            <div class="name-bold">${escapeHtml(targetName)}</div>
            <div class="sub-text">${escapeHtml(targetSub)}</div>
          </td>
          <td>
            <div style="font-size: 11.5px;">${statusChange}</div>
          </td>
          <td>
            <div style="color: #475569; font-size: 11px; line-height: 1.4;">${escapeHtml(reasonDisplay)}</div>
          </td>
          <td>
            <div style="font-weight: 700; color: #1E293B;">${escapeHtml(timeDisplay)}</div>
            ${logSub ? `<div class="sub-text" style="font-family: monospace; font-size: 10px; color: #94A3B8;">${escapeHtml(logSub)}</div>` : ''}
          </td>
        </tr>
      `;
    }).join('');
  }

  const classification = meta.searchTerm 
    ? `Filtered by "${meta.searchTerm}"` 
    : 'All Recorded Entries (Unfiltered)';

  return `
  <div class="report-wrapper" style="box-sizing: border-box; width: 1400px; background: #FFFFFF; padding: 48px 56px 72px 56px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #0F172A; line-height: 1.5; overflow: hidden;">
    <style>
      .report-wrapper * { box-sizing: border-box; }
      .brand-badge {
        display: inline-block;
        background: #F1F5F9;
        border: 1px solid #CBD5E1;
        padding: 5px 14px;
        border-radius: 999px;
        margin-bottom: 12px;
      }
      .badge-dot {
        display: inline-block;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #059669;
        vertical-align: middle;
        margin-right: 6px;
      }
      .badge-text {
        font-size: 11px;
        font-weight: 700;
        color: #1E293B;
        letter-spacing: 0.6px;
        text-transform: uppercase;
        vertical-align: middle;
      }
      .report-title {
        font-size: 26px;
        font-weight: 900;
        color: #0F172A;
        letter-spacing: -0.5px;
        margin: 0 0 6px 0;
      }
      .report-subtitle {
        font-size: 12.5px;
        font-weight: 500;
        color: #64748B;
        margin: 0;
      }
      .logo-title {
        font-size: 24px;
        font-weight: 900;
        letter-spacing: -0.5px;
        color: #0F172A;
      }
      .logo-orange {
        color: #FF7A00;
      }
      .logo-sub {
        font-size: 10px;
        font-weight: 700;
        color: #94A3B8;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        margin-top: 2px;
      }
      .meta-grid {
        width: 100%;
        table-layout: fixed;
        margin-top: 24px;
        margin-bottom: 28px;
        border-collapse: separate;
        border-spacing: 12px 0;
      }
      .meta-card {
        background: #F8FAFC;
        border: 1px solid #E2E8F0;
        border-radius: 10px;
        padding: 12px 16px;
        vertical-align: top;
      }
      .meta-card-label {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.7px;
        color: #94A3B8;
        margin-bottom: 4px;
      }
      .meta-card-val {
        font-size: 13px;
        font-weight: 800;
        color: #0F172A;
      }
      table.data-table {
        width: 100%;
        table-layout: fixed;
        border-collapse: separate;
        border-spacing: 0;
        background: #FFFFFF;
        border: 1px solid #E2E8F0;
        border-radius: 12px;
        overflow: hidden;
      }
      table.data-table thead tr {
        background: #0F172A;
      }
      table.data-table th {
        padding: 14px 16px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: #FFFFFF;
        border-bottom: 3px solid #FF7A00;
        text-align: left;
      }
      table.data-table td {
        padding: 14px 16px;
        font-size: 12px;
        border-bottom: 1px solid #F1F5F9;
        vertical-align: middle;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      table.data-table tbody tr:nth-child(even) td {
        background: #FAFAFA;
      }
      table.data-table tbody tr:last-child td {
        border-bottom: none;
      }
      .name-bold {
        font-weight: 700;
        font-size: 12.5px;
        color: #0F172A;
      }
      .sub-text {
        font-size: 10.5px;
        font-weight: 500;
        color: #64748B;
        margin-top: 3px;
      }
      .pill {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.2px;
        white-space: nowrap;
      }
      .contract-badge {
        display: inline-block;
        background: #F1F5F9;
        color: #334155;
        border: 1px solid #CBD5E1;
        font-weight: 600;
        font-size: 11px;
        padding: 3px 10px;
        border-radius: 6px;
        white-space: nowrap;
      }
      .role-badge {
        display: inline-block;
        font-weight: 700;
        font-size: 11px;
        padding: 3px 10px;
        border-radius: 6px;
        white-space: nowrap;
      }
      .role-kasambahay {
        background: #EFF6FF;
        color: #1E40AF;
        border: 1px solid #BFDBFE;
      }
      .role-homeowner {
        background: #FAF5FF;
        color: #6B21A8;
        border: 1px solid #E9D5FF;
      }
      .footer-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 36px;
        padding-top: 18px;
        border-top: 1.5px solid #E2E8F0;
        background: transparent;
      }
      .footer-table td {
        border: none;
        padding: 0;
        vertical-align: middle;
      }
    </style>

    <!-- Top Brand & Header Table -->
    <table style="width: 100%; border-collapse: collapse; border: none; background: transparent; margin-bottom: 4px;">
      <tr>
        <td style="border: none; padding: 0; vertical-align: top;">
          <div class="brand-badge">
            <span class="badge-dot"></span>
            <span class="badge-text">Republic of the Philippines &bull; City of Cagayan de Oro &bull; LGU Administration</span>
          </div>
          <h1 class="report-title">${escapeHtml(title)}</h1>
          <p class="report-subtitle">${escapeHtml(subtitle)}</p>
        </td>
        <td style="border: none; padding: 0; vertical-align: top; text-align: right; width: 280px;">
          <div class="logo-title">Serbi<span class="logo-orange">Sure</span>.</div>
          <div class="logo-sub">City Administration Portal</div>
          <div style="font-size: 11px; font-weight: 600; color: #475569; margin-top: 6px;">
            Official Registry Document
          </div>
        </td>
      </tr>
    </table>

    <!-- 4-Card Meta / KPI Grid (100% width edge-to-edge) -->
    <table class="meta-grid">
      <tr>
        <td class="meta-card" style="width: 25%;">
          <div class="meta-card-label">Assigned Jurisdiction</div>
          <div class="meta-card-val">${escapeHtml(barangayDisplay)}</div>
        </td>
        <td class="meta-card" style="width: 25%;">
          <div class="meta-card-label">Date &amp; Time Generated</div>
          <div class="meta-card-val">${escapeHtml(meta.generatedAt)}</div>
        </td>
        <td class="meta-card" style="width: 25%;">
          <div class="meta-card-label">Total Records Exported</div>
          <div class="meta-card-val" style="color: #EA580C;">${count} Record${count === 1 ? '' : 's'}</div>
        </td>
        <td class="meta-card" style="width: 25%;">
          <div class="meta-card-label">Report Classification</div>
          <div class="meta-card-val">${escapeHtml(classification)}</div>
        </td>
      </tr>
    </table>

    <!-- Primary Data Table (Occupies 100% width edge-to-edge) -->
    <table class="data-table">
      <thead>
        <tr>
          ${tableHeaders}
        </tr>
      </thead>
      <tbody>
        ${tableRows || `<tr><td colspan="${colSpan}" style="text-align:center; padding:36px; color:#94A3B8; font-weight:600; font-size:13px;">No data records found for current filters</td></tr>`}
      </tbody>
    </table>

    <!-- Official Document Footer Table (Bulletproof layout for html2canvas) -->
    <table class="footer-table">
      <tr>
        <td style="text-align: left;">
          <div style="font-size: 11px; font-weight: 700; color: #475569;">
            <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #10B981; margin-right: 6px; vertical-align: middle;"></span>
            Official LGU Compliance Record &bull; Generated via SerbiSure Management Portal
          </div>
          <div style="font-size: 10px; color: #94A3B8; margin-top: 4px; line-height: 1.4;">
            Confidential Document &bull; Protected under Republic Act No. 10361 (Batas Kasambahay) and Republic Act No. 10173 (Data Privacy Act of 2012).
          </div>
        </td>
        <td style="text-align: right; width: 340px;">
          <div style="font-size: 11px; font-weight: 700; color: #475569;">
            City Government of Cagayan de Oro
          </div>
          <div style="font-size: 10px; color: #94A3B8; margin-top: 4px;">
            Official Administrative Export &bull; Verified Registry Copy
          </div>
        </td>
      </tr>
    </table>
  </div>
  `;
}

export const DashboardActivityTable: React.FC = () => {
  const { verifications, bookings, auditLogs, isLoadingDashboardActivity, isLoadingAuditLogs, setActiveNav, currentRole, selectedBarangay } = useAdmin();
  const [activeTab, setActiveTab] = useState<'DEPLOYMENTS' | 'VERIFICATIONS' | 'AUDIT_TRAIL'>('DEPLOYMENTS');
  const [searchTerm, setSearchTerm] = useState('');
  const [bookingsPage, setBookingsPage] = useState(1);
  const [verificationsPage, setVerificationsPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const exportContainerRef = useRef<HTMLDivElement>(null);

  // Scope to assigned barangay if logged in as local LGU officer
  const scopedVerifications = useMemo(() => {
    return (currentRole === 'ADMIN' && selectedBarangay)
      ? verifications.filter(v => (v.barangay || '').toLowerCase() === selectedBarangay.toLowerCase())
      : verifications;
  }, [currentRole, selectedBarangay, verifications]);

  const scopedBookings = useMemo(() => {
    return (currentRole === 'ADMIN' && selectedBarangay)
      ? bookings.filter(b => (b.barangay || '').toLowerCase() === selectedBarangay.toLowerCase())
      : bookings;
  }, [currentRole, selectedBarangay, bookings]);

  const scopedAuditLogs = useMemo(() => {
    return (currentRole === 'ADMIN' && selectedBarangay)
      ? auditLogs.filter(a => 
          (a.actor_barangay || '').toLowerCase() === selectedBarangay.toLowerCase() ||
          (a.target_barangay || '').toLowerCase() === selectedBarangay.toLowerCase()
        )
      : auditLogs;
  }, [currentRole, selectedBarangay, auditLogs]);

  // Reset pagination on filter or tab changes
  useEffect(() => {
    setBookingsPage(1);
    setVerificationsPage(1);
    setAuditPage(1);
  }, [searchTerm, selectedBarangay, activeTab]);

  // Filtered lists
  const filteredBookings = useMemo(() => {
    if (!searchTerm.trim()) return scopedBookings;
    const q = searchTerm.toLowerCase().trim();
    return scopedBookings.filter(b => 
      (b.homeownerName || '').toLowerCase().includes(q) ||
      (b.workerName || '').toLowerCase().includes(q) ||
      (b.contractType || '').toLowerCase().includes(q) ||
      (b.serviceCategory || '').toLowerCase().includes(q) ||
      (b.barangay || '').toLowerCase().includes(q) ||
      (b.bookingStatus || '').toLowerCase().includes(q)
    );
  }, [scopedBookings, searchTerm]);

  const filteredVerifications = useMemo(() => {
    if (!searchTerm.trim()) return scopedVerifications;
    const q = searchTerm.toLowerCase().trim();
    return scopedVerifications.filter(v => 
      (v.name || '').toLowerCase().includes(q) ||
      (v.role || '').toLowerCase().includes(q) ||
      (v.documentType || '').toLowerCase().includes(q) ||
      (v.barangay || '').toLowerCase().includes(q) ||
      (v.status || '').toLowerCase().includes(q)
    );
  }, [scopedVerifications, searchTerm]);

  const filteredAuditLogs = useMemo(() => {
    if (!searchTerm.trim()) return scopedAuditLogs;
    const q = searchTerm.toLowerCase().trim();
    return scopedAuditLogs.filter(a => 
      (a.actor_name || '').toLowerCase().includes(q) ||
      (a.actor_role || '').toLowerCase().includes(q) ||
      (a.actor_barangay || '').toLowerCase().includes(q) ||
      (a.target_name || '').toLowerCase().includes(q) ||
      (a.target_barangay || '').toLowerCase().includes(q) ||
      (a.document_type || '').toLowerCase().includes(q) ||
      formatDocType(a.document_type).toLowerCase().includes(q) ||
      (a.action || '').toLowerCase().includes(q) ||
      (a.reason || '').toLowerCase().includes(q)
    );
  }, [scopedAuditLogs, searchTerm]);

  // Safe pagination calculations for bookings
  const totalBookings = filteredBookings.length;
  const totalBookingPages = Math.max(1, Math.ceil(totalBookings / ITEMS_PER_PAGE));
  const safeBookingsPage = Math.min(Math.max(1, bookingsPage), totalBookingPages);
  const startBookingIdx = (safeBookingsPage - 1) * ITEMS_PER_PAGE;
  const endBookingIdx = Math.min(startBookingIdx + ITEMS_PER_PAGE, totalBookings);
  const paginatedBookings = filteredBookings.slice(startBookingIdx, endBookingIdx);

  // Safe pagination calculations for verifications
  const totalVerifications = filteredVerifications.length;
  const totalVerifPages = Math.max(1, Math.ceil(totalVerifications / ITEMS_PER_PAGE));
  const safeVerifPage = Math.min(Math.max(1, verificationsPage), totalVerifPages);
  const startVerifIdx = (safeVerifPage - 1) * ITEMS_PER_PAGE;
  const endVerifIdx = Math.min(startVerifIdx + ITEMS_PER_PAGE, totalVerifications);
  const paginatedVerifications = filteredVerifications.slice(startVerifIdx, endVerifIdx);

  // Safe pagination calculations for audit logs
  const totalAuditLogs = filteredAuditLogs.length;
  const totalAuditPages = Math.max(1, Math.ceil(totalAuditLogs / ITEMS_PER_PAGE));
  const safeAuditPage = Math.min(Math.max(1, auditPage), totalAuditPages);
  const startAuditIdx = (safeAuditPage - 1) * ITEMS_PER_PAGE;
  const endAuditIdx = Math.min(startAuditIdx + ITEMS_PER_PAGE, totalAuditLogs);
  const paginatedAuditLogs = filteredAuditLogs.slice(startAuditIdx, endAuditIdx);

  // Helper for status badge styling
  const renderBookingStatusBadge = (status?: string) => {
    const s = (status || 'Pending').toLowerCase();
    if (s.includes('complete')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Completed</span>
        </span>
      );
    }
    if (s.includes('progress') || s.includes('accepted')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700">
          <Clock className="w-3.5 h-3.5 text-sky-600" />
          <span>{s.includes('progress') ? 'In Progress' : 'Accepted'}</span>
        </span>
      );
    }
    if (s.includes('cancel')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-zinc-100 text-zinc-600">
          <AlertCircle className="w-3.5 h-3.5 text-zinc-400" />
          <span>Cancelled</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700">
        <Clock className="w-3.5 h-3.5 text-amber-500" />
        <span>Pending</span>
      </span>
    );
  };

  const renderAuditActionBadge = (action: string) => {
    const act = (action || '').toUpperCase();
    if (act === 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Approved</span>
        </span>
      );
    }
    if (act === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700">
          <XCircle className="w-3.5 h-3.5 text-rose-600" />
          <span>Rejected</span>
        </span>
      );
    }
    if (act === 'RESET') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800">
          <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
          <span>Reset</span>
        </span>
      );
    }
    if (act === 'DELETED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-zinc-100 text-zinc-700">
          <Trash2 className="w-3.5 h-3.5 text-zinc-500" />
          <span>Deleted</span>
        </span>
      );
    }
    if (act === 'UPLOADED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700">
          <Clock className="w-3.5 h-3.5 text-sky-600" />
          <span>Uploaded</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-zinc-100 text-zinc-800">
        <span>{act}</span>
      </span>
    );
  };

  const handleExportPdf = async () => {
    const isEmpty = 
      (activeTab === 'DEPLOYMENTS' && filteredBookings.length === 0) ||
      (activeTab === 'VERIFICATIONS' && filteredVerifications.length === 0) ||
      (activeTab === 'AUDIT_TRAIL' && filteredAuditLogs.length === 0);

    if (isEmpty) {
      setExportMessage('No data to export for the current filters.');
      setTimeout(() => setExportMessage(null), 3000);
      return;
    }

    if (!exportContainerRef.current) {
      setExportMessage('Export failed. Please try again.');
      setTimeout(() => setExportMessage(null), 4000);
      return;
    }

    setIsExporting(true);

    const TAB_LABELS: Record<string, string> = {
      DEPLOYMENTS: 'placements-bookings',
      VERIFICATIONS: 'verifications',
      AUDIT_TRAIL: 'audit-trail',
    };
    const tabLabel = TAB_LABELS[activeTab] ?? 'report';
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `serbisure-report-${tabLabel}-${dateStr}.pdf`;

    const barangay = selectedBarangay || 'All Barangays';
    const generatedAt = new Date().toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const htmlString = buildPdfReport(
      activeTab,
      filteredBookings,
      filteredVerifications,
      filteredAuditLogs,
      { barangay, generatedAt, searchTerm }
    );

    try {
      exportContainerRef.current.innerHTML = htmlString;
      const canvas = await html2canvas(exportContainerRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#FFFFFF',
        windowWidth: 1400,
        scrollX: 0,
        scrollY: 0,
      });
      const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
      const pdf = new jsPDF({
        orientation,
        unit: 'px',
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(filename);
      exportContainerRef.current.innerHTML = '';
      setExportMessage('✓ Report downloaded successfully.');
      setTimeout(() => setExportMessage(null), 3000);
    } catch {
      if (exportContainerRef.current) exportContainerRef.current.innerHTML = '';
      setExportMessage('Export failed. Please try again.');
      setTimeout(() => setExportMessage(null), 4000);
    } finally {
      setIsExporting(false);
    }
  };

  const isExportWarning = Boolean(
    exportMessage && (
      exportMessage.startsWith('No data') ||
      exportMessage.startsWith('Please allow') ||
      exportMessage.startsWith('Export failed')
    )
  );

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-zinc-100/80">
      {/* Top Tabs & Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5">
        
        {/* Navigation Tabs with Pills */}
        <div className="flex items-center gap-2 overflow-x-auto text-xs font-extrabold font-display pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('DEPLOYMENTS')}
            className={`px-5 py-2.5 rounded-full transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'DEPLOYMENTS'
                ? 'bg-[#0D0D11] text-white font-black shadow-xs'
                : 'bg-[#F0F0EC] text-zinc-600 hover:bg-[#EAEAE5] hover:text-zinc-900'
            }`}
          >
            Placement & Bookings
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('VERIFICATIONS')}
            className={`px-5 py-2.5 rounded-full transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'VERIFICATIONS'
                ? 'bg-[#0D0D11] text-white font-black shadow-xs'
                : 'bg-[#F0F0EC] text-zinc-600 hover:bg-[#EAEAE5] hover:text-zinc-900'
            }`}
          >
            Recent Clearances ({scopedVerifications.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('AUDIT_TRAIL')}
            className={`px-5 py-2.5 rounded-full transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'AUDIT_TRAIL'
                ? 'bg-[#0D0D11] text-white font-black shadow-xs'
                : 'bg-[#F0F0EC] text-zinc-600 hover:bg-[#EAEAE5] hover:text-zinc-900'
            }`}
          >
            Audit Trail ({scopedAuditLogs.length})
          </button>
        </div>

        {/* Right Search & Filter Pill Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search records..."
              className="pl-9 pr-4 py-1.5 bg-[#F0F0EC] hover:bg-[#EAEAE5] focus:bg-white rounded-full text-xs font-medium text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#FFB380]/40 transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#F0F0EC] rounded-full text-xs font-bold text-zinc-700">
            <Calendar className="w-3.5 h-3.5 text-[#FFB380]" />
            <span>{new Date().toLocaleString('default', { month: 'short', year: 'numeric' })}</span>
          </div>

          <button
            id="export-pdf-btn"
            type="button"
            onClick={handleExportPdf}
            disabled={isExporting}
            title="Download current tab as PDF"
            className={clsx(
              'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all',
              isExporting
                ? 'bg-zinc-100 text-zinc-400 opacity-60 cursor-not-allowed'
                : 'bg-[#F0F0EC] hover:bg-[#EAEAE5] text-zinc-700 cursor-pointer'
            )}
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-500" />
            ) : (
              <Download className="w-3.5 h-3.5 text-zinc-600" />
            )}
            <span>{isExporting ? 'Generating...' : 'Export'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveNav('verifications')}
            className="flex items-center gap-1 px-4 py-1.5 bg-[#FFB380] hover:bg-[#F5A066] text-white rounded-full text-xs font-black font-display transition-transform active:scale-95 cursor-pointer"
          >
            <span>Full Queue</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Export notification toast */}
      {exportMessage && (
        <div
          className={`flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-xl mb-3 transition-all ${
            isExportWarning
              ? 'bg-amber-50 text-amber-800 border border-amber-200/60'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
          }`}
        >
          {isExportWarning ? (
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          <span>{exportMessage}</span>
        </div>
      )}

      {/* Table Content */}
      <div className="overflow-x-auto mt-2">
        {activeTab === 'DEPLOYMENTS' && (
          isLoadingDashboardActivity ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-zinc-400">
              <Loader2 className="w-5 h-5 animate-spin text-[#FFB380]" />
              <p className="text-xs font-medium">Loading live placement data...</p>
            </div>
          ) : totalBookings === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-zinc-400">
              <Inbox className="w-8 h-8 text-zinc-300" />
              <p className="text-xs font-bold text-zinc-600">
                {searchTerm ? `No placements matching "${searchTerm}"` : 'No active placements found'}
              </p>
              <p className="text-[11px] text-zinc-400 max-w-sm text-center">
                {searchTerm 
                  ? 'Try checking for typos or searching by another worker or employer name.' 
                  : 'Bookings will appear here once registered on the platform.'}
              </p>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="mt-2 px-4 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition-all cursor-pointer"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-zinc-400 font-extrabold font-display uppercase tracking-wider text-[11px]">
                    <th className="pb-3 px-3">Employer</th>
                    <th className="pb-3 px-3">Kasambahay</th>
                    <th className="pb-3 px-3">Monthly Wage</th>
                    <th className="pb-3 px-3">Contract Type</th>
                    <th className="pb-3 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="font-medium text-zinc-700">
                  {paginatedBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-[#F6F5F2] rounded-2xl transition-colors">
                      <td className="py-3 px-3 rounded-l-2xl">
                        <div className="flex items-center gap-2.5">
                          <img src={b.homeownerAvatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                          <span className={`font-bold font-display ${b.homeownerName === 'Unassigned' ? 'text-zinc-400 italic font-normal' : 'text-zinc-900'}`}>
                            {b.homeownerName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <img src={b.workerAvatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                          <span className={`font-semibold ${b.workerName === 'Unassigned' ? 'text-zinc-400 italic font-normal' : 'text-zinc-800'}`}>
                            {b.workerName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-black font-display text-zinc-900">
                        ₱{b.offeredWage.toLocaleString()} / mo
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-3 py-1 rounded-full bg-zinc-100 text-zinc-800 text-[11px] font-bold">
                          {b.contractType}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right rounded-r-2xl">
                        {renderBookingStatusBadge(b.bookingStatus)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-zinc-100 mt-3 text-xs">
                <div className="text-zinc-500 font-medium">
                  Showing <span className="font-bold text-zinc-900">{startBookingIdx + 1}</span> to{' '}
                  <span className="font-bold text-zinc-900">{endBookingIdx}</span> of{' '}
                  <span className="font-bold text-zinc-900">{totalBookings}</span> placements
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBookingsPage((p) => Math.max(1, p - 1))}
                    disabled={safeBookingsPage <= 1}
                    className="p-1.5 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {getPageNumbers(safeBookingsPage, totalBookingPages).map((p, idx) => (
                    p === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-zinc-400 font-bold select-none">…</span>
                    ) : (
                      <button
                        key={`page-${p}`}
                        type="button"
                        onClick={() => setBookingsPage(p as number)}
                        className={`min-w-[32px] h-8 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                          safeBookingsPage === p
                            ? 'bg-[#0D0D11] text-white shadow-xs'
                            : 'bg-[#F0F0EC] text-zinc-700 hover:bg-[#EAEAE5] hover:text-zinc-900'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  ))}

                  <button
                    type="button"
                    onClick={() => setBookingsPage((p) => Math.min(totalBookingPages, p + 1))}
                    disabled={safeBookingsPage >= totalBookingPages}
                    className="p-1.5 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )
        )}

        {activeTab === 'VERIFICATIONS' && (
          totalVerifications === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-zinc-400">
              <Inbox className="w-8 h-8 text-zinc-300" />
              <p className="text-xs font-bold text-zinc-600">
                {searchTerm ? `No clearances matching "${searchTerm}"` : 'No pending clearances found'}
              </p>
              <p className="text-[11px] text-zinc-400 max-w-sm text-center">
                {searchTerm 
                  ? 'Try checking for typos or searching by another name.' 
                  : 'Document submissions will appear here once uploaded.'}
              </p>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="mt-2 px-4 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition-all cursor-pointer"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-zinc-400 font-extrabold font-display uppercase tracking-wider text-[11px]">
                    <th className="pb-3 px-3">Applicant</th>
                    <th className="pb-3 px-3">Document</th>
                    <th className="pb-3 px-3">Barangay</th>
                    <th className="pb-3 px-3">Submitted</th>
                    <th className="pb-3 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="font-medium text-zinc-700">
                  {paginatedVerifications.map((v) => (
                    <tr key={v.id} className="hover:bg-[#F6F5F2] rounded-2xl transition-colors">
                      <td className="py-3 px-3 rounded-l-2xl">
                        <div className="flex items-center gap-2.5">
                          <img src={v.avatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                          <div>
                            <span className="font-bold font-display text-zinc-900 block">{v.name}</span>
                            <span className="text-[10px] text-zinc-400 uppercase font-semibold">{v.role}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-zinc-800">{v.documentType}</td>
                      <td className="py-3 px-3">{v.barangay}</td>
                      <td className="py-3 px-3 text-zinc-400">{v.submittedDate}</td>
                      <td className="py-3 px-3 text-right rounded-r-2xl">
                        <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                          v.status === 'VERIFIED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : v.status === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-amber-50 text-amber-800'
                        }`}>
                          {v.status === 'PENDING / REVIEW' ? 'In Review' : v.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination Footer for Verifications */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-zinc-100 mt-3 text-xs">
                <div className="text-zinc-500 font-medium">
                  Showing <span className="font-bold text-zinc-900">{startVerifIdx + 1}</span> to{' '}
                  <span className="font-bold text-zinc-900">{endVerifIdx}</span> of{' '}
                  <span className="font-bold text-zinc-900">{totalVerifications}</span> clearances
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setVerificationsPage((p) => Math.max(1, p - 1))}
                    disabled={safeVerifPage <= 1}
                    className="p-1.5 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {getPageNumbers(safeVerifPage, totalVerifPages).map((p, idx) => (
                    p === '...' ? (
                      <span key={`verif-ellipsis-${idx}`} className="px-2 text-zinc-400 font-bold select-none">…</span>
                    ) : (
                      <button
                        key={`verif-page-${p}`}
                        type="button"
                        onClick={() => setVerificationsPage(p as number)}
                        className={`min-w-[32px] h-8 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                          safeVerifPage === p
                            ? 'bg-[#0D0D11] text-white shadow-xs'
                            : 'bg-[#F0F0EC] text-zinc-700 hover:bg-[#EAEAE5] hover:text-zinc-900'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  ))}

                  <button
                    type="button"
                    onClick={() => setVerificationsPage((p) => Math.min(totalVerifPages, p + 1))}
                    disabled={safeVerifPage >= totalVerifPages}
                    className="p-1.5 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )
        )}

        {activeTab === 'AUDIT_TRAIL' && (
          isLoadingAuditLogs ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-zinc-400">
              <Loader2 className="w-5 h-5 animate-spin text-[#FFB380]" />
              <p className="text-xs font-medium">Loading audit trail events...</p>
            </div>
          ) : totalAuditLogs === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-zinc-400">
              <History className="w-8 h-8 text-zinc-300" />
              <p className="text-xs font-bold text-zinc-600">
                {searchTerm ? `No audit logs matching "${searchTerm}"` : 'No audit trail logs recorded yet'}
              </p>
              <p className="text-[11px] text-zinc-400 max-w-sm text-center">
                {searchTerm 
                  ? 'Try checking for typos or searching by another official, resident, or document.' 
                  : 'Actions like verifying, rejecting, resetting, or deleting documents will automatically appear here.'}
              </p>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="mt-2 px-4 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition-all cursor-pointer"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-zinc-400 font-extrabold font-display uppercase tracking-wider text-[11px]">
                    <th className="pb-3 px-3">Official / Actor</th>
                    <th className="pb-3 px-3">Action</th>
                    <th className="pb-3 px-3">Resident & Document</th>
                    <th className="pb-3 px-3">Transition / Notes</th>
                    <th className="pb-3 px-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="font-medium text-zinc-700">
                  {paginatedAuditLogs.map((log) => {
                    const actorInitials = (log.actor_name || 'System')
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();

                    return (
                      <tr key={log.log_id} className="hover:bg-[#F6F5F2] rounded-2xl transition-colors">
                        {/* Official / Actor */}
                        <td className="py-3 px-3 rounded-l-2xl">
                          <div className="flex items-center gap-2.5">
                            {log.actor_name ? (
                              <div className="w-7 h-7 rounded-full bg-zinc-900 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                                {actorInitials || 'SA'}
                              </div>
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-[10px] font-black shrink-0">
                                <ShieldCheck className="w-3.5 h-3.5" />
                              </div>
                            )}
                            <div>
                              <span className="font-bold font-display text-zinc-900 block">
                                {log.actor_name || 'System Automated'}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-zinc-100 text-zinc-600 font-bold uppercase">
                                  {log.actor_role || 'SYSTEM'}
                                </span>
                                {log.actor_barangay && (
                                  <span className="text-[10px] text-zinc-400 font-medium">
                                    • {log.actor_barangay}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Action Badge */}
                        <td className="py-3 px-3">
                          {renderAuditActionBadge(log.action)}
                        </td>

                        {/* Resident & Document */}
                        <td className="py-3 px-3">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold font-display text-zinc-900">
                                {log.target_name || 'Resident'}
                              </span>
                              {log.target_role && (
                                <span className="text-[9px] font-semibold text-zinc-500 uppercase px-1.5 py-0.5 bg-zinc-100 rounded">
                                  {log.target_role}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-zinc-500 mt-0.5">
                              <span className="font-semibold text-zinc-700">
                                {formatDocType(log.document_type)}
                              </span>
                              {log.target_barangay && (
                                <>
                                  <span className="text-zinc-300">•</span>
                                  <span>{log.target_barangay}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Transition / Reason Notes */}
                        <td className="py-3 px-3">
                          <div className="max-w-xs">
                            {(log.previous_status || log.new_status) ? (
                              <div className="flex items-center gap-1 text-[11px]">
                                <span className="text-zinc-400">{log.previous_status || 'Pending'}</span>
                                <span className="text-zinc-300 font-bold">→</span>
                                <span className={`font-bold ${
                                  log.new_status === 'VERIFIED' ? 'text-emerald-700' :
                                  log.new_status === 'REJECTED' ? 'text-rose-600' :
                                  'text-zinc-700'
                                }`}>
                                  {log.new_status || 'Updated'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-zinc-400">—</span>
                            )}
                            {log.reason && (
                              <p className="text-[10px] text-zinc-500 italic truncate mt-0.5" title={log.reason}>
                                "{log.reason}"
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Timestamp */}
                        <td className="py-3 px-3 text-right rounded-r-2xl">
                          <span className="text-[11px] font-semibold text-zinc-600 block">
                            {formatAuditDate(log.created_at)}
                          </span>
                          <span className="text-[9px] text-zinc-400 font-mono">
                            ID #{log.log_id ? String(log.log_id).slice(-6) : 'LOG'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination Footer for Audit Trail */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-zinc-100 mt-3 text-xs">
                <div className="text-zinc-500 font-medium">
                  Showing <span className="font-bold text-zinc-900">{startAuditIdx + 1}</span> to{' '}
                  <span className="font-bold text-zinc-900">{endAuditIdx}</span> of{' '}
                  <span className="font-bold text-zinc-900">{totalAuditLogs}</span> audit events
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                    disabled={safeAuditPage <= 1}
                    className="p-1.5 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {getPageNumbers(safeAuditPage, totalAuditPages).map((p, idx) => (
                    p === '...' ? (
                      <span key={`audit-ellipsis-${idx}`} className="px-2 text-zinc-400 font-bold select-none">…</span>
                    ) : (
                      <button
                        key={`audit-page-${p}`}
                        type="button"
                        onClick={() => setAuditPage(p as number)}
                        className={`min-w-[32px] h-8 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                          safeAuditPage === p
                            ? 'bg-[#0D0D11] text-white shadow-xs'
                            : 'bg-[#F0F0EC] text-zinc-700 hover:bg-[#EAEAE5] hover:text-zinc-900'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  ))}

                  <button
                    type="button"
                    onClick={() => setAuditPage((p) => Math.min(totalAuditPages, p + 1))}
                    disabled={safeAuditPage >= totalAuditPages}
                    className="p-1.5 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )
        )}
      </div>

      {/* Hidden container for PDF export rendering */}
      <div
        ref={exportContainerRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 0,
          width: '1400px',
          pointerEvents: 'none',
          background: '#FFFFFF',
          paddingBottom: '80px',
        }}
      />
    </div>
  );
};
