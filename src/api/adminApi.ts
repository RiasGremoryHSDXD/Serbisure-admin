import { fetchApi } from './apiClient';
import { VerificationRequest, UserProfile, DashboardStatsResponse, BookingCompliance, AuditLogEntry } from '../types/admin';

export async function fetchVerificationQueue(
  role?: string, 
  status?: string, 
  barangay?: string
): Promise<VerificationRequest[]> {
  const params = new URLSearchParams();
  if (role && role !== 'ALL') params.append('role', role);
  if (status && status !== 'ALL') params.append('status', status);
  if (barangay && barangay !== 'All Barangays') params.append('barangay', barangay);

  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchApi<VerificationRequest[]>(`/api/v1/verifications/admin/queue/${query}`);
}

export async function reviewVerification(
  documentId: string,
  action: 'approve' | 'reject' | 'reset',
  rejectionReason?: string,
  reviewerEmail?: string
): Promise<{ message: string; document: VerificationRequest }> {
  return fetchApi<{ message: string; document: VerificationRequest }>(
    `/api/v1/verifications/admin/review/${documentId}/`,
    {
      method: 'POST',
      body: JSON.stringify({
        action,
        rejection_reason: rejectionReason || '',
        reviewer_email: reviewerEmail || '',
      }),
    }
  );
}

export async function fetchAuditLogs(
  action?: string,
  role?: string,
  barangay?: string,
  search?: string
): Promise<AuditLogEntry[]> {
  const params = new URLSearchParams();
  if (action && action !== 'ALL') params.append('action', action);
  if (role && role !== 'ALL') params.append('role', role);
  if (barangay && barangay !== 'All Barangays') params.append('barangay', barangay);
  if (search) params.append('search', search);

  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchApi<AuditLogEntry[]>(`/api/v1/verifications/admin/audit-logs/${query}`);
}

export async function fetchRegisteredUsers(role?: string, barangay?: string): Promise<UserProfile[]> {
  const params = new URLSearchParams();
  if (role && role !== 'ALL') params.append('role', role);
  if (barangay && barangay !== 'All Barangays') params.append('barangay', barangay);

  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchApi<UserProfile[]>(`/api/v1/accounts/admin/users/${query}`);
}

export async function fetchDashboardStats(barangay?: string): Promise<DashboardStatsResponse> {
  const params = new URLSearchParams();
  if (barangay && barangay !== 'All Barangays') params.append('barangay', barangay);

  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchApi<DashboardStatsResponse>(`/api/v1/accounts/admin/dashboard-stats/${query}`);
}

export async function fetchDashboardActivity(barangay?: string): Promise<{ bookings: BookingCompliance[]; count: number }> {
  const params = new URLSearchParams();
  if (barangay && barangay !== 'All Barangays') params.append('barangay', barangay);

  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchApi<{ bookings: BookingCompliance[]; count: number }>(`/api/v1/accounts/admin/dashboard-activity/${query}`);
}

export interface MonthlyTrendPoint {
  month: string;
  year: number;
  employed: number;
  on_the_job?: number;
  available: number;
  total: number;
}

export interface MonthlyTrendResponse {
  trend: MonthlyTrendPoint[];
  barangay?: string;
  total_workers?: number;
  current_on_the_job?: number;
  current_available?: number;
}

export async function fetchMonthlyTrend(barangay?: string): Promise<MonthlyTrendResponse> {
  const params = new URLSearchParams();
  if (barangay && barangay !== 'All Barangays') params.append('barangay', barangay);

  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchApi<MonthlyTrendResponse>(`/api/v1/accounts/admin/monthly-trend/${query}`);
}

export interface AdminLoginResponse {
  success: boolean;
  token: string;
  refresh: string;
  user: {
    id: string;
    username: string;
    name: string;
    email: string;
    role: 'SUPERADMIN' | 'ADMIN';
    barangay: string;
    avatar?: string;
  };
}

export async function adminLoginApi(username: string, password: string): Promise<AdminLoginResponse> {
  return fetchApi<AdminLoginResponse>('/api/v1/accounts/admin/login/', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export interface ActiveBarangaysApiResponse {
  barangays: string[];
  active_lgus?: string[];
  user_barangays?: string[];
}

/**
 * Returns the canonical list of active LGU barangay names.
 */
export async function fetchActiveLguBarangays(): Promise<string[]> {
  const res = await fetchApi<ActiveBarangaysApiResponse>('/api/v1/accounts/admin/active-barangays/');
  return Array.isArray(res.barangays) ? res.barangays : [];
}

/**
 * Returns all distinct barangays found across registered users (Homeowners and Kasambahays).
 */
export async function fetchAllUserBarangays(): Promise<string[]> {
  const res = await fetchApi<ActiveBarangaysApiResponse>('/api/v1/accounts/admin/active-barangays/');
  if (Array.isArray(res.user_barangays) && res.user_barangays.length > 0) {
    return res.user_barangays;
  }
  return Array.isArray(res.barangays) ? res.barangays : [];
}

export interface VerificationStatusStats {
  verified: number;
  pending: number;
  unverified: number;
  rejected: number;
}

export interface VerificationStatusStatsResponse {
  barangay: string;
  stats: VerificationStatusStats;
  total: number;
}

export async function fetchVerificationStatusStats(
  barangay?: string
): Promise<VerificationStatusStatsResponse> {
  const params = new URLSearchParams();
  if (barangay && barangay !== 'All Barangays') params.append('barangay', barangay);
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchApi<VerificationStatusStatsResponse>(
    `/api/v1/accounts/admin/verification-status-stats/${query}`
  );
}
