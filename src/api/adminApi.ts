import { fetchApi } from './apiClient';
import { VerificationRequest, UserProfile, DashboardStatsResponse, BookingCompliance, AuditLogEntry, ChatInboxEntry } from '../types/admin';
import type { ChatMessage } from '../types/admin';

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

/**
 * Fetch the full message thread between the admin and a specific user.
 * GET /api/v1/chat/thread/<partner_id>/
 */
export async function fetchChatThread(partnerId: string): Promise<ChatMessage[]> {
  const res = await fetchApi<{ data?: ChatMessage[]; results?: ChatMessage[] }>(
    `/api/v1/chat/thread/${partnerId}/`
  );
  return res.data ?? res.results ?? [];
}

/**
 * Send a text message to a user as the admin.
 * POST /api/v1/chat/send/
 * Requires Idempotency-Key header (fresh UUID v4 per call).
 */
export async function sendChatMessage(
  receiverId: string,
  messagePayload: string
): Promise<ChatMessage> {
  const idempotencyKey = crypto.randomUUID();
  const res = await fetchApi<{ message: string; data: ChatMessage }>(
    '/api/v1/chat/send/',
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ receiver_id: receiverId, message_payload: messagePayload }),
    }
  );
  return res.data;
}

/**
 * Send an image message with optional caption to a user as the admin.
 * POST /api/v1/chat/send-image/
 * Supports JPEG, PNG, and WEBP up to 10MB.
 * Requires Idempotency-Key header.
 * Uses FormData so apiClient lets the browser set multipart boundary.
 */
export async function sendChatImageMessage(
  receiverId: string,
  imageFile: File,
  caption?: string
): Promise<ChatMessage> {
  const idempotencyKey = crypto.randomUUID();
  const formData = new FormData();
  formData.append('receiver_id', receiverId);
  formData.append('image', imageFile);
  if (caption && caption.trim()) {
    formData.append('message_payload', caption.trim());
  }

  const res = await fetchApi<{ message: string; data: ChatMessage }>(
    '/api/v1/chat/send-image/',
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: formData,
    }
  );
  return res.data;
}

/**
 * Mark a specific message as read.
 * PATCH /api/v1/chat/read/<message_id>/
 */
export async function markMessageRead(messageId: string): Promise<void> {
  await fetchApi<unknown>(`/api/v1/chat/read/${messageId}/`, { method: 'PATCH' });
}

export interface ToggleReactionResponse {
  message: string;
  data: {
    chat_message_id: string;
    action: 'added' | 'removed' | 'changed';
    my_reaction: string | null;
    reaction_counts: Record<string, number>;
  };
}

/**
 * Toggle an emoji reaction on a message.
 * POST /api/v1/chat/react/<message_id>/
 */
export async function toggleChatReaction(
  messageId: string,
  emoji: string
): Promise<ToggleReactionResponse> {
  return fetchApi<ToggleReactionResponse>(`/api/v1/chat/react/${messageId}/`, {
    method: 'POST',
    body: JSON.stringify({ emoji }),
  });
}

/**
 * Fetch the admin's conversation inbox — all partners sorted by most recent message.
 * GET /api/v1/chat/inbox/
 */
export async function fetchChatInbox(): Promise<ChatInboxEntry[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await fetchApi<any>('/api/v1/chat/inbox/');
  // Handle all backend envelope shapes
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.results)) return res.results;
  return [];
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface ChangePasswordResponse {
  message?: string;
  error?: string;
}

export async function changePasswordApi(payload: ChangePasswordPayload): Promise<ChangePasswordResponse> {
  return fetchApi<ChangePasswordResponse>('/api/v1/accounts/change-password/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface DeskProfileResponse {
  success?: boolean;
  message?: string;
  barangay?: string;
  street?: string;
  contact_number?: string;
  user_about?: string;
  first_name?: string;
  last_name?: string;
  officer_name?: string;
  email?: string;
  city?: string;
  province?: string;
  zipcode?: string;
  profile?: {
    barangay?: string;
    street?: string;
    contact_number?: string;
    user_about?: string;
    first_name?: string;
    last_name?: string;
    officer_name?: string;
    email?: string;
    city?: string;
    province?: string;
    zipcode?: string;
  };
  error?: string;
}

export async function fetchDeskProfileApi(barangay?: string): Promise<DeskProfileResponse> {
  const query = barangay ? `?barangay=${encodeURIComponent(barangay)}` : '';
  return fetchApi<DeskProfileResponse>(`/api/v1/accounts/admin/desk-profile/${query}`);
}

export async function updateDeskProfileApi(payload: {
  street?: string;
  contact_number?: string;
  user_about?: string;
  first_name?: string;
  last_name?: string;
  barangay?: string;
}): Promise<DeskProfileResponse> {
  return fetchApi<DeskProfileResponse>('/api/v1/accounts/admin/desk-profile/', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}


