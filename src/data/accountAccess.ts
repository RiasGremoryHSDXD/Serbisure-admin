import type { UserProfile } from '../types/admin';

export interface AccountAccessUser extends UserProfile {
  chatSuspendedUntil: string | null;
  isAccountSuspended: boolean;
  isAccountActive: boolean;
}
export type AccessStatus = 'available' | 'chat_paused' | 'account_suspended' | 'deactivated';
export type ResidentRoleFilter = 'ALL' | 'HOMEOWNER' | 'KASAMBAHAY';
export type AccessFilter = 'ALL' | AccessStatus;

export function parseAccountAccessUsers(value: unknown): AccountAccessUser[] {
  if (!Array.isArray(value) || value.some(user => !user || typeof user.id !== 'string' ||
    typeof user.name !== 'string' || !['HOMEOWNER', 'KASAMBAHAY'].includes(user.role) ||
    typeof user.isAccountSuspended !== 'boolean' || typeof user.isAccountActive !== 'boolean' ||
    typeof user.canManageSuspension !== 'boolean' || !(user.chatSuspendedUntil === null ||
      (typeof user.chatSuspendedUntil === 'string' && Number.isFinite(Date.parse(user.chatSuspendedUntil)))))) {
    throw new Error('Account access could not be loaded. Refresh and try again.');
  }
  return value;
}

export function accountAccessStatus(user: AccountAccessUser, now = Date.now()): AccessStatus {
  if (!user.isAccountActive) return 'deactivated';
  if (user.isAccountSuspended) return 'account_suspended';
  if (user.chatSuspendedUntil && Date.parse(user.chatSuspendedUntil) > now) return 'chat_paused';
  return 'available';
}

export function filterAccessUsers(users: AccountAccessUser[], search: string,
  role: ResidentRoleFilter, access: AccessFilter, now = Date.now()): AccountAccessUser[] {
  const query = search.trim().toLocaleLowerCase();
  return users.filter(user => ['HOMEOWNER', 'KASAMBAHAY'].includes(user.role) &&
    (role === 'ALL' || user.role === role) &&
    (access === 'ALL' || accountAccessStatus(user, now) === access) &&
    (!query || `${user.name} ${user.barangay || ''}`.toLocaleLowerCase().includes(query)));
}

export function accessPage(users: AccountAccessUser[], requestedPage: number, pageSize = 10) {
  const totalPages = Math.max(1, Math.ceil(users.length / pageSize));
  const page = Math.max(1, Math.min(requestedPage, totalPages));
  return { page, totalPages, rows: users.slice((page - 1) * pageSize, page * pageSize) };
}
