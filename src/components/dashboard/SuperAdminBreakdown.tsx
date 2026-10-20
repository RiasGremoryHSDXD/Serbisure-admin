import React, { useState } from 'react';
import { Search, Plus, X, Building2 } from 'lucide-react';
import { BarangayStats } from '../../types/admin';
import { useAdmin } from '../../context/AdminContext';

interface SuperAdminBreakdownProps {
  barangays: BarangayStats[];
}

export const SuperAdminBreakdown: React.FC<SuperAdminBreakdownProps> = ({ barangays }) => {
  const { currentRole, addBarangay } = useAdmin();
  const [filterQuery, setFilterQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newBarangayName, setNewBarangayName] = useState('');
  const [newTotalWorkers, setNewTotalWorkers] = useState('');
  const [newEmployed, setNewEmployed] = useState('');

  const isSuperadmin = currentRole === 'SUPERADMIN';

  const filteredBarangays = barangays.filter(b =>
    b.name.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const handleAddBarangaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBarangayName.trim()) return;

    const total = parseInt(newTotalWorkers) || 0;
    const emp = parseInt(newEmployed) || 0;
    const ratio = total > 0 ? Math.round((emp / total) * 100) : 0;

    const created: BarangayStats = {
      name: newBarangayName.trim(),
      totalWorkers: total,
      employed: emp,
      available: Math.max(0, total - emp),
      employmentRatio: ratio,
      status: 'ACTIVE',
    };

    addBarangay(created);
    setNewBarangayName('');
    setNewTotalWorkers('');
    setNewEmployed('');
    setIsAddModalOpen(false);
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 gap-4">
        <div>
          <h3 className="text-2xl font-black font-display text-[#0D0D11] tracking-tight">
            Barangay Directory & Stats
          </h3>
          <p className="text-xs text-zinc-400 mt-1 font-medium">
            Administrative workforce intelligence across Cagayan de Oro City
          </p>
        </div>
        
        {/* Actions Bar */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Search Barangay */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search Barangay..."
              className="w-full pl-10 pr-4 py-2 bg-[#F0F0EC] hover:bg-[#EAEAE5] focus:bg-white rounded-full text-xs font-medium text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#FFB380]/40 transition-all"
            />
          </div>

          {/* Add Barangay Button (Superadmin Only) */}
          {isSuperadmin && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-[#FFB380] hover:bg-[#F5A066] text-white rounded-full text-xs font-black font-display transition-transform active:scale-95 shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Barangay</span>
            </button>
          )}
        </div>
      </div>

      {/* Add Barangay Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-[32px] p-7 relative ring-1 ring-black/5">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute right-5 top-5 text-zinc-400 hover:text-zinc-600 p-1.5 rounded-full hover:bg-zinc-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-[#FFF4ED] text-[#FFB380] flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black font-display text-base text-[#0D0D11]">Add New Barangay</h4>
                <p className="text-[11px] text-zinc-400 font-medium">Create local LGU jurisdiction record</p>
              </div>
            </div>

            <form onSubmit={handleAddBarangaySubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-black font-display uppercase tracking-wider text-zinc-500 mb-1.5">
                  Barangay Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Macasandig"
                  value={newBarangayName}
                  onChange={(e) => setNewBarangayName(e.target.value)}
                  className="w-full px-4 py-3 bg-[#F0F0EC] hover:bg-[#EAEAE5] focus:bg-white rounded-2xl text-xs font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#FFB380]/40 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black font-display uppercase tracking-wider text-zinc-500 mb-1.5">
                    Total Workforce
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 150"
                    value={newTotalWorkers}
                    onChange={(e) => setNewTotalWorkers(e.target.value)}
                    className="w-full px-4 py-3 bg-[#F0F0EC] hover:bg-[#EAEAE5] focus:bg-white rounded-2xl text-xs font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#FFB380]/40 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black font-display uppercase tracking-wider text-zinc-500 mb-1.5">
                    Employed
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 80"
                    value={newEmployed}
                    onChange={(e) => setNewEmployed(e.target.value)}
                    className="w-full px-4 py-3 bg-[#F0F0EC] hover:bg-[#EAEAE5] focus:bg-white rounded-2xl text-xs font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#FFB380]/40 transition-all"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-2.5 text-xs font-black font-display text-zinc-500 hover:text-zinc-800 rounded-full cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#FFB380] hover:bg-[#F5A066] text-white rounded-full text-xs font-black font-display transition-transform active:scale-95 cursor-pointer"
                >
                  Save Barangay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Breakdown Table */}
      <div className="overflow-x-auto mt-2">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="text-[11px] font-black font-display uppercase tracking-wider text-zinc-400">
              <th className="py-3 px-3">Barangay Name</th>
              <th className="py-3 px-3">Total Workers</th>
              <th className="py-3 px-3">Employment Ratio</th>
              <th className="py-3 px-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="font-medium text-zinc-700">
            {filteredBarangays.map((b) => (
              <tr key={b.name} className="hover:bg-[#F6F5F2] rounded-2xl transition-colors">
                <td className="py-3.5 px-3 font-extrabold font-display text-[#0D0D11]">
                  {b.name}
                </td>
                <td className="py-3.5 px-3 font-bold font-display text-zinc-800">
                  {b.totalWorkers}
                </td>
                <td className="py-3.5 px-3">
                  <div className="flex items-center gap-3 max-w-xs">
                    {/* Dual-color Progress Bar */}
                    <div className="w-36 h-2.5 rounded-full overflow-hidden flex bg-[#F0F0EC]">
                      <div
                        className="bg-[#FFB380] h-full transition-all duration-500"
                        style={{ width: `${b.employmentRatio}%` }}
                        title={`Employed: ${b.employmentRatio}%`}
                      />
                      <div
                        className="bg-[#0D0D11] h-full transition-all duration-500"
                        style={{ width: `${100 - b.employmentRatio}%` }}
                        title={`Available: ${100 - b.employmentRatio}%`}
                      />
                    </div>
                    <span className="text-xs font-bold text-zinc-700 w-9">
                      {b.employmentRatio}%
                    </span>
                  </div>
                </td>
                <td className="py-3.5 px-3 text-right">
                  <span className="inline-flex items-center px-3.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700">
                    {b.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
