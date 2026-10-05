import React, { useState, useEffect } from 'react';
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
  Save
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
  const { currentRole, currentUser, selectedBarangay, barangays, addBarangay, verifications } = useAdmin();

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
    customBarangayName: '',
    street: '',
    contactNumber: '',
    zipcode: '9000',
    country: 'Philippines',
  });
  const [addBrgyError, setAddBrgyError] = useState<string | null>(null);
  const [isSubmittingBrgy, setIsSubmittingBrgy] = useState(false);

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
        customBarangayName: '',
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
        customBarangayName: '',
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
        customBarangayName: '',
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

  const getBarangayRowStats = (b: BarangayStats) => {
    const key = b.name.toLowerCase();
    const live = liveBarangayStats[key];

    // Source of truth: Derive verification breakdown directly from the Verification Queue
    const cleanName = b.name.replace(/^(brgy\.?|barangay)\s+/i, '').trim().toLowerCase();
    const allQueue = queueVerifications.length > 0 ? queueVerifications : verifications;

    const bVerifs = allQueue.filter((v) => {
      const vBgy = (v.barangay || '').replace(/^(brgy\.?|barangay)\s+/i, '').trim().toLowerCase();
      return vBgy === cleanName || vBgy.includes(cleanName) || cleanName.includes(vBgy);
    });

    const hasQueueData = bVerifs.length > 0;
    const pending = hasQueueData
      ? bVerifs.filter((v) => v.status === 'PENDING / REVIEW').length
      : (live?.pending ?? b.pending ?? 0);
    const verified = hasQueueData
      ? bVerifs.filter((v) => v.status === 'VERIFIED').length
      : (live?.verified ?? b.verified ?? 0);
    const rejected = hasQueueData
      ? bVerifs.filter((v) => v.status === 'REJECTED').length
      : (live?.rejected ?? b.rejected ?? 0);
    const noDocuments = hasQueueData
      ? bVerifs.filter((v) => v.status === 'NO_DOCUMENTS').length
      : (live?.noDocuments ?? b.noDocuments ?? 0);
    const totalRegistered = hasQueueData
      ? bVerifs.length
      : (live?.totalRegistered ?? b.totalRegistered ?? 0);

    const employed = live?.employed ?? b.employed ?? 0;
    const available = live?.available ?? b.available ?? 0;
    const employmentRatio = live?.employmentRatio ?? b.employmentRatio ?? 0;

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
    const rawName = addBrgyForm.barangayName === '__custom__'
      ? addBrgyForm.customBarangayName.trim()
      : addBrgyForm.barangayName.trim();

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
        customBarangayName: '',
        street: '',
        contactNumber: '',
      }));
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
        /* ---------------- SUPERADMIN: BARANGAY DIRECTORY ---------------- */
        <div className="bg-white rounded-3xl p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[#0D0D11] font-black font-display text-base">
                <Building2 className="w-5 h-5 text-[#FFB380]" />
                <span>Barangay Directory</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                  {barangays.length} LGUs
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-medium mt-0.5">
                Configured administrative jurisdictions across Cagayan de Oro City
              </p>
            </div>

            <button
              id="btn-add-barangay"
              type="button"
              onClick={() => {
                setAddBrgyError(null);
                setAddBrgyForm((prev) => ({
                  ...prev,
                  barangayName: '',
                  customBarangayName: '',
                  street: '',
                  contactNumber: '',
                }));
                setShowAddBarangay(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full bg-[#0D0D11] hover:bg-black text-white text-xs font-black font-display tracking-wide cursor-pointer transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Barangay</span>
            </button>
          </div>

          {/* Directory Table */}
          <div className="overflow-x-auto border border-zinc-100 rounded-2xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50/80 text-[11px] font-black uppercase tracking-wider text-zinc-400 font-display border-b border-zinc-100">
                  <th className="py-3 px-4">Barangay Name</th>
                  <th className="py-3 px-3 text-center">Total Registered</th>
                  <th className="py-3 px-3 text-center">Pending</th>
                  <th className="py-3 px-3 text-center">Verified</th>
                  <th className="py-3 px-3 text-center">Rejected</th>
                  <th className="py-3 px-3 text-center">No Documents</th>
                  <th className="py-3 px-3 text-center">Employed</th>
                  <th className="py-3 px-3 text-center">Available</th>
                  <th className="py-3 px-4 text-right">Employment Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {barangays.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-zinc-400 font-medium">
                      No barangays registered yet. Click &quot;Add Barangay&quot; to create one.
                    </td>
                  </tr>
                ) : (
                  barangays.map((b) => {
                    const rowStats = getBarangayRowStats(b);
                    return (
                      <tr key={b.name} className="hover:bg-zinc-50/50 transition">
                        <td className="py-3.5 px-4 font-bold font-display text-zinc-900">
                          Brgy. {b.name.replace(/^(brgy\.?|barangay)\s+/i, '').trim()}
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
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-black font-display text-zinc-900">
                            {rowStats.employmentRatio}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ---------------- ADMIN: BARANGAY DESK PROFILE ---------------- */
        <div className="bg-white rounded-3xl p-8 space-y-6">
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
      <div className="bg-white rounded-3xl p-8 space-y-6">
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#FFB380]" />
                <h3 className="text-base font-black font-display text-[#0D0D11]">
                  Add New Barangay
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddBarangay(false)}
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 font-medium">
              Select from official Philippine Standard Geographic Code (PSGC) places to avoid typos and preserve data integrity.
            </p>

            {addBrgyError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{addBrgyError}</span>
              </div>
            )}

            <form onSubmit={handleAddBarangaySubmit} className="space-y-4">
              {/* Region Select Dropdown */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-500 font-display mb-1.5">
                  Region
                </label>
                <div className="relative">
                  <select
                    value={addBrgyForm.regionCode}
                    onChange={(e) => handleRegionChange(e.target.value)}
                    disabled={loadingLocations}
                    className="w-full border border-zinc-200 rounded-2xl px-4 py-2.5 text-xs font-medium text-[#0D0D11] focus:outline-none focus:ring-2 focus:ring-[#FFB380] bg-white cursor-pointer appearance-none pr-8"
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
                  <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-500 font-display mb-1.5">
                    Province
                  </label>
                  <div className="relative">
                    <select
                      value={addBrgyForm.provinceCode}
                      onChange={(e) => handleProvinceChange(e.target.value)}
                      disabled={loadingLocations || provincesList.length === 0}
                      className="w-full border border-zinc-200 rounded-2xl px-4 py-2.5 text-xs font-medium text-[#0D0D11] focus:outline-none focus:ring-2 focus:ring-[#FFB380] bg-white cursor-pointer appearance-none pr-8 disabled:bg-zinc-50 disabled:cursor-not-allowed"
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
                  <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-500 font-display mb-1.5">
                    City / Municipality
                  </label>
                  <div className="relative">
                    <select
                      value={addBrgyForm.cityCode}
                      onChange={(e) => handleCityChange(e.target.value)}
                      disabled={loadingLocations || citiesList.length === 0}
                      className="w-full border border-zinc-200 rounded-2xl px-4 py-2.5 text-xs font-medium text-[#0D0D11] focus:outline-none focus:ring-2 focus:ring-[#FFB380] bg-white cursor-pointer appearance-none pr-8 disabled:bg-zinc-50 disabled:cursor-not-allowed"
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
                <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-500 font-display mb-1.5">
                  Barangay Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={addBrgyForm.barangayName}
                    onChange={(e) => {
                      setAddBrgyError(null);
                      setAddBrgyForm({ ...addBrgyForm, barangayName: e.target.value });
                    }}
                    disabled={loadingLocations || barangaysList.length === 0}
                    className="w-full border border-zinc-200 rounded-2xl px-4 py-2.5 text-xs font-medium text-[#0D0D11] focus:outline-none focus:ring-2 focus:ring-[#FFB380] bg-white cursor-pointer appearance-none pr-8 disabled:bg-zinc-50 disabled:cursor-not-allowed"
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
                        <option key={b.code} value={b.name} disabled={isAlreadyAdded}>
                          {b.displayName || b.name} {isAlreadyAdded ? '✓ (Already Registered)' : ''}
                        </option>
                      );
                    })}
                    <option value="__custom__">+ Other / Enter Custom Barangay</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Custom Barangay Input if '__custom__' selected */}
              {addBrgyForm.barangayName === '__custom__' && (
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-500 font-display mb-1.5">
                    Custom Barangay Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    value={addBrgyForm.customBarangayName}
                    onChange={(e) => {
                      setAddBrgyError(null);
                      setAddBrgyForm({ ...addBrgyForm, customBarangayName: e.target.value });
                    }}
                    placeholder="e.g. Upper Balulang / Sitio Zone 9"
                    autoFocus
                    className="w-full border border-orange-200 bg-orange-50/20 rounded-2xl px-4 py-2.5 text-xs font-medium text-[#0D0D11] focus:outline-none focus:ring-2 focus:ring-[#FFB380]"
                  />
                </div>
              )}

              {/* House No. / Street / Zone / Subdivision */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-500 font-display mb-1.5">
                  House No. / Street / Zone / Subdivision
                </label>
                <input
                  type="text"
                  maxLength={100}
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
                  <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-500 font-display mb-1.5">
                    Zip Code
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={addBrgyForm.zipcode}
                    onChange={(e) => setAddBrgyForm({ ...addBrgyForm, zipcode: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    placeholder="e.g. 9000"
                    className="w-full border border-zinc-200 rounded-2xl px-4 py-2.5 text-xs font-medium text-[#0D0D11] focus:outline-none focus:ring-2 focus:ring-[#FFB380]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-500 font-display mb-1.5">
                    Country
                  </label>
                  <input
                    type="text"
                    value={addBrgyForm.country}
                    readOnly
                    className="w-full border border-zinc-200 rounded-2xl px-4 py-2.5 text-xs font-medium text-zinc-700 bg-zinc-50 cursor-not-allowed focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddBarangay(false)}
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
                    <span>Add Barangay</span>
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
