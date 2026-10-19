import type { DashboardStatsResponse } from '../types/admin';

/** Reject missing or impossible metrics instead of silently supplying demo/zero values. */
export function validateDashboardSnapshot(value: DashboardStatsResponse): DashboardStatsResponse {
  const metrics = value?.metrics;
  const count = (number: unknown) => typeof number === 'number' && Number.isInteger(number) && number >= 0;
  if (!metrics || !Array.isArray(value.barangays) ||
      ![metrics.totalWorkers, metrics.totalEmployed, metrics.totalAvailable, metrics.totalHomeowners, metrics.pendingVerifications].every(count) ||
      metrics.totalEmployed + metrics.totalAvailable !== metrics.totalWorkers ||
      !count(metrics.employmentRatio) || metrics.employmentRatio > 100) {
    throw new Error('The dashboard returned incomplete data. Please retry.');
  }
  for (const row of value.barangays) {
    if (!row.name?.trim() || !['ACTIVE', 'INACTIVE'].includes(row.status) ||
        ![row.totalRegistered, row.totalWorkers, row.employed, row.available, row.pending, row.verified, row.rejected, row.noDocuments].every(count) ||
        row.employed + row.available !== row.totalWorkers || row.totalWorkers > row.totalRegistered! ||
        !count(row.employmentRatio) || row.employmentRatio > 100 ||
        row.pending! + row.verified! + row.rejected! + row.noDocuments! !== row.totalRegistered) {
      throw new Error('The barangay directory returned inconsistent data. Please retry.');
    }
  }
  if (value.skills) {
    if (value.skills.totalWorkers !== metrics.totalWorkers || !Array.isArray(value.skills.categories) ||
        value.skills.categories.length !== 6 || new Set(value.skills.categories.map(item => item.category)).size !== 6 ||
        value.skills.categories.some(item => !['Cleaning', 'Cooking', 'Child_care', 'Caregiver', 'Laundry', 'All-around'].includes(item.category) ||
          !count(item.count) || item.count > metrics.totalWorkers || !Number.isFinite(item.percentage) || item.percentage < 0 || item.percentage > 100 ||
          Math.abs(item.percentage - (metrics.totalWorkers ? Math.round(item.count / metrics.totalWorkers * 1000) / 10 : 0)) > 0.01)) {
      throw new Error('The skills panel returned inconsistent data. Please retry.');
    }
  }
  return value;
}

/** Invalidates late responses when the account or jurisdiction changes. */
export class DashboardRequestGate {
  private scope = '';
  private version = 0;
  setScope(scope: string) { if (scope !== this.scope) { this.scope = scope; this.version++; } }
  begin(scope: string) { this.setScope(scope); return ++this.version; }
  accepts(version: number, scope: string) { return this.version === version && this.scope === scope; }
}
