import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AdminRole, BarangayStats, VerificationRequest, UserProfile, BookingCompliance, DashboardMetrics, AuditLogEntry } from '../types/admin';
import { DashboardRequestGate, validateDashboardSnapshot } from '../data/adminDashboard';
import type { RealtimeStatus } from '../realtime/RealtimeClient';
import { useChatInbox } from '../hooks/useChatInbox';
import type { ChatInboxEntry, DashboardStatsResponse } from '../types/admin';
import { fetchVerificationQueue, reviewVerification, fetchRegisteredUsers, fetchDashboardStats, fetchDashboardActivity, fetchMonthlyTrend, MonthlyTrendPoint, adminLoginApi, fetchAuditLogs, createActiveBarangayApi } from '../api/adminApi';

export interface AdminUser {
  id?: string;
  username: string;
  name: string;
  role: AdminRole;
  email?: string;
  barangay?: string;
  avatar: string;
}

interface AdminContextType {
  // Auth state
  isAuthenticated: boolean;
  currentUser: AdminUser | null;
  login: (username: string, password: string, role?: AdminRole, barangay?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;

  // Role and Navigation
  currentRole: AdminRole;
  setCurrentRole: (role: AdminRole) => void;
  selectedBarangay: string;
  setSelectedBarangay: (barangay: string) => void;
  activeNav: string;
  setActiveNav: (nav: string) => void;
  
  // Data
  barangays: BarangayStats[];
  userBarangays: string[];
  directoryBarangays: BarangayStats[];
  dashboardStatsError: string | null;
  verifications: VerificationRequest[];
  selectedVerificationId: string;
  setSelectedVerificationId: (id: string) => void;
  users: UserProfile[];
  bookings: BookingCompliance[];

  chatRealtimeStatus: RealtimeStatus;
  chatInbox: ChatInboxEntry[];
  unreadChatCount: number;
  chatInboxLoaded: boolean;
  chatInboxError: string | null;
  refreshChatInbox: () => Promise<void>;
  requestedChatPartner: ChatInboxEntry | null;
  openChatPartner: (partner: ChatInboxEntry) => void;
  clearChatPartnerRequest: () => void;

  // Loading States
  isLoadingVerifications: boolean;
  isLoadingUsers: boolean;
  isLoadingDashboardStats: boolean;
  isLoadingDashboardActivity: boolean;
  refreshVerifications: () => Promise<void>;
  refreshUsers: () => Promise<void>;
  refreshDashboardStats: () => Promise<void>;
  refreshDashboardActivity: () => Promise<void>;
  dashboardMetrics: DashboardMetrics | null;
  monthlyTrend: MonthlyTrendPoint[];
  isLoadingMonthlyTrend: boolean;
  refreshMonthlyTrend: () => Promise<void>;
  auditLogs: AuditLogEntry[];
  isLoadingAuditLogs: boolean;
  refreshAuditLogs: () => Promise<void>;

  // Actions
  addBarangay: (barangay: BarangayStats) => Promise<{ success: boolean; error?: string }>;
  approveVerification: (id: string) => Promise<void>;
  rejectVerification: (id: string, reason?: string) => Promise<void>;
  resetVerification: (id: string) => Promise<void>;

  // Comparison Modal Controls
  isComparisonModalOpen: boolean;
  setIsComparisonModalOpen: (open: boolean) => void;
  openComparisonModal: (id?: string) => void;
  closeComparisonModal: () => void;
}

/**
 * Completely purges all SerbiSure administrative data, auth tokens,
 * cached lists, profiles, and sensitive items from localStorage and sessionStorage.
 */
export const purgeAdminStorage = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('serbisure_') || key.startsWith('serbisure'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
  } catch (e) {
    console.error('Failed to purge admin storage:', e);
  }
};

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load initial auth state from localStorage
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const user = JSON.parse(localStorage.getItem('serbisure_admin_user') || 'null');
      return localStorage.getItem('serbisure_admin_auth') === 'true' && !!localStorage.getItem('serbisure_admin_token') && !!user?.id && ['SUPERADMIN', 'ADMIN'].includes(user.role);
    } catch {
      return false;
    }
  });

  const [currentUser, setCurrentUser] = useState<AdminUser | null>(() => {
    try {
      const saved = localStorage.getItem('serbisure_admin_user');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return null;
  });

  const [currentRole, setCurrentRole] = useState<AdminRole>(() => currentUser?.role || 'SUPERADMIN');
  const [selectedBarangay, setSelectedBarangay] = useState<string>(() => {
    if (currentUser?.role === 'ADMIN' && currentUser.barangay && currentUser.barangay !== 'All Barangays') {
      return currentUser.barangay;
    }
    return 'All Barangays';
  });
  const [activeNav, setActiveNav] = useState<string>('dashboard');
  const inboxAccount = isAuthenticated ? currentUser?.id ?? null : null;
  const inbox = useChatInbox(inboxAccount);
  const [chatRequest, setChatRequest] = useState<{ account: string; partner: ChatInboxEntry } | null>(null);
  const requestedChatPartner = chatRequest?.account === inboxAccount ? chatRequest.partner : null;
  const openChatPartner = (partner: ChatInboxEntry) => {
    if (!inboxAccount) return;
    setChatRequest({ account: inboxAccount, partner });
    setActiveNav('users');
  };
  const clearChatPartnerRequest = () => setChatRequest(null);
  
  // Cached mock rows from older builds must never seed a new session.
  useEffect(() => {
    try {
      localStorage.removeItem('serbisure_admin_barangays');
      localStorage.removeItem('serbisure_admin_user_barangays');
    } catch { /* Storage is optional; server statistics remain authoritative. */ }
  }, []);

  const addBarangay = async (newBarangay: BarangayStats): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await createActiveBarangayApi({ name: newBarangay.name.replace(/^(brgy\.?|barangay)\s+/i, '').trim(),
        region: newBarangay.region, province: newBarangay.province, city: newBarangay.city,
        street: newBarangay.street, contact_number: newBarangay.contact_number,
        zipcode: newBarangay.zipcode, country: newBarangay.country });
      if (!res.success) return { success: false, error: res.error || 'Could not create the barangay account.' };
      // Only the server can add an LGU row and determine its citizen/workforce counts.
      await refreshDashboardStats(true);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Could not create the barangay account.' };
    }
  };

  const [verifications, setVerifications] = useState<VerificationRequest[]>([]);
  const [selectedVerificationId, setSelectedVerificationId] = useState<string>('');
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState<boolean>(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  // Live bookings from backend, fallback to empty while loading
  const [bookings, setBookings] = useState<BookingCompliance[]>([]);
  const [isLoadingDashboardActivity, setIsLoadingDashboardActivity] = useState<boolean>(false);

  const [isLoadingVerifications, setIsLoadingVerifications] = useState<boolean>(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);

  // Monthly trend data for EmploymentTrendChart
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrendPoint[]>([]);
  const [isLoadingMonthlyTrend, setIsLoadingMonthlyTrend] = useState<boolean>(false);

  // Real-time Audit Logs state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState<boolean>(false);

  const refreshAuditLogs = useCallback(async () => {
    setIsLoadingAuditLogs(true);
    try {
      const bgyParam = currentRole === 'SUPERADMIN' 
        ? (selectedBarangay === 'All Barangays' ? undefined : selectedBarangay) 
        : selectedBarangay;
      const logs = await fetchAuditLogs(undefined, undefined, bgyParam);
      setAuditLogs(logs || []);
    } catch (err) {
      console.warn('[Admin API] Audit logs fetch notice:', err);
    } finally {
      setIsLoadingAuditLogs(false);
    }
  }, [currentRole, selectedBarangay]);

  // Sync role and barangay when currentUser changes
  useEffect(() => {
    if (currentUser) {
      setCurrentRole(currentUser.role);
      if (currentUser.role === 'SUPERADMIN' || currentUser.barangay === 'All Barangays') {
        setSelectedBarangay('All Barangays');
      } else if (currentUser.barangay) {
        setSelectedBarangay(currentUser.barangay);
      }
    }
  }, [currentUser]);

  // Handle global auth expiration event (e.g. HTTP 401 from cloud backend)
  useEffect(() => {
    const handleAuthExpired = () => {
      console.warn('[Admin Auth] Session expired or revoked. Resetting authentication state.');
      setIsAuthenticated(false);
      setCurrentUser(null);
      setCurrentRole('SUPERADMIN');
      setSelectedBarangay('All Barangays');
      setActiveNav('dashboard');
      setVerifications([]);
      setSelectedVerificationId('');
      setUsers([]);
      setBookings([]);
      setDashboardSource(null);
      setMonthlyTrend([]);
      setAuditLogs([]);

      purgeAdminStorage();
    };

    window.addEventListener('serbisure:auth_expired', handleAuthExpired);
    return () => window.removeEventListener('serbisure:auth_expired', handleAuthExpired);
  }, []);

  // Guarantee that unauthenticated sessions never retain cached admin data in storage
  useEffect(() => {
    if (!isAuthenticated) {
      purgeAdminStorage();
    }
  }, [isAuthenticated]);

  const setRoleSafely = (role: AdminRole) => {
    // Only superadmin can change or switch roles
    if (currentUser?.role !== 'SUPERADMIN') {
      console.warn('Unauthorized: Local LGU officers cannot switch roles.');
      return;
    }
    setCurrentRole(role);
  };

  const setBarangaySafely = (barangay: string) => {
    // Local LGU officers are strictly confined to their designated barangay
    if (currentUser?.role !== 'SUPERADMIN' && currentUser?.barangay && currentUser.barangay !== 'All Barangays') {
      if (barangay.toLowerCase() !== currentUser.barangay.toLowerCase()) {
        console.warn(`Unauthorized: Local officer is restricted to Brgy. ${currentUser.barangay}.`);
        return;
      }
    }
    setSelectedBarangay(barangay);
  };

  // Load live verification requests from Django backend
  const refreshVerifications = useCallback(async () => {
    setIsLoadingVerifications(true);
    try {
      const bgyParam = currentRole === 'SUPERADMIN' 
        ? (selectedBarangay === 'All Barangays' ? undefined : selectedBarangay) 
        : selectedBarangay;
      const liveQueue = await fetchVerificationQueue(undefined, undefined, bgyParam);
      setVerifications(liveQueue || []);
      setSelectedVerificationId((current) => {
        if (!liveQueue || liveQueue.length === 0) return '';
        const exists = liveQueue.some((item) => item.id === current);
        return exists ? current : liveQueue[0].id;
      });
    } catch (err) {
      console.warn('[Admin API] Verification queue fetch notice:', err);
    } finally {
      setIsLoadingVerifications(false);
    }
  }, [currentRole, selectedBarangay]);

  // Load live registered users from Django backend
  const refreshUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const bgyParam = currentRole === 'SUPERADMIN' 
        ? (selectedBarangay === 'All Barangays' ? undefined : selectedBarangay) 
        : selectedBarangay;
      const liveUsers = await fetchRegisteredUsers(undefined, bgyParam);
      const mappedUsers = (liveUsers || []).map((u) => ({
        ...u,
        socialLinks: Array.isArray(u.socialLinks) ? u.socialLinks : [],
      }));
      setUsers(mappedUsers);
    } catch (err) {
      console.warn('[Admin API] Users fetch notice:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [currentRole, selectedBarangay]);

  // A scope-bound server snapshot is the only source for metrics and directory rows.
  const dashboardScope = `${isAuthenticated}:${currentUser?.id}:${currentRole}:${selectedBarangay}`;
  const [dashboardSource, setDashboardSource] = useState<{ scope: string; data: DashboardStatsResponse } | null>(null);
  const [dashboardFailure, setDashboardFailure] = useState<{ scope: string; message: string } | null>(null);
  const [isLoadingDashboardStats, setIsLoadingDashboardStats] = useState(false);
  const dashboardGate = useRef(new DashboardRequestGate());
  dashboardGate.current.setScope(dashboardScope);
  const dashboardFlight = useRef<{ scope: string; id: number } | null>(null);
  const source = dashboardSource?.scope === dashboardScope ? dashboardSource.data : null;
  const dashboardMetrics = source?.metrics || null;
  const directoryBarangays = source?.barangays || [];
  const barangays = directoryBarangays.filter(row => row.status === 'ACTIVE');
  const userBarangays = directoryBarangays.map(row => row.name);
  const dashboardStatsError = dashboardFailure?.scope === dashboardScope ? dashboardFailure.message : null;

  const refreshDashboardStats = useCallback(async (force = false) => {
    if (!isAuthenticated) return;
    if (!force && dashboardFlight.current?.scope === dashboardScope) return;
    const id = dashboardGate.current.begin(dashboardScope);
    dashboardFlight.current = { scope: dashboardScope, id };
    setIsLoadingDashboardStats(true);
    setDashboardFailure(null);
    try {
      const bgyParam = currentRole === 'SUPERADMIN'
        ? (selectedBarangay === 'All Barangays' ? undefined : selectedBarangay)
        : selectedBarangay;
      const data = validateDashboardSnapshot(await fetchDashboardStats(bgyParam));
      if (dashboardGate.current.accepts(id, dashboardScope)) setDashboardSource({ scope: dashboardScope, data });
    } catch {
      if (dashboardGate.current.accepts(id, dashboardScope)) {
        setDashboardSource(null);
        setDashboardFailure({ scope: dashboardScope, message: 'Could not load database statistics. Check your connection and retry.' });
      }
    } finally {
      if (dashboardGate.current.accepts(id, dashboardScope)) setIsLoadingDashboardStats(false);
      if (dashboardFlight.current?.id === id) dashboardFlight.current = null;
    }
  }, [isAuthenticated, dashboardScope, currentRole, selectedBarangay]);

  // Load live booking activity for the dashboard activity table
  const refreshDashboardActivity = useCallback(async () => {
    setIsLoadingDashboardActivity(true);
    try {
      const bgyParam = currentRole === 'SUPERADMIN'
        ? (selectedBarangay === 'All Barangays' ? undefined : selectedBarangay)
        : selectedBarangay;
      const res = await fetchDashboardActivity(bgyParam);
      if (res && Array.isArray(res.bookings)) {
        setBookings(res.bookings);
      }
    } catch (err) {
      console.warn('[Admin API] Dashboard activity notice:', err);
    } finally {
      setIsLoadingDashboardActivity(false);
    }
  }, [currentRole, selectedBarangay]);

  // Load real monthly employment trend from backend
  const refreshMonthlyTrend = useCallback(async () => {
    setIsLoadingMonthlyTrend(true);
    try {
      const bgyParam = currentRole === 'SUPERADMIN'
        ? (selectedBarangay === 'All Barangays' ? undefined : selectedBarangay)
        : selectedBarangay;
      const res = await fetchMonthlyTrend(bgyParam);
      if (res && Array.isArray(res.trend) && res.trend.length > 0) {
        setMonthlyTrend(res.trend);
      }
    } catch (err) {
      console.warn('[Admin API] Monthly trend notice:', err);
    } finally {
      setIsLoadingMonthlyTrend(false);
    }
  }, [currentRole, selectedBarangay]);

  // Fetch live backend data on initial load, role/barangay change, plus real-time polling
  useEffect(() => {
    if (!isAuthenticated) return;

    refreshVerifications();
    refreshUsers();
    refreshDashboardStats();
    refreshDashboardActivity();
    refreshMonthlyTrend();
    refreshAuditLogs();

    // Auto-sync real-time stats every 4s for instant reflection when mobile workers toggle status
    const interval = setInterval(() => {
      refreshDashboardStats();
    }, 4000);

    return () => clearInterval(interval);
  }, [isAuthenticated, refreshVerifications, refreshUsers, refreshDashboardStats, refreshDashboardActivity, refreshMonthlyTrend, refreshAuditLogs]);

  const login = async (
    username: string,
    password: string,
    _role?: AdminRole,
    _barangay?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanInput = username.trim();
    const cleanPass = password.trim();

    // 1. Authenticate against real backend endpoint
    try {
      const res = await adminLoginApi(cleanInput, cleanPass);
      if (res && res.success && res.token && res.user?.id && ['SUPERADMIN', 'ADMIN'].includes(res.user.role)) {
        const user: AdminUser = {
          id: res.user.id,
          username: res.user.username,
          name: res.user.name,
          role: res.user.role as AdminRole,
          email: res.user.email,
          barangay: res.user.barangay,
          avatar: res.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(res.user.name)}&background=0D0D11&color=fff`,
        };

        setIsAuthenticated(true);
        setCurrentUser(user);
        setCurrentRole(user.role);
        setSelectedBarangay(user.role === 'SUPERADMIN' ? 'All Barangays' : (user.barangay || 'All Barangays'));
        setActiveNav('dashboard');

        try {
          localStorage.setItem('serbisure_admin_auth', 'true');
          localStorage.setItem('serbisure_admin_user', JSON.stringify(user));
          if (res.token) {
            localStorage.setItem('serbisure_admin_token', res.token);
          }
        } catch (e) {
          console.error('Failed to save to localStorage:', e);
        }

        return { success: true };
      }
    } catch (apiErr: any) {
      return { success: false, error: apiErr?.message || 'Cannot reach the sign-in server. Please try again.' };
    }
    return { success: false, error: 'Sign-in was not confirmed by the server. Please try again.' };
  };

  const logout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setCurrentRole('SUPERADMIN');
    setSelectedBarangay('All Barangays');
    setActiveNav('dashboard');
    setVerifications([]);
    setSelectedVerificationId('');
    setUsers([]);
    setBookings([]);
    setDashboardSource(null);
    setMonthlyTrend([]);
    setAuditLogs([]);

    purgeAdminStorage();
  };

  const approveVerification = async (id: string) => {
    // A server-confirmed decision applies to this document only.
    await reviewVerification(id, 'approve');
    await Promise.all([refreshVerifications(), refreshAuditLogs()]);
  };

  const rejectVerification = async (id: string, reason?: string) => {
    // Optimistic UI update supporting targeted primary or secondary document rejection
    setVerifications((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return { ...item, status: 'REJECTED', primaryStatus: 'REJECTED', notes: reason };
        }
        if (item.secondaryDocumentId === id) {
          return { ...item, status: 'REJECTED', secondaryStatus: 'REJECTED', secondaryNotes: reason };
        }
        return item;
      })
    );

    // Call live backend endpoint with reviewer identity
    try {
      await reviewVerification(id, 'reject', reason, currentUser?.email || currentUser?.username);
      await Promise.all([refreshVerifications(), refreshAuditLogs()]);
    } catch (err) {
      console.warn('[Admin API] Reject sync note:', err);
    }
  };

  const resetVerification = async (id: string) => {
    // Optimistic UI update supporting targeted primary or secondary document reset
    setVerifications((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const overallStatus = item.secondaryStatus === 'REJECTED' ? 'REJECTED' : 'PENDING / REVIEW';
          return { ...item, status: overallStatus, primaryStatus: 'PENDING / REVIEW', notes: undefined };
        }
        if (item.secondaryDocumentId === id) {
          const overallStatus = item.primaryStatus === 'REJECTED' ? 'REJECTED' : (item.primaryStatus || 'PENDING / REVIEW');
          return { ...item, status: overallStatus, secondaryStatus: 'PENDING / REVIEW', secondaryNotes: undefined };
        }
        return item;
      })
    );

    // Call live backend endpoint with reviewer identity
    try {
      await reviewVerification(id, 'reset', undefined, currentUser?.email || currentUser?.username);
      await Promise.all([refreshVerifications(), refreshAuditLogs()]);
    } catch (err) {
      console.warn('[Admin API] Reset sync note:', err);
    }
  };

  const openComparisonModal = useCallback((id?: string) => {
    if (id) {
      setSelectedVerificationId(id);
    }
    setIsComparisonModalOpen(true);
  }, []);

  const closeComparisonModal = useCallback(() => {
    setIsComparisonModalOpen(false);
  }, []);

  return (
    <AdminContext.Provider
      value={{
        isAuthenticated,
        currentUser,
        login,
        logout,
        currentRole,
        setCurrentRole: setRoleSafely,
        selectedBarangay,
        setSelectedBarangay: setBarangaySafely,
        activeNav,
        setActiveNav,
        barangays,
        userBarangays,
        directoryBarangays,
        dashboardStatsError,
        verifications,
        selectedVerificationId,
        setSelectedVerificationId,
        users,
        bookings,
        ...inbox,
        requestedChatPartner,
        openChatPartner,
        clearChatPartnerRequest,
        isLoadingVerifications,
        isLoadingUsers,
        isLoadingDashboardStats,
        isLoadingDashboardActivity,
        refreshVerifications,
        refreshUsers,
        refreshDashboardStats,
        refreshDashboardActivity,
        dashboardMetrics,
        monthlyTrend,
        isLoadingMonthlyTrend,
        refreshMonthlyTrend,
        auditLogs,
        isLoadingAuditLogs,
        refreshAuditLogs,
        addBarangay,
        approveVerification,
        rejectVerification,
        resetVerification,
        isComparisonModalOpen,
        setIsComparisonModalOpen,
        openComparisonModal,
        closeComparisonModal,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = (): AdminContextType => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};
