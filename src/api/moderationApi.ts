import { fetchApi } from './apiClient';
import { parseAccountAccessUsers, type AccountAccessUser } from '../data/accountAccess';
import { ACCESS_HISTORY_PAGE_SIZE, parseAccessHistory, type AccessAction, type AccessHistoryEntry, type AccessHistoryPage } from '../data/accessHistory';

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

export async function fetchAccessHistory(filters: { page: number; search: string; action: AccessAction | ''; barangay: string }): Promise<AccessHistoryPage> {
  const query = new URLSearchParams({ page: String(filters.page) });
  if (filters.search.trim()) query.set('search', filters.search.trim());
  if (filters.action) query.set('action', filters.action);
  if (filters.barangay && filters.barangay !== 'All Barangays') query.set('barangay', filters.barangay);
  return parseAccessHistory(await fetchApi<unknown>(`${BASE}/history/?${query}`));
}

export async function fetchAllAccessHistory(filters: { search: string; action: AccessAction | ''; barangay: string }): Promise<AccessHistoryEntry[]> {
  const firstPage = await fetchAccessHistory({ ...filters, page: 1 });
  const pages = Math.max(1, Math.ceil(firstPage.count / ACCESS_HISTORY_PAGE_SIZE));
  const entries = [...firstPage.results];
  for (let page = 2; page <= pages; page += 1) {
    const nextPage = await fetchAccessHistory({ ...filters, page });
    entries.push(...nextPage.results);
  }
  return entries.slice(0, firstPage.count);
}
