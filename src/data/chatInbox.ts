import type { ChatInboxEntry } from '../types/admin';

export function parseChatInbox(response: unknown): ChatInboxEntry[] {
  const envelope = response as { data?: unknown; results?: unknown } | null;
  const entries = Array.isArray(response) ? response : envelope?.data ?? envelope?.results;
  if (!Array.isArray(entries) || entries.some(entry =>
    !entry || typeof entry.partner_id !== 'string' || !entry.partner_id ||
    typeof entry.partner_name !== 'string' || typeof entry.partner_account_type !== 'string' ||
    (entry.last_message !== null && typeof entry.last_message !== 'string') || !Number.isFinite(Date.parse(entry.last_message_time)) ||
    !Number.isSafeInteger(entry.unread_count) || entry.unread_count < 0
  ) || new Set(entries.map(entry => entry.partner_id)).size !== entries.length) {
    throw new Error('Could not sync messages. Please retry.');
  }
  return entries.map(entry => ({ ...entry, last_message: entry.last_message ?? '' }));
}

export const unreadMessageCount = (entries: ChatInboxEntry[]) =>
  entries.reduce((total, entry) => total + entry.unread_count, 0);
export const messageCountLabel = (count: number) => `${count} unread message${count === 1 ? '' : 's'}`;
export const badgeCount = (count: number) => count > 99 ? '99+' : String(count);

export interface InboxSnapshot {
  account: string | null;
  entries: ChatInboxEntry[];
  loaded: boolean;
  error: string | null;
}

/** One personal inbox for the whole portal; late responses cannot cross sessions. */
export class ChatInboxStore {
  snapshot: InboxSnapshot = { account: null, entries: [], loaded: false, error: null };
  private revision = 0;
  private flight: Promise<void> | null = null;
  private queued = false;
  private listeners = new Set<(snapshot: InboxSnapshot) => void>();
  constructor(private fetchInbox: () => Promise<ChatInboxEntry[]>) {}
  subscribe(listener: (snapshot: InboxSnapshot) => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  private publish(snapshot: InboxSnapshot) {
    this.snapshot = snapshot;
    this.listeners.forEach(listener => listener(snapshot));
  }
  setAccount(account: string | null) {
    if (account === this.snapshot.account) return;
    this.revision++;
    this.flight = null;
    this.queued = false;
    this.publish({ account, entries: [], loaded: false, error: null });
  }
  refresh(afterRead = false): Promise<void> {
    if (!this.snapshot.account) return Promise.resolve();
    if (this.flight) {
      // A pre-read inbox request may still contain unread counts. Re-fetch afterwards.
      if (afterRead) this.queued = true;
      return this.flight;
    }
    const revision = this.revision;
    const run = async () => {
      do {
        this.queued = false;
        try {
          const entries = parseChatInbox(await this.fetchInbox());
          if (revision !== this.revision) return;
          this.publish({ ...this.snapshot, entries, loaded: true, error: null });
        } catch {
          if (revision !== this.revision) return;
          // Keep the last confirmed counts, clearly marked as temporarily out of date.
          this.publish({ ...this.snapshot, error: 'Messages could not sync. Counts may be out of date.' });
        }
      } while (this.queued && revision === this.revision);
    };
    const flight = run().finally(() => {
      if (this.flight === flight) this.flight = null;
    });
    this.flight = flight;
    return flight;
  }
}
