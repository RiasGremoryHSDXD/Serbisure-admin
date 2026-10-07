import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  KeyRound, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Eye, 
  EyeOff, 
  MapPin, 
  Phone, 
  Clock, 
  UserCheck, 
  X,
  Shield,
  Save,
  Search,
  Lock
} from 'lucide-react';
import clsx from 'clsx';
import { useAdmin } from '../context/AdminContext';
import type { BarangayDeskProfile, BarangayStats, VerificationRequest } from '../types/admin';
import { 
  changePasswordApi, 
  fetchDeskProfileApi, 
  updateDeskProfileApi,
  fetchDashboardStats,
  fetchVerificationQueue,
  sanitizeUserFriendlyError
} from '../api/adminApi';
import {
  getRegions,
  getProvinces,
  getCities,
  getBarangays,
  getZipCodeForCity,
  type Region,
  type Province,
  type CityMunicipality,
  type Barangay,
} from '../services/locationService';

function formatPhilippineMobile(input: string): string {
  let digits = input.replace(/\D/g, '');

  // Strip leading country code or zero if user pasted full number
  if (digits.startsWith('639')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('63') && digits.length > 2) {
    digits = digits.slice(2);
  } else if (digits.startsWith('09')) {
    digits = digits.slice(1);
  } else if (digits.startsWith('0') && digits.length > 1) {
    digits = digits.slice(1);
  }

  // Maximum 10 digits (9XX XXX XXXX)
  digits = digits.slice(0, 10);

  // Group as 3-3-4 (e.g. 955 555 5555)
  if (digits.length <= 3) {
    return digits;
  } else if (digits.length <= 6) {
    return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  } else {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
}

export const SettingsPage: React.FC = () => {
  const { currentRole, currentUser, selectedBarangay, barangays, userBarangays, users, addBarangay, verifications } = useAdmin();

  // ---------------------------------------------------------
  // Change Password Form State (Shared for Superadmin & Admin)
  // ---------------------------------------------------------
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  // ---------------------------------------------------------
  // Barangay Desk Profile State (Admin / Barangay Officer only)
  // ---------------------------------------------------------
  const activeBarangay = currentUser?.barangay || selectedBarangay || '';
  const storageKey = `serbisure_desk_profile_${activeBarangay || 'default'}`;

  const [deskProfile, setDeskProfile] = useState<BarangayDeskProfile>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {
      barangayName: activeBarangay,
      address: '',
      hotline: '',
      officeHours: '',
      officerName: currentUser?.name || '',
      email: currentUser?.email || '',
      lastUpdated: '',
    };
  });

  const [deskLoading, setDeskLoading] = useState(false);
  const [deskFetching, setDeskFetching] = useState(false);
  const [deskSuccess, setDeskSuccess] = useState(false);
  const [deskError, setDeskError] = useState<string | null>(null);

  // Fetch desk profile from backend on mount for Barangay Officer
  useEffect(() => {
    if (currentRole === 'ADMIN' && activeBarangay) {
      let isMounted = true;
      setDeskFetching(true);
      fetchDeskProfileApi(activeBarangay)
        .then((res) => {
          if (!isMounted) return;
          if (res && res.success) {
            const data = res.profile || res;
            const updated: BarangayDeskProfile = {
              barangayName: data.barangay || activeBarangay,
              address: data.street || '',
              hotline: data.contact_number || '',
              officeHours: data.user_about && data.user_about !== 'No Bio' ? data.user_about : '',
              officerName: data.officer_name || `${data.first_name || ''} ${data.last_name || ''}`.trim() || currentUser?.name || '',
              email: data.email || currentUser?.email || '',
              lastUpdated: new Date().toISOString(),
            };
            setDeskProfile(updated);
            try {
              localStorage.setItem(storageKey, JSON.stringify(updated));
            } catch {
              // ignore
            }
          }
        })
        .catch(() => {
          // If offline or backend error, state remains with localStorage fallback
        })
        .finally(() => {
          if (isMounted) setDeskFetching(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [currentRole, activeBarangay, currentUser?.name, currentUser?.email, storageKey]);

  // ---------------------------------------------------------
  // Add Barangay Modal State (Superadmin only) - PSGC Dropdowns
  // ---------------------------------------------------------
  const [showAddBarangay, setShowAddBarangay] = useState(false);
  const [addBrgyForm, setAddBrgyForm] = useState({
    regionCode: '100000000',
    regionName: 'Region X - Northern Mindanao',
    provinceCode: '104300000',
    provinceName: 'Misamis Oriental',
    cityCode: '104305000',
    cityName: 'City of Cagayan De Oro',
    barangayName: '',
    street: '',
    contactNumber: '',
    zipcode: '9000',
    country: 'Philippines',
  });
  const [addBrgyError, setAddBrgyError] = useState<string | null>(null);
  const [isSubmittingBrgy, setIsSubmittingBrgy] = useState(false);
  const [lockedQuickSetupBarangay, setLockedQuickSetupBarangay] = useState<string | null>(null);

  // PSGC Location Dropdown Lists
  const [regionsList, setRegionsList] = useState<Region[]>([]);
  const [provincesList, setProvincesList] = useState<Province[]>([]);
  const [citiesList, setCitiesList] = useState<CityMunicipality[]>([]);
  const [barangaysList, setBarangaysList] = useState<Barangay[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  // Initialize PSGC locations
  useEffect(() => {
    let isMounted = true;
    async function initLocations() {
      setLoadingLocations(true);
      try {
        const [regs, provs, cities, brgys] = await Promise.all([
          getRegions(),
          getProvinces('100000000'),
          getCities('104300000', '100000000'),
          getBarangays('104305000'),
        ]);
        if (isMounted) {
          setRegionsList(regs);
          setProvincesList(provs);
          setCitiesList(cities);
          setBarangaysList(brgys);
        }
      } catch (err) {
        console.warn('Failed to initialize locations:', err);
      } finally {
        if (isMounted) setLoadingLocations(false);
      }
    }
    initLocations();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleRegionChange = async (regCode: string) => {
    const reg = regionsList.find((r) => r.code === regCode);
    const regName = reg ? reg.displayName || reg.name : '';
    setLoadingLocations(true);
    setAddBrgyError(null);
    try {
      const provs = await getProvinces(regCode);
      setProvincesList(provs);

      const firstProv = provs[0];
      const provCode = firstProv ? firstProv.code : '';
      const provName = firstProv ? firstProv.name : '';

      let cities: CityMunicipality[] = [];
      if (provCode) {
        cities = await getCities(provCode, regCode);
      }
      setCitiesList(cities);

      const firstCity = cities[0];
      const cityCode = firstCity ? firstCity.code : '';
      const cityName = firstCity ? firstCity.name : '';

      let brgys: Barangay[] = [];
      if (cityCode) {
        brgys = await getBarangays(cityCode);
      }
      setBarangaysList(brgys);

      const zip = cityCode ? getZipCodeForCity(cityCode, cityName) : '9000';

      setAddBrgyForm((prev) => ({
        ...prev,
        regionCode: regCode,
        regionName: regName,
        provinceCode: provCode,
        provinceName: provName,
        cityCode: cityCode,
        cityName: cityName,
        barangayName: '',
        zipcode: zip,
      }));
    } finally {
      setLoadingLocations(false);
    }
  };

  const handleProvinceChange = async (provCode: string) => {
    const prov = provincesList.find((p) => p.code === provCode);
    const provName = prov ? prov.name : '';
    setLoadingLocations(true);
    setAddBrgyError(null);
    try {
      const cities = await getCities(provCode, addBrgyForm.regionCode);
      setCitiesList(cities);

      const firstCity = cities[0];
      const cityCode = firstCity ? firstCity.code : '';
      const cityName = firstCity ? firstCity.name : '';

      let brgys: Barangay[] = [];
      if (cityCode) {
        brgys = await getBarangays(cityCode);
      }
      setBarangaysList(brgys);

      const zip = cityCode ? getZipCodeForCity(cityCode, cityName) : '9000';

      setAddBrgyForm((prev) => ({
        ...prev,
        provinceCode: provCode,
        provinceName: provName,
        cityCode: cityCode,
        cityName: cityName,
        barangayName: '',
        zipcode: zip,
      }));
    } finally {
      setLoadingLocations(false);
    }
  };

  const handleCityChange = async (cityCode: string) => {
    const city = citiesList.find((c) => c.code === cityCode);
    const cityName = city ? city.name : '';
    setLoadingLocations(true);
    setAddBrgyError(null);
    try {
      const brgys = await getBarangays(cityCode);
      setBarangaysList(brgys);

      const zip = getZipCodeForCity(cityCode, cityName);

      setAddBrgyForm((prev) => ({
        ...prev,
        cityCode: cityCode,
        cityName: cityName,
        barangayName: '',
        zipcode: zip,
      }));
    } finally {
      setLoadingLocations(false);
    }
  };

  // ---------------------------------------------------------
  // Live Barangay Metrics (Workforce + Verification Breakdown)
  // ---------------------------------------------------------
  const [liveBarangayStats, setLiveBarangayStats] = useState<Record<string, BarangayStats>>({});
  const [queueVerifications, setQueueVerifications] = useState<VerificationRequest[]>([]);
  const isSuperAdmin = currentRole === 'SUPERADMIN';

  useEffect(() => {
    if (isSuperAdmin) {
      // 1. Fetch workforce metrics from dashboard stats
      fetchDashboardStats()
        .then((res) => {
          if (res && Array.isArray(res.barangays) && res.barangays.length > 0) {
            const map: Record<string, BarangayStats> = {};
            res.barangays.forEach((b) => {
              map[b.name.toLowerCase()] = b;
            });
            setLiveBarangayStats(map);
          }
        })
        .catch(() => {});

      // 2. Fetch directly from the Verification Queue API (same source of truth as Verifications tab)
      fetchVerificationQueue()
        .then((queue) => {
          if (Array.isArray(queue)) {
            setQueueVerifications(queue);
          }
        })
        .catch(() => {});
    }
  }, [isSuperAdmin]);

  // ---------------------------------------------------------
  // Barangay Directory Table State (Coverage, Filter & Pagination)
  // ---------------------------------------------------------
  const [directorySearch, setDirectorySearch] = useState('');
  const [directoryFilter, setDirectoryFilter] = useState<'ALL' | 'ACTIVE' | 'NEEDS_ACCOUNT'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Set of active official LGU names (lowercased)
  const activeLguMap = useMemo(() => {
    const set = new Set<string>();
    (barangays || []).forEach((b) => {
      const clean = b.name.replace(/^(brgy\.?|barangay)\s+/i, '').trim().toLowerCase();
      if (clean) set.add(clean);
    });
    return set;
  }, [barangays]);

  // Combined directory: All barangays with active LGU OR with registered citizens
  const allDirectoryItems = useMemo(() => {
    const namesMap = new Map<string, { name: string; rawStat?: BarangayStats }>();

    // 1. Add official LGUs
    (barangays || []).forEach((b) => {
      const clean = b.name.replace(/^(brgy\.?|barangay)\s+/i, '').trim();
      if (clean) {
        namesMap.set(clean.toLowerCase(), { name: clean, rawStat: b });
      }
    });

    // 2. Add user barangays where citizens are registered
    (userBarangays || []).forEach((name) => {
      const clean = name.replace(/^(brgy\.?|barangay)\s+/i, '').trim();
      if (clean && clean.toLowerCase() !== 'unassigned' && !namesMap.has(clean.toLowerCase())) {
        namesMap.set(clean.toLowerCase(), { name: clean });
      }
    });

    // 3. Fallback check across registered users
    (users || []).forEach((u) => {
      if (u.barangay) {
        const clean = u.barangay.replace(/^(brgy\.?|barangay)\s+/i, '').trim();
        if (clean && clean.toLowerCase() !== 'unassigned' && !namesMap.has(clean.toLowerCase())) {
          namesMap.set(clean.toLowerCase(), { name: clean });
        }
      }
    });

    // Transform and sort: Active LGUs first, then alphabetical
    return Array.from(namesMap.values())
      .map(({ name, rawStat }) => {
        const hasLguAccount = activeLguMap.has(name.toLowerCase());
        return {
          name,
          hasLguAccount,
          rawStat,
        };
      })
      .sort((a, b) => {
        if (a.hasLguAccount !== b.hasLguAccount) {
          return a.hasLguAccount ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
  }, [barangays, userBarangays, users, activeLguMap]);

  // Filtered items based on status tab and search query
  const filteredDirectoryItems = useMemo(() => {
    return allDirectoryItems.filter((item) => {
      if (directoryFilter === 'ACTIVE' && !item.hasLguAccount) return false;
      if (directoryFilter === 'NEEDS_ACCOUNT' && item.hasLguAccount) return false;

      if (directorySearch.trim()) {
        const q = directorySearch.trim().toLowerCase();
        if (!item.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allDirectoryItems, directoryFilter, directorySearch]);

  // Pagination calculation
  const totalItems = filteredDirectoryItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validPage = Math.min(currentPage, totalPages);
  const startIndex = (validPage - 1) * pageSize;
  const paginatedItems = filteredDirectoryItems.slice(startIndex, startIndex + pageSize);

  // Executive counts
  const totalActiveLgus = useMemo(() => allDirectoryItems.filter((i) => i.hasLguAccount).length, [allDirectoryItems]);
  const totalNeedsSetup = useMemo(() => allDirectoryItems.filter((i) => !i.hasLguAccount).length, [allDirectoryItems]);

  const handleQuickSetupLgu = async (bgyName: string) => {
    setAddBrgyError(null);
    const clean = bgyName.replace(/^(brgy\.?|barangay)\s+/i, '').trim();

    let currentBrgys = barangaysList;
    if (currentBrgys.length === 0) {
      try {
        currentBrgys = await getBarangays('104305000');
        setBarangaysList(currentBrgys);
      } catch {
        // preserve current list
      }
    }

    const match = currentBrgys.find(
      (b) => b.name.toLowerCase() === clean.toLowerCase() || (b.displayName && b.displayName.toLowerCase() === clean.toLowerCase())
    );

    setLockedQuickSetupBarangay(clean);
    setAddBrgyForm((prev) => ({
      ...prev,
      regionCode: '100000000',
      regionName: 'Region X - Northern Mindanao',
      provinceCode: '104300000',
      provinceName: 'Misamis Oriental',
      cityCode: '104305000',
      cityName: 'City of Cagayan De Oro',
      barangayName: match ? match.name : clean,
      street: '',
      contactNumber: '',
      zipcode: '9000',
      country: 'Philippines',
    }));
    setShowAddBarangay(true);
  };

  const getBarangayRowStats = (bName: string, rawStat?: BarangayStats) => {
    const cleanName = bName.replace(/^(brgy\.?|barangay)\s+/i, '').trim().toLowerCase();
    const live = liveBarangayStats[cleanName];

    // Source 1: Registered users (Kasambahay + Homeowners)
    const bUsers = (users || []).filter((u) => {
      const uBgy = (u.barangay || '').replace(/^(brgy\.?|barangay)\s+/i, '').trim().toLowerCase();
      return uBgy === cleanName || uBgy.includes(cleanName) || cleanName.includes(uBgy);
    });

    // Source 2: Verification queue
    const allQueue = queueVerifications.length > 0 ? queueVerifications : verifications;
    const bVerifs = allQueue.filter((v) => {
      const vBgy = (v.barangay || '').replace(/^(brgy\.?|barangay)\s+/i, '').trim().toLowerCase();
      return vBgy === cleanName || vBgy.includes(cleanName) || cleanName.includes(vBgy);
    });

    const hasUserData = bUsers.length > 0;
    const hasQueueData = bVerifs.length > 0;

    const totalRegistered = hasUserData
      ? bUsers.length
      : (hasQueueData ? bVerifs.length : (live?.totalRegistered ?? rawStat?.totalRegistered ?? 0));

    const pending = hasQueueData
      ? bVerifs.filter((v) => v.status === 'PENDING / REVIEW').length
      : (hasUserData ? bUsers.filter((u) => u.status === 'PENDING' && !u.verified).length : (live?.pending ?? rawStat?.pending ?? 0));

    const verified = hasQueueData
      ? bVerifs.filter((v) => v.status === 'VERIFIED').length
      : (hasUserData ? bUsers.filter((u) => u.verified).length : (live?.verified ?? rawStat?.verified ?? 0));

    const rejected = hasQueueData
      ? bVerifs.filter((v) => v.status === 'REJECTED').length
      : (live?.rejected ?? rawStat?.rejected ?? 0);

    const noDocuments = hasQueueData
      ? bVerifs.filter((v) => v.status === 'NO_DOCUMENTS').length
      : (hasUserData ? bUsers.filter((u) => !u.verified && u.status !== 'PENDING').length : (live?.noDocuments ?? rawStat?.noDocuments ?? 0));

    // Kasambahay employment breakdown
    const kasambahayUsers = bUsers.filter((u) => u.role === 'KASAMBAHAY');
    const employed = live?.employed ?? rawStat?.employed ?? 0;
    const available = kasambahayUsers.length > 0
      ? Math.max(0, kasambahayUsers.length - employed)
      : (live?.available ?? rawStat?.available ?? 0);

    const totalKasambahay = kasambahayUsers.length > 0 ? kasambahayUsers.length : (employed + available);
    const employmentRatio = totalKasambahay > 0
      ? Math.round((employed / totalKasambahay) * 100)
      : (live?.employmentRatio ?? rawStat?.employmentRatio ?? 0);

    return {
      totalRegistered,
      pending,
      verified,
      rejected,
      noDocuments,
      employed,
      available,
      employmentRatio,
    };
  };

  // ---------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwForm.current || !pwForm.newPw || !pwForm.confirm) {
      setPwError('All three password fields are required.');
      return;
    }
    if (pwForm.newPw.length < 8) {
      setPwError('New password must be at least 8 characters long.');
      return;
    }
    if (pwForm.newPw !== pwForm.confirm) {
      setPwError('The new passwords do not match. Please re-enter.');
      return;
    }
    if (pwForm.current === pwForm.newPw) {
      setPwError('Your new password must differ from your current password.');
      return;
    }

    setPwLoading(true);
    setPwError(null);
    setPwSuccess(false);

    try {
      const res = await changePasswordApi({
        current_password: pwForm.current,
        new_password: pwForm.newPw,
        confirm_password: pwForm.confirm,
      });

      if (res.error) {
        setPwError(res.error);
      } else {
        setPwSuccess(true);
        setPwForm({ current: '', newPw: '', confirm: '' });
      }
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : 'Failed to change password. Please check your current password.');
    } finally {
      setPwLoading(false);
    }
  };

  const handleSaveDeskProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeskLoading(true);
    setDeskError(null);
    setDeskSuccess(false);

    const nameParts = (deskProfile.officerName || '').trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    try {
      // 1. Save to backend database
      const res = await updateDeskProfileApi({
        street: deskProfile.address.trim(),
        contact_number: deskProfile.hotline.trim(),
        user_about: deskProfile.officeHours.trim(),
        first_name: firstName,
        last_name: lastName,
        barangay: activeBarangay,
      });

      if (res.error) {
        setDeskError(sanitizeUserFriendlyError(res.error));
        return;
      }

      // 2. Sync to local storage
      const now = new Date().toISOString();
      const updated: BarangayDeskProfile = {
        ...deskProfile,
        barangayName: activeBarangay,
        lastUpdated: now,
      };
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setDeskProfile(updated);
      setDeskSuccess(true);
    } catch (err: unknown) {
      setDeskError(sanitizeUserFriendlyError(err instanceof Error ? err.message : 'Failed to save desk profile to database. Please check your connection.'));
    } finally {
      setDeskLoading(false);
    }
  };

  const handleAddBarangaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawName = addBrgyForm.barangayName.trim();

    if (!rawName) {
      setAddBrgyError('Please select a Barangay from the dropdown list.');
      return;
    }

    const cleanName = rawName.replace(/^(brgy\.?|barangay)\s+/i, '').trim();

    const duplicate = barangays.some((b) => {
      const existingClean = b.name.replace(/^(brgy\.?|barangay)\s+/i, '').trim().toLowerCase();
      return existingClean === cleanName.toLowerCase();
    });

    if (duplicate) {
      setAddBrgyError(`Barangay "${cleanName}" is already registered in the directory.`);
      return;
    }

    let formattedContact: string | undefined = undefined;
    const rawContactDigits = addBrgyForm.contactNumber.replace(/\D/g, '');
    if (rawContactDigits) {
      if (rawContactDigits.length !== 10 || !rawContactDigits.startsWith('9')) {
        setAddBrgyError('Please enter a valid 10-digit Philippine mobile number starting with 9 (e.g. 955 555 5555).');
        return;
      }
      formattedContact = `+63${rawContactDigits}`;
    }

    setIsSubmittingBrgy(true);
    setAddBrgyError(null);

    try {
      const res = await addBarangay({
        name: cleanName,
        region: addBrgyForm.regionName || 'Region X - Northern Mindanao',
        province: addBrgyForm.provinceName || 'Misamis Oriental',
        city: addBrgyForm.cityName || 'City of Cagayan De Oro',
        street: addBrgyForm.street.trim(),
        contact_number: formattedContact || undefined,
        zipcode: addBrgyForm.zipcode.trim() || '9000',
        country: 'Philippines',
        totalWorkers: 0,
        employed: 0,
        available: 0,
        employmentRatio: 0,
        status: 'ACTIVE',
      });

      if (res && !res.success) {
        setAddBrgyError(sanitizeUserFriendlyError(res.error || 'Failed to register barangay in database.'));
        return;
      }

      setAddBrgyForm((prev) => ({
        ...prev,
        barangayName: '',
        street: '',
        contactNumber: '',
      }));
      setLockedQuickSetupBarangay(null);
      setShowAddBarangay(false);
    } catch (err: unknown) {
      setAddBrgyError(sanitizeUserFriendlyError(err instanceof Error ? err.message : 'Failed to register barangay in database.'));
    } finally {
      setIsSubmittingBrgy(false);
    }
  };

  // ---------------------------------------------------------
  // Null Guard
  // ---------------------------------------------------------
  if (!currentUser) {
    return (
      <div className="bg-white rounded-3xl p-8 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
        <h2 className="text-lg font-black font-display text-[#0D0D11]">Session Expired</h2>
        <p className="text-xs text-zinc-400">Please sign in to access portal settings and configurations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-black font-display text-[#0D0D11] tracking-tight">
          Settings
        </h1>
        <p className="text-xs text-zinc-400 font-medium mt-1">
          {isSuperAdmin
            ? 'Manage city-wide barangay directory and account authentication credentials.'
            : `Configure public desk profile and account security for Brgy. ${activeBarangay || 'Officer'}.`}
        </p>
      </div>

      {/* ========================================================= */}
      {/* SECTION 1: ROLE-SPECIFIC CARD                             */}
      {/* ========================================================= */}

      {isSuperAdmin ? (
        /* ---------------- SUPERADMIN: BARANGAY DIRECTORY & COVERAGE ---------------- */
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[#0D0D11] font-black font-display text-base">
                <Building2 className="w-5 h-5 text-[#FFB380]" />
                <span>Barangay Directory & Coverage</span>
              </div>
              <p className="text-xs text-zinc-400 font-medium mt-1">
                Monitors registered citizens and administrative coverage across Cagayan de Oro City barangays.
              </p>
            </div>

            <button
              id="btn-add-barangay"
              type="button"
              onClick={() => {
                setAddBrgyError(null);
                setLockedQuickSetupBarangay(null);
                setAddBrgyForm((prev) => ({
                  ...prev,
                  barangayName: '',
                  street: '',
                  contactNumber: '',
                  zipcode: '9000',
                  country: 'Philippines',
                }));
                setShowAddBarangay(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full bg-[#0D0D11] hover:bg-black text-white text-xs font-black font-display tracking-wide cursor-pointer transition shadow-sm shrink-0"
            >
              <Plus className="w-4 h-4 text-[#FFB380]" />
              <span>Add Barangay</span>
            </button>
          </div>

          {/* Filter Tabs & Search Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="grid grid-cols-3 w-full sm:w-auto sm:flex sm:items-center gap-1.5 p-1 bg-[#F0F0EC] rounded-full select-none">
              {/* All Filter */}
              <button
                type="button"
                onClick={() => {
                  setDirectoryFilter('ALL');
                  setCurrentPage(1);
                }}
                className={`flex items-center justify-center gap-1 px-3 sm:px-4 py-2 rounded-full text-xs font-bold font-display whitespace-nowrap transition cursor-pointer ${
                  directoryFilter === 'ALL'
                    ? 'bg-white text-zinc-950 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <span>All</span>
                <span className={`text-[11px] font-black ${
                  directoryFilter === 'ALL' ? 'text-zinc-900' : 'text-zinc-400'
                }`}>
                  ({allDirectoryItems.length})
                </span>
              </button>

              {/* Active LGUs Filter */}
              <button
                type="button"
                onClick={() => {
                  setDirectoryFilter('ACTIVE');
                  setCurrentPage(1);
                }}
                className={`flex items-center justify-center gap-1 px-3 sm:px-4 py-2 rounded-full text-xs font-bold font-display whitespace-nowrap transition cursor-pointer ${
                  directoryFilter === 'ACTIVE'
                    ? 'bg-white text-zinc-950 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <span className="hidden sm:inline">Active LGUs</span>
                <span className="sm:hidden">Active</span>
                <span className={`text-[11px] font-black ${
                  directoryFilter === 'ACTIVE' ? 'text-emerald-600' : 'text-zinc-400'
                }`}>
                  ({totalActiveLgus})
                </span>
              </button>

              {/* Needs Account Filter */}
              <button
                type="button"
                onClick={() => {
                  setDirectoryFilter('NEEDS_ACCOUNT');
                  setCurrentPage(1);
                }}
                className={`flex items-center justify-center gap-1 px-3 sm:px-4 py-2 rounded-full text-xs font-bold font-display whitespace-nowrap transition cursor-pointer ${
                  directoryFilter === 'NEEDS_ACCOUNT'
                    ? 'bg-white text-zinc-950 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <span className="hidden sm:inline">Needs Account</span>
                <span className="sm:hidden">Needs LGU</span>
                <span className={`text-[11px] font-black ${
                  directoryFilter === 'NEEDS_ACCOUNT' ? 'text-amber-600' : 'text-zinc-400'
                }`}>
                  ({totalNeedsSetup})
                </span>
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <input
                type="text"
                value={directorySearch}
                onChange={(e) => {
                  setDirectorySearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search barangay..."
                className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#FFB380]/40 font-medium transition"
              />
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Directory Table */}
          <div className="overflow-x-auto border border-zinc-100 rounded-2xl">
            <table className="w-full text-left border-collapse text-xs min-w-[860px]">
              <thead>
                <tr className="bg-zinc-50/80 text-[11px] font-black uppercase tracking-wider text-zinc-400 font-display border-b border-zinc-100">
                  <th className="py-3 px-4">Barangay Name</th>
                  <th className="py-3 px-3 text-center">LGU Account</th>
                  <th className="py-3 px-3 text-center">Total Citizens</th>
                  <th className="py-3 px-3 text-center">Pending</th>
                  <th className="py-3 px-3 text-center">Verified</th>
                  <th className="py-3 px-3 text-center">Rejected</th>
                  <th className="py-3 px-3 text-center">No Docs</th>
                  <th className="py-3 px-3 text-center">Employed</th>
                  <th className="py-3 px-3 text-center">Available</th>
                  <th className="py-3 px-3 text-center">Employment Rate</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-zinc-400 font-medium">
                      {directorySearch
                        ? `No barangays found matching "${directorySearch}".`
                        : 'No barangays registered yet. Click "+ Add Barangay" to create one.'}
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item) => {
                    const rowStats = getBarangayRowStats(item.name, item.rawStat);
                    return (
                      <tr key={item.name} className="hover:bg-zinc-50/50 transition">
                        <td className="py-3.5 px-4 font-bold font-display text-zinc-900">
                          Brgy. {item.name}
                        </td>
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          {item.hasLguAccount ? (
                            <div 
                              className="inline-flex items-center justify-center gap-1.5"
                              title={`Official LGU account configured for Brgy. ${item.name}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                              <span className="text-xs font-semibold text-zinc-900">Active LGU</span>
                            </div>
                          ) : (
                            <div 
                              className="inline-flex items-center justify-center gap-1.5"
                              title={`No administrative desk account registered for Brgy. ${item.name}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 shrink-0" />
                              <span className="text-xs font-medium text-zinc-400">No Account</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-center font-bold text-zinc-900">
                          {rowStats.totalRegistered}
                        </td>
                        <td className="py-3.5 px-3 text-center font-semibold text-zinc-700">
                          {rowStats.pending}
                        </td>
                        <td className="py-3.5 px-3 text-center font-semibold text-zinc-700">
                          {rowStats.verified}
                        </td>
                        <td className="py-3.5 px-3 text-center font-semibold text-zinc-700">
                          {rowStats.rejected}
                        </td>
                        <td className="py-3.5 px-3 text-center font-semibold text-zinc-700">
                          {rowStats.noDocuments}
                        </td>
                        <td className="py-3.5 px-3 text-center font-semibold text-zinc-700">
                          {rowStats.employed}
                        </td>
                        <td className="py-3.5 px-3 text-center font-semibold text-zinc-700">
                          {rowStats.available}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="font-black font-display text-zinc-900">
                            {rowStats.employmentRatio}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {item.hasLguAccount ? (
                            <span className="text-[11px] font-semibold text-zinc-400">
                              Configured
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleQuickSetupLgu(item.name)}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#0D0D11] hover:bg-black text-white text-[11px] font-bold font-display cursor-pointer transition shadow-sm hover:scale-[1.02]"
                              title={`Create official LGU account for Brgy. ${item.name}`}
                            >
                              <Plus className="w-3 h-3 text-[#FFB380]" />
                              <span>Setup LGU</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-zinc-100 text-xs">
              <span className="text-zinc-500 font-medium">
                Showing <span className="font-bold text-zinc-900">{startIndex + 1}</span> to{' '}
                <span className="font-bold text-zinc-900">{Math.min(startIndex + pageSize, totalItems)}</span> of{' '}
                <span className="font-bold text-zinc-900">{totalItems}</span> barangays
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={validPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition text-xs"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-xl font-bold flex items-center justify-center transition cursor-pointer text-xs ${
                      validPage === page
                        ? 'bg-[#0D0D11] text-white shadow-sm'
                        : 'border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={validPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition text-xs"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ---------------- ADMIN: BARANGAY DESK PROFILE ---------------- */
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#FFB380]" />
                <h2 className="text-lg font-black font-display text-[#0D0D11]">
                  Barangay Desk Profile
                </h2>
                <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200">
                  Brgy. {activeBarangay || 'Unassigned'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-medium mt-1">
                Official contact details and operating schedule saved directly to the database.
              </p>
            </div>

            {deskProfile.lastUpdated && (
              <div className="text-[11px] text-zinc-400 font-medium">
                Last saved: {new Date(deskProfile.lastUpdated).toLocaleDateString()} {new Date(deskProfile.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>

          {!activeBarangay && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Your account has no barangay assigned. Please contact the Superadmin to set your jurisdiction.</span>
            </div>
          )}

          {deskError && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{deskError}</span>
            </div>
          )}

          {deskSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Barangay Desk Profile saved successfully to the server database.</span>
            </div>
          )}

          <form onSubmit={handleSaveDeskProfile} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Officer-in-Charge */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-500 font-display mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Desk Officer in Charge</span>
                  </div>
                </label>
                <input
                  type="text"
                  value={deskProfile.officerName || ''}
                  onChange={(e) => {
                    setDeskSuccess(false);
                    setDeskProfile({ ...deskProfile, officerName: e.target.value });
                  }}
                  disabled={deskLoading || deskFetching}
                  placeholder="e.g. Maria Elena Santos"
                  className="w-full border border-zinc-200 rounded-2xl px-4 py-2.5 text-xs font-medium text-[#0D0D11] focus:outline-none focus:ring-2 focus:ring-[#FFB380]"
                />
                <span className="text-[10px] text-zinc-400 mt-1 block">
                  Maps to accounts first and last name columns
                </span>
              </div>

              {/* Official Hotline */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-500 font-display mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Official Desk Hotline</span>
                  </div>
                </label>
                <input
                  type="text"
                  value={deskProfile.hotline}
                  onChange={(e) => {
                    setDeskSuccess(false);
                    setDeskProfile({ ...deskProfile, hotline: e.target.value });
                  }}
                  disabled={deskLoading || deskFetching}
                  placeholder="+639171234567 or 09171234567"
                  className="w-full border border-zinc-200 rounded-2xl px-4 py-2.5 text-xs font-medium text-[#0D0D11] focus:outline-none focus:ring-2 focus:ring-[#FFB380]"
                />
                <span className="text-[10px] text-zinc-400 mt-1 block">
                  Maps to contact_number (Philippine mobile format)
                </span>
              </div>
            </div>

            {/* Physical Desk Address */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-500 font-display mb-1.5">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Physical Desk / Barangay Hall Location</span>
                </div>
              </label>
              <input
                type="text"
                maxLength={100}
                value={deskProfile.address}
                onChange={(e) => {
                  setDeskSuccess(false);
                  setDeskProfile({ ...deskProfile, address: e.target.value });
                }}
                disabled={deskLoading || deskFetching}
                placeholder="e.g. Zone 5, Barangay Hall Compound, Near Health Center"
                className="w-full border border-zinc-200 rounded-2xl px-4 py-2.5 text-xs font-medium text-[#0D0D11] focus:outline-none focus:ring-2 focus:ring-[#FFB380]"
              />
              <span className="text-[10px] text-zinc-400 mt-1 block">
                Maps to street column (Max 100 characters)
              </span>
            </div>

            {/* Operating Hours & Announcements */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-500 font-display mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Office Operating Hours & Public Notice</span>
                </div>
              </label>
              <textarea
                rows={3}
                maxLength={500}
                value={deskProfile.officeHours}
                onChange={(e) => {
                  setDeskSuccess(false);
                  setDeskProfile({ ...deskProfile, officeHours: e.target.value });
                }}
                disabled={deskLoading || deskFetching}
                placeholder="e.g. Monday to Friday, 8:00 AM – 5:00 PM. Closed on weekends and official national holidays."
                className="w-full border border-zinc-200 rounded-2xl p-4 text-xs font-medium text-[#0D0D11] focus:outline-none focus:ring-2 focus:ring-[#FFB380] resize-none"
              />
              <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-1">
                <span>Maps to user_about column</span>
                <span>{deskProfile.officeHours.length}/500</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                id="btn-save-desk-profile"
                type="submit"
                disabled={deskLoading || deskFetching || !activeBarangay}
                className={clsx(
                  'inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-black font-display text-white transition shadow-sm cursor-pointer',
                  deskLoading || deskFetching || !activeBarangay
                    ? 'bg-zinc-400 cursor-not-allowed'
                    : 'bg-[#0D0D11] hover:bg-black'
                )}
              >
                {deskLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving to Database…</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Desk Profile</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 2: CHANGE PASSWORD (SHARED FOR BOTH ROLES)        */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="border-b border-zinc-100 pb-5">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[#FFB380]" />
            <h2 className="text-lg font-black font-display text-[#0D0D11]">
              Account Security & Password
            </h2>
          </div>
          <p className="text-xs text-zinc-400 font-medium mt-1">
            Update your administrative login credentials. Passwords must be at least 8 characters.
          </p>
        </div>

        {pwError && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{pwError}</span>
          </div>
        )}

        {pwSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>Password updated successfully. Please use your new password on your next login.</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl">
          {/* Current Password */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-500 font-display mb-1.5">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrentPw ? 'text' : 'password'}
                value={pwForm.current}
                onChange={(e) => {
                  setPwSuccess(false);
                  setPwForm({ ...pwForm, current: e.target.value });
                }}
                disabled={pwLoading}
                placeholder="Enter current password"
                className="w-full border border-zinc-200 rounded-2xl px-4 py-2.5 text-xs font-medium text-[#0D0D11] focus:outline-none focus:ring-2 focus:ring-[#FFB380] pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPw(!showCurrentPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer p-1"
                aria-label="Toggle password visibility"
              >
                {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-500 font-display mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPw ? 'text' : 'password'}
                value={pwForm.newPw}
                onChange={(e) => {
                  setPwSuccess(false);
                  setPwForm({ ...pwForm, newPw: e.target.value });
                }}
                disabled={pwLoading}
                placeholder="Minimum 8 characters"
                className="w-full border border-zinc-200 rounded-2xl px-4 py-2.5 text-xs font-medium text-[#0D0D11] focus:outline-none focus:ring-2 focus:ring-[#FFB380] pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPw(!showNewPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer p-1"
                aria-label="Toggle password visibility"
              >
                {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-500 font-display mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPw ? 'text' : 'password'}
                value={pwForm.confirm}
                onChange={(e) => {
                  setPwSuccess(false);
                  setPwForm({ ...pwForm, confirm: e.target.value });
                }}
                disabled={pwLoading}
                placeholder="Re-enter new password"
                className="w-full border border-zinc-200 rounded-2xl px-4 py-2.5 text-xs font-medium text-[#0D0D11] focus:outline-none focus:ring-2 focus:ring-[#FFB380] pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPw(!showConfirmPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer p-1"
                aria-label="Toggle password visibility"
              >
                {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              id="btn-change-password"
              type="submit"
              disabled={pwLoading}
              className={clsx(
                'inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-black font-display text-white transition shadow-sm cursor-pointer',
                pwLoading ? 'bg-zinc-400 cursor-not-allowed' : 'bg-[#0D0D11] hover:bg-black'
              )}
            >
              {pwLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating Password…</span>
                </>
              ) : (
                <>
                  <Shield className="w-3.5 h-3.5 text-[#FFB380]" />
                  <span>Update Password</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ========================================================= */}
      {/* ADD BARANGAY MODAL (SUPERADMIN ONLY)                      */}
      {/* ========================================================= */}
      {showAddBarangay && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowAddBarangay(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {lockedQuickSetupBarangay ? (
                  <div className="w-9 h-9 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-2xl bg-orange-500/10 flex items-center justify-center text-[#FFB380] shrink-0">
                    <Building2 className="w-4 h-4 text-orange-500" />
                  </div>
                )}
                <div>
                  <h3 className="text-base font-black font-display text-[#0D0D11]">
                    {lockedQuickSetupBarangay ? `Setup LGU: Brgy. ${lockedQuickSetupBarangay}` : 'Add New Barangay'}
                  </h3>
                  <p className="text-[11px] text-zinc-400 font-medium">
                    {lockedQuickSetupBarangay
                      ? 'Configure administrative desk details for this registered community.'
                      : 'Select from official Philippine Standard Geographic Code (PSGC) places.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddBarangay(false);
                  setLockedQuickSetupBarangay(null);
                  setAddBrgyError(null);
                }}
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer p-1.5 rounded-xl hover:bg-zinc-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Jurisdiction Locked Notice */}
            {lockedQuickSetupBarangay ? (
              <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold">Jurisdiction Locked:</span> Geographic location is locked to{' '}
                  <strong className="font-black text-amber-950">Brgy. {lockedQuickSetupBarangay}</strong> (Cagayan de Oro, Misamis Oriental) because registered citizens belong to this barangay. Location fields cannot be modified to prevent accidental reassignment.
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-400 font-medium">
                Select from official Philippine Standard Geographic Code (PSGC) places to avoid typos and preserve data integrity.
              </p>
            )}

            {addBrgyError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{addBrgyError}</span>
              </div>
            )}

            <form onSubmit={handleAddBarangaySubmit} className="space-y-4">
              {/* Region Select Dropdown */}
              <div>
                <label className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-zinc-500 font-display mb-1.5">
                  <span>Region</span>
                  {lockedQuickSetupBarangay && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 font-medium normal-case">
                      <Lock className="w-3 h-3 text-zinc-400" /> Locked
                    </span>
                  )}
                </label>
                <div className="relative">
                  <select
                    value={addBrgyForm.regionCode}
                    onChange={(e) => handleRegionChange(e.target.value)}
                    disabled={Boolean(lockedQuickSetupBarangay) || loadingLocations}
                    className={clsx(
                      "w-full border rounded-2xl px-4 py-2.5 text-xs font-medium appearance-none pr-8 transition",
                      lockedQuickSetupBarangay
                        ? "border-zinc-200 bg-zinc-50 text-zinc-600 cursor-not-allowed select-none"
                        : "border-zinc-200 bg-white text-[#0D0D11] focus:outline-none focus:ring-2 focus:ring-[#FFB380] cursor-pointer disabled:bg-zinc-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {regionsList.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.displayName || r.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Province and City Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Province Dropdown */}
                <div>
                  <label className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-zinc-500 font-display mb-1.5">
                    <span>Province</span>
                    {lockedQuickSetupBarangay && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 font-medium normal-case">
                        <Lock className="w-3 h-3 text-zinc-400" /> Locked
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <select
                      value={addBrgyForm.provinceCode}
                      onChange={(e) => handleProvinceChange(e.target.value)}
                      disabled={Boolean(lockedQuickSetupBarangay) || loadingLocations || provincesList.length === 0}
                      className={clsx(
                        "w-full border rounded-2xl px-4 py-2.5 text-xs font-medium appearance-none pr-8 transition",
                        lockedQuickSetupBarangay
                          ? "border-zinc-200 bg-zinc-50 text-zinc-600 cursor-not-allowed select-none"
                          : "border-zinc-200 bg-white text-[#0D0D11] focus:outline-none focus:ring-2 focus:ring-[#FFB380] cursor-pointer disabled:bg-zinc-50 disabled:cursor-not-allowed"
                      )}
                    >
                      {provincesList.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.displayName || p.name}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* City / Municipality Dropdown */}
                <div>
                  <label className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-zinc-500 font-display mb-1.5">
                    <span>City / Municipality</span>
                    {lockedQuickSetupBarangay && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 font-medium normal-case">
                        <Lock className="w-3 h-3 text-zinc-400" /> Locked
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <select
                      value={addBrgyForm.cityCode}
                      onChange={(e) => handleCityChange(e.target.value)}
                      disabled={Boolean(lockedQuickSetupBarangay) || loadingLocations || citiesList.length === 0}
                      className={clsx(
                        "w-full border rounded-2xl px-4 py-2.5 text-xs font-medium appearance-none pr-8 transition",
                        lockedQuickSetupBarangay
                          ? "border-zinc-200 bg-zinc-50 text-zinc-600 cursor-not-allowed select-none"
                          : "border-zinc-200 bg-white text-[#0D0D11] focus:outline-none focus:ring-2 focus:ring-[#FFB380] cursor-pointer disabled:bg-zinc-50 disabled:cursor-not-allowed"
                      )}
                    >
                      {citiesList.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.displayName || c.name}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Barangay Dropdown */}
              <div>
                <label className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-zinc-500 font-display mb-1.5">
                  <span>
                    Barangay Name <span className="text-red-500">*</span>
                  </span>
                  {lockedQuickSetupBarangay && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 font-medium normal-case">
                      <Lock className="w-3 h-3 text-zinc-400" /> Locked
                    </span>
                  )}
                </label>
                <div className="relative">
                  <select
                    value={addBrgyForm.barangayName}
                    onChange={(e) => {
                      if (lockedQuickSetupBarangay) return;
                      setAddBrgyError(null);
                      setAddBrgyForm({ ...addBrgyForm, barangayName: e.target.value });
                    }}
                    disabled={Boolean(lockedQuickSetupBarangay) || loadingLocations || barangaysList.length === 0}
                    className={clsx(
                      "w-full border rounded-2xl px-4 py-2.5 text-xs font-medium appearance-none pr-8 transition",
                      lockedQuickSetupBarangay
                        ? "border-zinc-200 bg-zinc-50 text-zinc-600 cursor-not-allowed select-none"
                        : "border-zinc-200 bg-white text-[#0D0D11] focus:outline-none focus:ring-2 focus:ring-[#FFB380] cursor-pointer disabled:bg-zinc-50 disabled:cursor-not-allowed"
                    )}
                  >
                    <option value="">
                      -- Select Barangay {barangaysList.length > 0 ? `(${barangaysList.length} Options)` : ''} --
                    </option>
                    {barangaysList.map((b) => {
                      const cleanB = b.name.replace(/^(brgy\.?|barangay)\s+/i, '').trim().toLowerCase();
                      const isAlreadyAdded = barangays.some((existing) => {
                        const existingClean = existing.name.replace(/^(brgy\.?|barangay)\s+/i, '').trim().toLowerCase();
                        return existingClean === cleanB;
                      });
                      return (
                        <option
                          key={b.code}
                          value={b.name}
                          disabled={isAlreadyAdded && addBrgyForm.barangayName !== b.name}
                        >
                          {b.displayName || b.name} {isAlreadyAdded ? '✓ (Already Registered)' : ''}
                        </option>
                      );
                    })}
                    {/* In locked setup mode, ensure the target barangay is in the options list if not already present in the PSGC list */}
                    {lockedQuickSetupBarangay && !barangaysList.some((b) => b.name.toLowerCase() === addBrgyForm.barangayName.toLowerCase()) && (
                      <option value={addBrgyForm.barangayName}>
                        {addBrgyForm.barangayName.startsWith('Barangay') || addBrgyForm.barangayName.startsWith('Brgy.') ? addBrgyForm.barangayName : `Brgy. ${addBrgyForm.barangayName}`}
                      </option>
                    )}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* House No. / Street / Zone / Subdivision */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-500 font-display mb-1.5">
                  House No. / Street / Zone / Subdivision
                </label>
                <input
                  type="text"
                  maxLength={100}
                  autoFocus={Boolean(lockedQuickSetupBarangay)}
                  value={addBrgyForm.street}
                  onChange={(e) => setAddBrgyForm({ ...addBrgyForm, street: e.target.value })}
                  placeholder="e.g. Zone 1, Purok 3 / Barangay Hall Compound"
                  className="w-full border border-zinc-200 rounded-2xl px-4 py-2.5 text-xs font-medium text-[#0D0D11] focus:outline-none focus:ring-2 focus:ring-[#FFB380]"
                />
              </div>

              {/* Official Desk Contact / Hotline Number */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-500 font-display mb-1.5">
                  Official Desk Contact / Hotline Number
                </label>
                <div className="flex items-center border border-zinc-200 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-[#FFB380] focus-within:border-transparent bg-white transition">
                  <div className="bg-zinc-50 border-r border-zinc-200 px-3.5 py-2.5 flex items-center gap-1.5 select-none shrink-0">
                    <span className="text-xs">🇵🇭</span>
                    <span className="text-xs font-black font-display text-zinc-700">+63</span>
                  </div>
                  <input
                    type="tel"
                    value={addBrgyForm.contactNumber}
                    onChange={(e) => {
                      setAddBrgyError(null);
                      const formatted = formatPhilippineMobile(e.target.value);
                      setAddBrgyForm({ ...addBrgyForm, contactNumber: formatted });
                    }}
                    placeholder="9XX XXX XXXX"
                    className="w-full px-3.5 py-2.5 text-xs font-medium text-[#0D0D11] focus:outline-none bg-transparent"
                  />
                </div>
                <p className="text-[10px] text-zinc-400 mt-1 font-medium">
                  Type the 10-digit number starting with 9. Formatted as +63 9XX XXX XXXX. Leave blank to auto-generate.
                </p>
              </div>

              {/* Zip Code and Country Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-zinc-500 font-display mb-1.5">
                    <span>Zip Code</span>
                    {lockedQuickSetupBarangay && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 font-medium normal-case">
                        <Lock className="w-3 h-3 text-zinc-400" /> Locked
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={addBrgyForm.zipcode}
                    readOnly={Boolean(lockedQuickSetupBarangay)}
                    onChange={(e) => {
                      if (lockedQuickSetupBarangay) return;
                      setAddBrgyForm({ ...addBrgyForm, zipcode: e.target.value.replace(/\D/g, '').slice(0, 4) });
                    }}
                    placeholder="e.g. 9000"
                    className={clsx(
                      "w-full border rounded-2xl px-4 py-2.5 text-xs font-medium focus:outline-none transition",
                      lockedQuickSetupBarangay
                        ? "border-zinc-200 bg-zinc-50 text-zinc-600 cursor-not-allowed select-none"
                        : "border-zinc-200 text-[#0D0D11] focus:ring-2 focus:ring-[#FFB380]"
                    )}
                  />
                </div>

                <div>
                  <label className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-zinc-500 font-display mb-1.5">
                    <span>Country</span>
                    {lockedQuickSetupBarangay && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 font-medium normal-case">
                        <Lock className="w-3 h-3 text-zinc-400" /> Locked
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={addBrgyForm.country}
                    readOnly
                    className="w-full border border-zinc-200 rounded-2xl px-4 py-2.5 text-xs font-medium text-zinc-600 bg-zinc-50 cursor-not-allowed focus:outline-none select-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddBarangay(false);
                    setLockedQuickSetupBarangay(null);
                    setAddBrgyError(null);
                  }}
                  className="px-4 py-2 rounded-full bg-[#F0F0EC] hover:bg-[#E5E5E0] text-zinc-700 text-xs font-black font-display cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-add-barangay"
                  type="submit"
                  disabled={isSubmittingBrgy}
                  className="px-5 py-2 rounded-full bg-[#0D0D11] hover:bg-black text-white text-xs font-black font-display cursor-pointer transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isSubmittingBrgy ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving to Database...</span>
                    </>
                  ) : (
                    <span>{lockedQuickSetupBarangay ? 'Setup LGU Desk' : 'Add Barangay'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
