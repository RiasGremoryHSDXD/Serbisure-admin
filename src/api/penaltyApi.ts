import { fetchApi } from './apiClient';
import { parsePenaltyPage, parsePenaltyUser, parsePenaltyRecord, type PenaltyDraft, type PenaltyFilters, type PenaltyPage,
  type PenaltyRecord, type PenaltyReview, type PenaltyUser } from '../data/penalties';

const BASE = '/api/v1/accounts/admin/penalties';
function query(filters: PenaltyFilters, page?: number): string {
  const values = new URLSearchParams();
  if (filters.search.trim()) values.set('search', filters.search.trim());
  if (filters.role) values.set('role', filters.role);
  if (filters.points) values.set('points', filters.points);
  if (filters.barangay && filters.barangay !== 'All Barangays') values.set('barangay', filters.barangay);
  if (page) values.set('page', String(page));
  return values.toString();
}
export async function fetchPenaltyUsers(filters: PenaltyFilters, page: number): Promise<PenaltyPage<PenaltyUser>> {
  const result = parsePenaltyPage(await fetchApi<PenaltyPage<PenaltyUser>>(`${BASE}/users/?${query(filters, page)}`));
  result.results.forEach(parsePenaltyUser);
  return result;
}
export async function fetchPenaltyHistory(filters: PenaltyFilters, page: number): Promise<PenaltyPage<PenaltyRecord>> {
  const result = parsePenaltyPage(await fetchApi<PenaltyPage<PenaltyRecord>>(`${BASE}/history/?${query(filters, page)}`));
  result.results.forEach(parsePenaltyRecord);
  return result;
}
export async function fetchPenaltyReview(userId: string, page: number): Promise<PenaltyReview> {
  const result = await fetchApi<PenaltyReview>(`${BASE}/users/${encodeURIComponent(userId)}/?page=${page}`);
  parsePenaltyUser(result.user); parsePenaltyPage(result.cancellations);
  if (!Array.isArray(result.recent_adjustments)) throw new Error('Penalty review could not be loaded. Please refresh.');
  result.recent_adjustments.forEach(parsePenaltyRecord);
  return result;
}
export function adjustPenalty(user: PenaltyUser, draft: PenaltyDraft, requestId: string): Promise<{ user: PenaltyUser; record: PenaltyRecord }> {
  return fetchApi(`${BASE}/users/${encodeURIComponent(user.id)}/`, {
    method: 'POST', maxRetries: 0, body: JSON.stringify({ ...draft, reason: draft.reason.trim(),
      incident_reference: draft.incident_reference.trim(), expected_points: user.penalty_points,
      expected_month: user.penalty_month, request_id: requestId }),
  });
}
export async function exportPenaltyHistory(filters: PenaltyFilters): Promise<Blob> {
  const report = await fetchApi<Blob>(`${BASE}/export/?${query(filters)}`, { responseType: 'blob' });
  if (report.type.split(';')[0] !== 'application/pdf') throw new Error('The PDF could not be generated. Please retry.');
  return report;
}
