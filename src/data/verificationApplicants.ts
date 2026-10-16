import type { VerificationRequest, VerificationStatus } from '../types/admin';

export interface VerificationApplicant {
  id: string;
  user: VerificationRequest;
  documents: VerificationRequest[];
  status: VerificationStatus;
  submittedDate: string;
  submittedAt: number;
}

function documentKind(document: VerificationRequest): string {
  if (document.rawDocumentType) return document.rawDocumentType.toLowerCase();
  const label = document.documentType.toLowerCase();
  if (label.includes('national') && label.includes('front')) return 'national_id_front';
  if (label.includes('national') && label.includes('back')) return 'national_id_back';
  if (label.includes('nbi')) return 'nbi_clearance';
  if (label.includes('police')) return 'police_clearance';
  return label;
}

export function applicantStatus(documents: VerificationRequest[], role: string): VerificationStatus {
  if (!documents.length) return 'NO_DOCUMENTS';
  if (documents.some(document => document.status === 'REJECTED')) return 'REJECTED';
  if (documents.some(document => document.status !== 'VERIFIED')) return 'PENDING / REVIEW';
  const types = new Set(documents.map(documentKind));
  const required = role === 'KASAMBAHAY'
    ? ['nbi_clearance', 'police_clearance']
    : ['national_id_front', 'national_id_back'];
  return required.every(type => types.has(type)) ? 'VERIFIED' : 'PENDING / REVIEW';
}

export function groupVerificationApplicants(records: VerificationRequest[]): VerificationApplicant[] {
  const groups = new Map<string, VerificationRequest[]>();
  for (const record of records) {
    // Never group by display name: two residents can share the same name.
    const key = record.userId || (record.email ? `email:${record.email.trim().toLowerCase()}` : `document:${record.id}`);
    const group = groups.get(key) || [];
    if (!group.some(item => item.id === record.id)) group.push(record);
    groups.set(key, group);
  }
  const order = ['national_id_front', 'national_id_back', 'nbi_clearance', 'police_clearance'];
  return [...groups].map(([id, records]) => {
    const documents = records.filter(record => record.hasDocuments !== false && record.status !== 'NO_DOCUMENTS');
    const recent = [...documents].sort((a, b) => submissionTime(b) - submissionTime(a));
    const user = recent[0] || records[0];
    return {
      id, user,
      documents: documents.sort((a, b) => {
        const first = order.indexOf(documentKind(a)), second = order.indexOf(documentKind(b));
        return (first < 0 ? order.length : first) - (second < 0 ? order.length : second);
      }),
      status: applicantStatus(documents, user.role),
      submittedDate: documents.length ? user.submittedDate : 'Not Submitted',
      submittedAt: documents.length ? submissionTime(user) : 0,
    };
  });
}

function submissionTime(record: VerificationRequest): number {
  return Date.parse(record.submittedAt || record.submittedDate) || 0;
}

export function preferredDocument(applicant: VerificationApplicant): VerificationRequest {
  return applicant.documents.find(document => document.status === 'PENDING / REVIEW')
    || applicant.documents.find(document => document.status === 'REJECTED')
    || applicant.documents[0] || applicant.user;
}
