export type PenaltyRole = '' | 'Homeowner' | 'Kasambahay';
export type PenaltyScoreFilter = '' | 'with_penalties' | '0' | '1' | '2' | '3';
export interface PenaltyUser {
  id: string; name: string; account_type: Exclude<PenaltyRole, ''>; barangay: string | null;
  penalty_points: number; is_restricted: boolean; penalty_month: string; resets_at: string;
}
export interface PenaltyRecord {
  id: string; user_id_snapshot: string; user_name: string; user_role: string; user_barangay: string;
  admin_id_snapshot: string; admin_name: string; admin_role: string; points_delta: number;
  points_before: number; points_after: number; penalty_month: string; reason: string;
  report_verified: boolean; incident_reference: string; booking_id_snapshot: string | null; created_at: string;
}
export interface PenaltyCancellation {
  booking_id: string; service_category: string[]; start_time: string; cancelled_at: string;
  cancellation_reason: string; cancellation_penalty_points: number;
}
export interface PenaltyPage<T> { count: number; results: T[] }
export interface PenaltyReview {
  user: PenaltyUser; cancellations: PenaltyPage<PenaltyCancellation>; recent_adjustments: PenaltyRecord[];
}
export interface PenaltyFilters { search: string; role: PenaltyRole; barangay: string; points?: PenaltyScoreFilter }
export interface PenaltyDraft {
  points_delta: number; reason: string; report_verified: boolean; incident_reference: string; booking_id?: string;
}

export function validatePenaltyDraft(user: PenaltyUser, draft: PenaltyDraft): string | null {
  if (!Number.isInteger(draft.points_delta) || ![-3, -2, -1, 1, 2, 3].includes(draft.points_delta)) return 'Choose 1–3 points to add or deduct.';
  const after = user.penalty_points + draft.points_delta;
  if (after < 0 || after > 3) return 'The new score must be between 0 and 3 points.';
  if (draft.reason.trim().length < 10) return 'Explain the adjustment in at least 10 characters.';
  if (draft.reason.trim().length > 2000) return 'Keep the reason within 2,000 characters.';
  if (draft.report_verified && !draft.incident_reference.trim()) return 'Enter the verified report or blotter reference.';
  return null;
}

export function parsePenaltyUser(value: PenaltyUser): PenaltyUser {
  if (!value || typeof value.id !== 'string' || typeof value.name !== 'string' ||
    !['Homeowner', 'Kasambahay'].includes(value.account_type) || !Number.isInteger(value.penalty_points) ||
    value.penalty_points < 0 || value.penalty_points > 3 || typeof value.is_restricted !== 'boolean' ||
    typeof value.penalty_month !== 'string' || !Number.isFinite(Date.parse(value.penalty_month))) {
    throw new Error('Penalty points could not be loaded. Please refresh.');
  }
  return value;
}

export function parsePenaltyPage<T>(value: PenaltyPage<T>): PenaltyPage<T> {
  if (!value || !Array.isArray(value.results) || !Number.isSafeInteger(value.count) || value.count < 0) {
    throw new Error('Penalty records could not be loaded. Please refresh.');
  }
  return value;
}

export function parsePenaltyRecord(value: PenaltyRecord): PenaltyRecord {
  if (!value || typeof value.id !== 'string' || typeof value.reason !== 'string' ||
    typeof value.user_name !== 'string' || typeof value.admin_name !== 'string' ||
    typeof value.report_verified !== 'boolean' || ![-3, -2, -1, 1, 2, 3].includes(value.points_delta) ||
    !Number.isInteger(value.points_before) || !Number.isInteger(value.points_after) ||
    value.points_after !== value.points_before + value.points_delta ||
    value.points_before < 0 || value.points_before > 3 || value.points_after < 0 || value.points_after > 3) {
    throw new Error('Penalty history could not be loaded. Please refresh.');
  }
  return value;
}

export function penaltyError(error: unknown, fallback = 'Unable to load penalty records. Please retry.'): string {
  const failure = error as { status?: number; message?: string };
  if (failure?.status === 401) return 'Session expired. Please sign in again.';
  if (failure?.status === 403) return 'You do not have permission to manage these points.';
  if (failure?.status === 404) return 'This record is no longer available. Please refresh.';
  if (failure?.status && failure.status >= 500) return 'The server is unavailable. Please retry.';
  return failure?.message || fallback;
}

export const penaltyDate = (date: string) => new Date(date).toLocaleString('en-PH', {
  timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
});
