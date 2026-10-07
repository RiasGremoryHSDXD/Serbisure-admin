import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AdminRole, BarangayStats, VerificationRequest, UserProfile, BookingCompliance, DashboardMetrics, AuditLogEntry } from '../types/admin';
import { BARANGAYS_DATA } from '../data/mockData';
import { fetchVerificationQueue, reviewVerification, fetchRegisteredUsers, fetchDashboardStats, fetchDashboardActivity, fetchMonthlyTrend, MonthlyTrendPoint, adminLoginApi, fetchActiveLguBarangays, fetchAllUserBarangays, fetchAuditLogs, createActiveBarangayApi } from '../api/adminApi';

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
  verifications: VerificationRequest[];
  selectedVerificationId: string;
  setSelectedVerificationId: (id: string) => void;
  users: UserProfile[];
  bookings: BookingCompliance[];

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

export const AUTHORIZED_ADMINS = [
  {
    email: 'serbisure@ustp.com',
    username: 'superadmin',
    password: 'iloveserbisure123',
    name: 'City Super Admin',
    role: 'SUPERADMIN' as AdminRole,
    barangay: 'All Barangays',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
  },
  {
    email: 'pagatpat@lgu.com',
    username: 'admin_pagatpat',
    password: 'ilovepagatpatlgu',
    name: 'Brgy. Officer (Pagatpat)',
    role: 'ADMIN' as AdminRole,
    barangay: 'Pagatpat',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
  },
  {
    email: 'canitoan@lgu.com',
    username: 'admin_canitoan',
    password: 'ilovecanitoanlgu',
    name: 'Brgy. Officer (Canitoan)',
    role: 'ADMIN' as AdminRole,
    barangay: 'Canitoan',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
  },
];

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
      return localStorage.getItem('serbisure_admin_auth') === 'true';
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
    return isAuthenticated
      ? {
          username: 'superadmin',
          name: 'City Super Admin',
          role: 'SUPERADMIN',
          barangay: 'All Barangays',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        }
      : null;
  });

  const [currentRole, setCurrentRole] = useState<AdminRole>(() => currentUser?.role || 'SUPERADMIN');
  const [selectedBarangay, setSelectedBarangay] = useState<string>(() => {
    if (currentUser?.role === 'ADMIN' && currentUser.barangay && currentUser.barangay !== 'All Barangays') {
      return currentUser.barangay;
    }
    return 'All Barangays';
  });
  const [activeNav, setActiveNav] = useState<string>('dashboard');
  
  const [barangays, setBarangays] = useState<BarangayStats[]>(() => {
    try {
      const saved = localStorage.getItem('serbisure_admin_barangays');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return BARANGAYS_DATA;
  });

  const addBarangay = async (newBarangay: BarangayStats): Promise<{ success: boolean; error?: string }> => {
    const cleanName = newBarangay.name.replace(/^(brgy\.?|barangay)\s+/i, '').trim();
    const normalizedBarangay: BarangayStats = {
      ...newBarangay,
      name: cleanName,
      status: 'ACTIVE',
    };

    // 1. Call backend API to persist to PostgreSQL database
    try {
      const res = await createActiveBarangayApi({
        name: cleanName,
        region: newBarangay.region,
        province: newBarangay.province,
        city: newBarangay.city,
        street: newBarangay.street,
        contact_number: newBarangay.contact_number,
        zipcode: newBarangay.zipcode,
        country: newBarangay.country,
      });

      if (res.error) {
        return { success: false, error: res.error };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save barangay to database.';
      return { success: false, error: msg };
    }

    // 2. Update local state and localStorage
    setBarangays((prev) => {
      const exists = prev.some((b) => b.name.toLowerCase() === cleanName.toLowerCase());
      const updated = exists
        ? prev.map((b) => (b.name.toLowerCase() === cleanName.toLowerCase() ? normalizedBarangay : b))
        : [...prev, normalizedBarangay];
      try {
        localStorage.setItem('serbisure_admin_barangays', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save barangays to localStorage:', e);
      }
      return updated;
    });

    // 3. Trigger refresh to sync canonical list from backend
    await refreshLguBarangays();
    return { success: true };
  };

  const [userBarangays, setUserBarangays] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('serbisure_admin_user_barangays');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return ['Canitoan', 'Pagatpat', 'Macasandig', 'Carmen', 'Agusan', 'Balubal', 'Bagong Silang'];
  });
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
      setDashboardMetrics(null);
      setMonthlyTrend([]);
      setAuditLogs([]);
      setBarangays(BARANGAYS_DATA);
      setUserBarangays([]);
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

  // Load real-time dashboard metrics from Django backend
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoadingDashboardStats, setIsLoadingDashboardStats] = useState<boolean>(false);

  const refreshDashboardStats = useCallback(async () => {
    setIsLoadingDashboardStats(true);
    try {
      const bgyParam = currentRole === 'SUPERADMIN' 
        ? (selectedBarangay === 'All Barangays' ? undefined : selectedBarangay) 
        : selectedBarangay;
      const res = await fetchDashboardStats(bgyParam);
      if (res && res.metrics) {
        setDashboardMetrics(res.metrics);
      }
      if (res && Array.isArray(res.barangays) && res.barangays.length > 0) {
        setBarangays((prev) => {
          const statsMap = new Map(res.barangays.map((b) => [b.name.toLowerCase(), b]));
          const merged: BarangayStats[] = res.barangays.map((b) => ({ ...b }));
          prev.forEach((p) => {
            if (!statsMap.has(p.name.toLowerCase())) {
              merged.push(p);
            }
          });
          try {
            localStorage.setItem('serbisure_admin_barangays', JSON.stringify(merged));
          } catch {
            // ignore
          }
          return merged;
        });
      }
    } catch (err) {
      console.warn('[Admin API] Dashboard stats notice:', err);
    } finally {
      setIsLoadingDashboardStats(false);
    }
  }, [currentRole, selectedBarangay]);

  /**
   * Fetches the canonical LGU barangay list from the dedicated endpoint.
   * Only account_type='Barangay' with is_active=True and a non-empty barangay
   * field contributes to this list. Homeowner/Kasambahay addresses are excluded.
   * Falls back to localStorage cache, then to BARANGAYS_DATA mock if offline.
   */
  const refreshLguBarangays = useCallback(async () => {
    try {
      const [names, allUserBgys] = await Promise.all([
        fetchActiveLguBarangays(),
        fetchAllUserBarangays()
      ]);
      if (names.length > 0) {
        setBarangays((prev) => {
          const prevMap = new Map(prev.map((b) => [b.name.toLowerCase(), b]));
          const asStats: BarangayStats[] = names.map((name) => {
            const clean = name.replace(/^(brgy\.?|barangay)\s+/i, '').trim();
            const existing = prevMap.get(clean.toLowerCase()) || prevMap.get(name.toLowerCase());
            if (existing) {
              return { ...existing, name: clean, status: 'ACTIVE' as const };
            }
            return {
              name: clean,
              totalWorkers: 0,
              employed: 0,
              available: 0,
              employmentRatio: 0,
              status: 'ACTIVE' as const,
            };
          });

          // Merge any previously saved local entries that aren't yet in backend names
          prev.forEach((prevItem) => {
            const cleanPrev = prevItem.name.replace(/^(brgy\.?|barangay)\s+/i, '').trim().toLowerCase();
            const alreadyInStats = asStats.some((s) => s.name.toLowerCase() === cleanPrev);
            if (!alreadyInStats) {
              asStats.push({ ...prevItem, name: prevItem.name.replace(/^(brgy\.?|barangay)\s+/i, '').trim() });
            }
          });

          try {
            localStorage.setItem('serbisure_admin_barangays', JSON.stringify(asStats));
          } catch {
            // ignore
          }
          return asStats;
        });
      }
      if (allUserBgys.length > 0) {
        setUserBarangays(allUserBgys);
        try {
          localStorage.setItem('serbisure_admin_user_barangays', JSON.stringify(allUserBgys));
        } catch {
          // ignore storage errors
        }
      }
    } catch (err) {
      console.warn('[Admin API] Active LGU barangays fetch failed, using cache/fallback:', err);
      // Fallback 1: localStorage cache already seeded in initial useState
      // Fallback 2: BARANGAYS_DATA (Pagatpat + Canitoan) is the useState default
    }
  }, []);

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

  // Fetch LGU and all database resident barangay list once authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    refreshLguBarangays();
  }, [isAuthenticated, refreshLguBarangays]);

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
      if (res && res.success && res.user) {
        const user: AdminUser = {
          id: res.user.id,
          username: res.user.username,
          name: res.user.name,
          role: res.user.role as AdminRole,
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
      console.warn('[Admin API] Backend login failed, checking offline fallback...', apiErr?.message);
      if (apiErr?.message?.includes('deactivated') || apiErr?.message?.includes('Access denied')) {
        return { success: false, error: apiErr.message };
      }
    }

    // 2. Offline fallback to AUTHORIZED_ADMINS (for offline / dev mode)
    const match = AUTHORIZED_ADMINS.find(
      (a) =>
        (a.email.toLowerCase() === cleanInput.toLowerCase() || a.username.toLowerCase() === cleanInput.toLowerCase()) &&
        a.password === cleanPass
    );

    if (match) {
      const user: AdminUser = {
        id: match.username,
        username: match.username,
        name: match.name,
        role: match.role,
        barangay: match.barangay,
        avatar: match.avatar,
      };

      setIsAuthenticated(true);
      setCurrentUser(user);
      setCurrentRole(match.role);
      setSelectedBarangay(match.role === 'SUPERADMIN' ? 'All Barangays' : match.barangay);
      setActiveNav('dashboard');

      try {
        localStorage.setItem('serbisure_admin_auth', 'true');
        localStorage.setItem('serbisure_admin_user', JSON.stringify(user));
      } catch (e) {
        console.error('Failed to save to localStorage:', e);
      }

      return { success: true };
    } else {
      return {
        success: false,
        error: 'Invalid credentials. Please enter authorized admin email/username and password.',
      };
    }
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
    setDashboardMetrics(null);
    setMonthlyTrend([]);
    setAuditLogs([]);
    setBarangays(BARANGAYS_DATA);
    setUserBarangays([]);
    purgeAdminStorage();
  };

  const approveVerification = async (id: string) => {
    // Optimistic UI update supporting targeted or package approval
    setVerifications((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newSecondaryStatus = item.secondaryStatus === 'REJECTED' ? 'REJECTED' : 'VERIFIED';
          const newOverallStatus = newSecondaryStatus === 'REJECTED' ? 'REJECTED' : 'VERIFIED';
          return {
            ...item,
            status: newOverallStatus,
            primaryStatus: 'VERIFIED',
            secondaryStatus: newSecondaryStatus,
            recordStatus: newOverallStatus === 'VERIFIED' ? 'Clear Record' : item.recordStatus,
          };
        }
        if (item.secondaryDocumentId === id) {
          const newPrimaryStatus = item.primaryStatus || 'VERIFIED';
          const newOverallStatus = newPrimaryStatus === 'REJECTED' ? 'REJECTED' : 'VERIFIED';
          return {
            ...item,
            status: newOverallStatus,
            secondaryStatus: 'VERIFIED',
            recordStatus: newOverallStatus === 'VERIFIED' ? 'Clear Record' : item.recordStatus,
          };
        }
        return item;
      })
    );

    // Call live backend endpoint with reviewer identity
    try {
      await reviewVerification(id, 'approve', undefined, currentUser?.email || currentUser?.username);
      await Promise.all([refreshVerifications(), refreshAuditLogs()]);
    } catch (err) {
      console.warn('[Admin API] Approve sync note:', err);
    }
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
        verifications,
        selectedVerificationId,
        setSelectedVerificationId,
        users,
        bookings,
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
