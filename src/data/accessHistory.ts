export type AccessAction = 'pause_chat' | 'resume_chat' | 'suspend_account' | 'restore_account';
export interface AccessSnapshot {
  chat_suspended_until: string | null;
  is_account_suspended: boolean;
}
export interface AccessHistoryEntry {
  log_id: string;
  actor_id_snapshot: string;
  actor_name: string;
  actor_role: string;
  actor_barangay: string;
  target_id_snapshot: string;
  target_name: string;
  target_role: string;
  target_barangay: string;
  action: AccessAction;
  previous_state: AccessSnapshot;
  new_state: AccessSnapshot;
  created_at: string;
}
export interface AccessHistoryPage { count: number; results: AccessHistoryEntry[] }
export const ACCESS_HISTORY_PAGE_SIZE = 5;

export const accessActionLabels: Record<AccessAction, string> = {
  pause_chat: 'Messaging paused', resume_chat: 'Messaging resumed',
  suspend_account: 'Account suspended', restore_account: 'Account restored',
};

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const timestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const snapshot = (value: unknown): value is AccessSnapshot => object(value)
  && typeof value.is_account_suspended === 'boolean'
  && (value.chat_suspended_until === null || timestamp(value.chat_suspended_until));

export function parseAccessHistory(value: unknown): AccessHistoryPage {
  const failure = () => new Error('Access history could not be loaded. Please retry.');
  if (!object(value) || !Number.isInteger(value.count) || (value.count as number) < 0 || !Array.isArray(value.results)) throw failure();
  if (value.results.length > 10 || value.results.length > (value.count as number)) throw failure();
  const seen = new Set<string>();
  for (const row of value.results) {
    if (!object(row) || !['log_id', 'actor_id_snapshot', 'actor_name', 'actor_role', 'actor_barangay',
      'target_id_snapshot', 'target_name', 'target_role', 'target_barangay'].every(key => typeof row[key] === 'string')
      || !row.log_id || !row.actor_id_snapshot || !row.target_id_snapshot || !row.actor_name || !row.target_name
      || typeof row.action !== 'string' || !Object.prototype.hasOwnProperty.call(accessActionLabels, row.action)
      || !timestamp(row.created_at) || !snapshot(row.previous_state) || !snapshot(row.new_state)
      || seen.has(row.log_id as string)) throw failure();
    seen.add(row.log_id as string);
  }
  if ((value.count as number) > 0 && value.results.length === 0) throw failure();
  return value as unknown as AccessHistoryPage;
}

export function historyDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

export function historyBarangay(value: string): string {
  const name = value.replace(/^(brgy\.?|barangay)\s+/i, '').trim();
  return name ? `Brgy. ${name}` : 'Unassigned';
}
