import { fetchApi } from './apiClient';
import { parseAccountAccessUsers, type AccountAccessUser } from '../data/accountAccess';

const BASE = '/api/v1/chat/safety';
export interface SafetyStatus { restricted_until: string | null; support_available: boolean }
export interface SuspensionState {
  chat_suspended_until: string | null;
  is_account_suspended: boolean;
  is_active: boolean;
  suspended_by: string | null;
  can_manage: boolean;
}
export type SuspensionAction = 'pause_chat' | 'resume_chat' | 'suspend_account' | 'restore_account';
export const fetchSafetyStatus = () => fetchApi<SafetyStatus>(`${BASE}/status/`);
export const fetchSuspension = (id: string) => fetchApi<SuspensionState>(`${BASE}/users/${encodeURIComponent(id)}/`);
export const updateSuspension = (id: string, action: SuspensionAction, until?: string) =>
  fetchApi<SuspensionState>(`${BASE}/users/${encodeURIComponent(id)}/`, {
    method: 'POST', maxRetries: 0, body: JSON.stringify({ action, ...(until ? { until } : {}) }),
  });

export async function fetchAccountAccessUsers(barangay?: string): Promise<AccountAccessUser[]> {
  const query = new URLSearchParams({ access_management: '1' });
  if (barangay && barangay !== 'All Barangays') query.set('barangay', barangay);
  return parseAccountAccessUsers(await fetchApi<unknown>(`/api/v1/accounts/admin/users/?${query}`));
}
