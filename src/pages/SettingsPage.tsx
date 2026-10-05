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
import type { BarangayDeskProfile, BarangayStats } from '../types/admin';
import { 
  changePasswordApi, 
  fetchDeskProfileApi, 
  updateDeskProfileApi,
  fetchDashboardStats
} from '../api/adminApi';

export const SettingsPage: React.FC = () => {
  const { currentRole, currentUser, selectedBarangay, barangays, addBarangay, verifications, users } = useAdmin();

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
  // Add Barangay Modal State (Superadmin only)
  // ---------------------------------------------------------
  const [showAddBarangay, setShowAddBarangay] = useState(false);
  const [addBrgyForm, setAddBrgyForm] = useState({ name: '', status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' });
  const [addBrgyError, setAddBrgyError] = useState<string | null>(null);

  // ---------------------------------------------------------
  // Live Barangay Metrics (Workforce + Verification Breakdown)
  // ---------------------------------------------------------
  const [liveBarangayStats, setLiveBarangayStats] = useState<Record<string, BarangayStats>>({});
  const isSuperAdmin = currentRole === 'SUPERADMIN';

  useEffect(() => {
    if (isSuperAdmin) {
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
    }
  }, [isSuperAdmin]);

  const getBarangayRowStats = (b: BarangayStats) => {
    const key = b.name.toLowerCase();
    const live = liveBarangayStats[key];

    if (live && live.totalRegistered !== undefined) {
      return {
        totalRegistered: live.totalRegistered,
        pending: live.pending ?? 0,
        verified: live.verified ?? 0,
        rejected: live.rejected ?? 0,
        noDocuments: live.noDocuments ?? 0,
        employed: live.employed ?? 0,
        available: live.available ?? 0,
        employmentRatio: live.employmentRatio ?? 0,
      };
    }

    if (b.totalRegistered !== undefined) {
      return {
        totalRegistered: b.totalRegistered,
        pending: b.pending ?? 0,
        verified: b.verified ?? 0,
        rejected: b.rejected ?? 0,
        noDocuments: b.noDocuments ?? 0,
        employed: b.employed ?? 0,
        available: b.available ?? 0,
        employmentRatio: b.employmentRatio ?? 0,
      };
    }

    // Dynamic fallback computation from verifications & users arrays in AdminContext
    const cleanName = b.name.replace(/^(brgy\.?|barangay)\s+/i, '').trim().toLowerCase();
    const bVerifs = verifications.filter((v) => {
      const vBgy = (v.barangay || '').replace(/^(brgy\.?|barangay)\s+/i, '').trim().toLowerCase();
      return vBgy === cleanName || vBgy.includes(cleanName);
    });
    const bUsers = users.filter((u) => {
      const uBgy = (u.barangay || '').replace(/^(brgy\.?|barangay)\s+/i, '').trim().toLowerCase();
      return uBgy === cleanName || uBgy.includes(cleanName);
    });

    const pending = bVerifs.filter((v) => v.status === 'PENDING / REVIEW').length;
    const verified = bVerifs.filter((v) => v.status === 'VERIFIED').length;
    const rejected = bVerifs.filter((v) => v.status === 'REJECTED').length;
    const noDocuments = bVerifs.filter((v) => v.status === 'NO_DOCUMENTS').length;
    const totalRegistered = Math.max(bUsers.length, bVerifs.length, b.totalWorkers);

    const bKasambahays = bUsers.filter((u) => u.role === 'KASAMBAHAY');
    const totalWorkers = b.totalWorkers > 0 ? b.totalWorkers : bKasambahays.length;
    const employed = b.employed > 0 ? b.employed : 0;
    const available = b.available > 0 ? b.available : Math.max(0, totalWorkers - employed);
    const employmentRatio = b.employmentRatio > 0 ? b.employmentRatio : (totalWorkers > 0 ? Math.round((employed / totalWorkers) * 100) : 0);

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
        setDeskError(res.error);
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
      setDeskError(err instanceof Error ? err.message : 'Failed to save desk profile to database. Please check your connection.');
    } finally {
      setDeskLoading(false);
    }
  };

  const handleAddBarangaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = addBrgyForm.name.trim();
    if (!trimmed) {
      setAddBrgyError('Barangay name is required.');
      return;
    }

    const duplicate = barangays.some((b) => b.name.toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      setAddBrgyError(`Barangay "${trimmed}" is already registered in the directory.`);
      return;
    }

    addBarangay({
      name: trimmed,
      totalWorkers: 0,
      employed: 0,
      available: 0,
      employmentRatio: 0,
      status: addBrgyForm.status,
    });

    setAddBrgyForm({ name: '', status: 'ACTIVE' });
    setAddBrgyError(null);
    setShowAddBarangay(false);
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
                setAddBrgyForm({ name: '', status: 'ACTIVE' });
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
                          Brgy. {b.name}
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
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5"
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
              Register a new administrative barangay jurisdiction for local Kasambahay coverage.
            </p>

            {addBrgyError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{addBrgyError}</span>
              </div>
            )}

            <form onSubmit={handleAddBarangaySubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-500 font-display mb-1.5">
                  Barangay Name
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={addBrgyForm.name}
                  onChange={(e) => {
                    setAddBrgyError(null);
                    setAddBrgyForm({ ...addBrgyForm, name: e.target.value });
                  }}
                  placeholder="e.g. Macasandig"
                  autoFocus
                  className="w-full border border-zinc-200 rounded-2xl px-4 py-2.5 text-xs font-medium text-[#0D0D11] focus:outline-none focus:ring-2 focus:ring-[#FFB380]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-500 font-display mb-1.5">
                  Jurisdiction Status
                </label>
                <select
                  value={addBrgyForm.status}
                  onChange={(e) =>
                    setAddBrgyForm({
                      ...addBrgyForm,
                      status: e.target.value as 'ACTIVE' | 'INACTIVE',
                    })
                  }
                  className="w-full border border-zinc-200 rounded-2xl px-4 py-2.5 text-xs font-medium text-[#0D0D11] focus:outline-none focus:ring-2 focus:ring-[#FFB380] bg-white cursor-pointer"
                >
                  <option value="ACTIVE">ACTIVE (Operational LGU Desk)</option>
                  <option value="INACTIVE">INACTIVE (Coverage Pending)</option>
                </select>
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
                  className="px-5 py-2 rounded-full bg-[#0D0D11] hover:bg-black text-white text-xs font-black font-display cursor-pointer transition shadow-sm"
                >
                  Add Barangay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
