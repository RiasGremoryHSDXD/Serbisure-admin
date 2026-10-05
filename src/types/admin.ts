export type AdminRole = 'SUPERADMIN' | 'ADMIN';

export type AccountRole = 'KASAMBAHAY' | 'HOMEOWNER' | 'BARANGAY' | 'SUPERADMIN';

export type DocumentType = 'NBI CLEARANCE' | 'Police Clearance' | 'National ID' | 'Clearances (NBI + Police)' | string;

export type VerificationStatus = 'PENDING / REVIEW' | 'VERIFIED' | 'REJECTED' | 'NO_DOCUMENTS';

export interface BarangayStats {
  name: string;
  totalRegistered?: number;
  totalWorkers: number;
  employed: number;
  available: number;
  employmentRatio: number; // percentage, e.g. 82
  status: 'ACTIVE' | 'INACTIVE';
  pending?: number;
  verified?: number;
  rejected?: number;
  noDocuments?: number;
}

export interface DashboardMetrics {
  totalWorkers: number;
  totalEmployed: number;
  totalAvailable: number;
  employmentRatio: number;
  totalHomeowners: number;
  pendingVerifications: number;
}

export interface DashboardStatsResponse {
  metrics: DashboardMetrics;
  barangays: BarangayStats[];
}

export interface VerificationRequest {
  id: string;
  name: string;
  role: AccountRole;
  avatar: string;
  documentType: DocumentType;
  rawDocumentType?: string;
  documentNumber: string;
  submittedDate: string;
  issuedDate: string;
  validityDate: string;
  status: VerificationStatus;
  primaryStatus?: VerificationStatus;
  recordStatus: 'Clear Record' | 'Under Review' | 'Flagged';
  documentImage: string;
  documentImageBack?: string;
  hasDocuments?: boolean;
  hasLguCoverage?: boolean;
  userId?: string;
  address?: string;

  // Package & Secondary Companion Document Fields
  isPackage?: boolean;
  packageLabel?: string;
  secondaryDocumentId?: string;
  secondaryDocumentImage?: string;
  secondaryDocumentType?: string;
  secondaryDocumentNumber?: string;
  secondaryIssuedDate?: string;
  secondaryValidityDate?: string;
  secondaryStatus?: string;
  secondaryNotes?: string;
  secondaryOcrData?: {
    full_name?: string;
    first_name?: string;
    middle_name?: string;
    last_name?: string;
    document_number?: string;
    clearance_number?: string;
    philsys_number?: string;
    purpose?: string;
    document_type_label?: string;
    issuing_office?: string;
    date_issued?: string;
    valid_until?: string;
    date_of_birth?: string;
    barangay?: string;
    city?: string;
    [key: string]: any;
  };
  secondaryOcrDiscrepancies?: Array<{
    field: string;
    message?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    similarity?: number;
    profile_value?: string;
    document_value?: string;
  }>;

  barangay: string;
  contactNumber: string;
  email: string;
  notes?: string;
  faceLivenessMatchScore?: number; // e.g. 98.4%
  ocrExtractedData?: {
    full_name?: string;
    first_name?: string;
    middle_name?: string;
    last_name?: string;
    document_number?: string;
    clearance_number?: string;
    philsys_number?: string;
    purpose?: string;
    document_type_label?: string;
    issuing_office?: string;
    date_issued?: string;
    valid_until?: string;
    date_of_birth?: string;
    barangay?: string;
    city?: string;
    [key: string]: any;
  };
  ocrDiscrepancies?: Array<{
    field: string;
    message?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    similarity?: number;
    profile_value?: string;
    document_value?: string;
  }>;
  ocrMatchScore?: number;
}

export interface LinkedWorker {
  id: string;
  name: string;
  avatar: string;
  role: string;
  rating: number;
  verified: boolean;
}

export interface SocialLink {
  platform: string;
  platform_name?: string;
  url: string;
  handle?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  role: AccountRole;
  avatar: string;
  email: string;
  contactNumber: string;
  address: string;
  barangay: string;
  city: string;
  verified: boolean;
  hasLguCoverage?: boolean;
  skills?: string[];
  hourlyRate?: number;
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
  joinedDate: string;
  completedJobs: number;
  linkedKasambahays?: LinkedWorker[];
  socialLinks?: SocialLink[];
  sentimentScore: {
    positive: number;
    neutral: number;
    negative: number;
  };
  ra10361Compliant: boolean;
}

export interface BookingCompliance {
  id: string;
  homeownerName: string;
  homeownerAvatar: string;
  workerName: string;
  workerAvatar: string;
  serviceCategory: string;
  monthlyBookingsCount: number; // Max 3 per month
  isCapped: boolean; // true if >= 3 bookings
  offeredWage: number;
  minimumWageBaseline: number; // RTWPB-10 baseline e.g. 438/day or 5000/mo
  isBelowMinimumWage: boolean;
  contractType: 'Short-Term On-Demand' | 'Formal Kasambahay (Long-Term)';
  statutoryBenefits: {
    sss: boolean;
    philHealth: boolean;
    pagIbig: boolean;
    thirteenthMonth: boolean;
  };
  startDate: string;
  barangay?: string;
  bookingStatus?: string;
  status: 'ACTIVE' | 'FLAGGED_THROTTLED' | 'COMPLIANT' | 'DISPUTED' | 'BELOW_MINIMUM_WAGE';
}

export interface AuditLogEntry {
  log_id: string;
  actor: string | null;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: string | null;
  actor_barangay: string | null;
  target_user: string | null;
  target_name: string | null;
  target_email: string | null;
  target_role: string | null;
  target_barangay: string | null;
  document: string | null;
  document_id_snapshot: string | null;
  document_type: string | null;
  document_number: string | null;
  action: 'APPROVED' | 'REJECTED' | 'RESET' | 'DELETED' | 'UPLOADED' | 'REPROCESSED' | 'UPDATED' | string;
  previous_status: string | null;
  new_status: string | null;
  reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface ChatMessage {
  chat_message_id: string;
  sender_id: string;
  receiver_id: string;
  message_payload: string | null;
  message_type: 'text' | 'image';
  is_read: boolean;
  createdAt: string;
  image_url?: string | null;
  reaction_summary?: Record<string, number>;
  my_reaction?: string | null;
}

export interface ChatThreadResponse {
  data?: ChatMessage[];
  results?: ChatMessage[];   // DRF pagination wrapper
  count?: number;
}

export interface ChatInboxEntry {
  partner_id: string;
  partner_name: string;
  partner_account_type: string;
  last_message: string;
  last_message_time: string;   // ISO 8601
  unread_count: number;
  sent_count: number;
}

export interface BarangayDeskProfile {
  barangayName: string;      // read-only, taken from currentUser.barangay
  address: string;           // maps to user.street (e.g. "Zone 5, Brgy. Pagatpat, Cagayan de Oro City")
  hotline: string;           // maps to user.contact_number (e.g. "+639171234567")
  officeHours: string;       // maps to user.user_about (e.g. "Mon–Fri, 8:00 AM – 5:00 PM")
  officerName?: string;      // maps to user.first_name + user.last_name
  email?: string;            // maps to user.email
  lastUpdated?: string;      // ISO timestamp string
}
