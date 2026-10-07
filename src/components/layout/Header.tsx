import React, { useState } from 'react';
import { ChevronDown, Check, Building2, Shield, LogOut, MapPinOff, Menu } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { AdminRole } from '../../types/admin';

interface HeaderProps {
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu }) => {
  const { currentRole, setCurrentRole, selectedBarangay, setSelectedBarangay, barangays, activeNav, currentUser, logout } = useAdmin();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const toggleRole = (role: AdminRole, brgy?: string) => {
    setCurrentRole(role);
    if (brgy) {
      setSelectedBarangay(brgy);
    } else {
      setSelectedBarangay('All Barangays');
    }
    setDropdownOpen(false);
  };

  const pillLabel = currentRole === 'ADMIN'
    ? `BRGY. ${selectedBarangay}`
    : selectedBarangay === 'UNASSIGNED'
    ? 'NO LGU COVERAGE'
    : 'SUPERADMIN';

  return (
    <header className="h-16 sm:h-20 bg-white/80 backdrop-blur-md px-4 sm:px-6 md:px-8 flex items-center justify-between sticky top-0 z-30">
      {/* Page Title & Mobile Hamburger Button */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="p-1.5 sm:p-2 -ml-1 rounded-xl text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 transition-colors md:hidden cursor-pointer shrink-0"
          title="Open menu"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <span className="text-sm sm:text-base md:text-lg font-black font-display text-[#0D0D11] tracking-tight capitalize truncate">
          {activeNav === 'dashboard' ? (currentRole === 'SUPERADMIN' ? 'City Dashboard' : `Brgy. ${selectedBarangay}`) : activeNav}
        </span>
      </div>

      {/* Right Controls: Role Badge & Admin Profile */}
      <div className="flex items-center gap-2 sm:gap-3 relative shrink-0">
        {/* Interactive Role Switcher Pill */}
        <div className="relative">
          {currentUser?.role === 'SUPERADMIN' ? (
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-1.5 sm:py-2 bg-[#0D0D11] hover:bg-black text-white rounded-full text-[10px] sm:text-xs font-extrabold tracking-tight transition-all cursor-pointer"
              title="Click to switch perspective / jurisdiction"
            >
              {selectedBarangay === 'UNASSIGNED' ? (
                <MapPinOff className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-amber-400 shrink-0" />
              ) : (
                <Shield className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-[#FFB380] shrink-0" />
              )}
              <span className="font-display font-black tracking-wider uppercase text-[10px] sm:text-[11px] truncate max-w-[110px] sm:max-w-none">
                {pillLabel}
              </span>
              <ChevronDown className={`w-3 sm:w-3.5 h-3 sm:h-3.5 text-zinc-400 transition-transform shrink-0 ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
          ) : (
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-[#F0F0EC] hover:bg-[#EAEAE5] text-zinc-800 rounded-full text-[10px] sm:text-xs font-bold tracking-tight transition-all cursor-pointer"
              title={`Authorized LGU Officer of Brgy. ${currentUser?.barangay || selectedBarangay}`}
            >
              <Building2 className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-[#FFB380] shrink-0" />
              <span className="font-display font-black tracking-wider uppercase text-[10px] sm:text-[11px] truncate max-w-[110px] sm:max-w-none">
                Brgy. {currentUser?.barangay || selectedBarangay}
              </span>
              <ChevronDown className={`w-3 sm:w-3.5 h-3 sm:h-3.5 text-zinc-400 transition-transform shrink-0 ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
          )}

          {/* Role Switching Dropdown Modal */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-3 w-72 max-w-[calc(100vw-1.5rem)] bg-white rounded-3xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150 ring-1 ring-black/5 shadow-xl">
              <div className="px-3 py-2.5 mb-1 bg-[#F6F5F2] rounded-2xl">
                <div className="text-xs font-black font-display text-zinc-900">{currentUser?.name || 'Administrator'}</div>
                <div className="text-[11px] text-zinc-500 font-medium">
                  @{currentUser?.username || 'admin'} • {currentUser?.role === 'SUPERADMIN' ? 'Superadmin' : 'LGU Officer'}
                </div>
                {currentUser?.role === 'ADMIN' && (
                  <div className="mt-2 text-[11px] text-[#FFB380] bg-[#FFB380]/10 px-2.5 py-1 rounded-full font-bold w-fit">
                    Brgy. {currentUser.barangay}
                  </div>
                )}
              </div>

              {/* Only Superadmin can switch perspective */}
              {currentUser?.role === 'SUPERADMIN' && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-black text-zinc-400 uppercase tracking-wider font-display">
                    Switch Perspective
                  </div>
                  
                  {/* Superadmin Citywide */}
                  <button
                    onClick={() => toggleRole('SUPERADMIN', 'All Barangays')}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-left text-xs font-bold transition-all cursor-pointer ${
                      currentRole === 'SUPERADMIN' && selectedBarangay === 'All Barangays' ? 'bg-[#0D0D11] text-white' : 'text-zinc-700 hover:bg-[#F6F5F2]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Shield className={`w-4 h-4 ${currentRole === 'SUPERADMIN' && selectedBarangay === 'All Barangays' ? 'text-[#FFB380]' : 'text-zinc-400'}`} />
                      <div>
                        <span className="font-extrabold font-display">Superadmin</span>
                        <div className="text-[10px] text-zinc-400 font-normal">All Barangays Citywide</div>
                      </div>
                    </div>
                    {currentRole === 'SUPERADMIN' && selectedBarangay === 'All Barangays' && <Check className="w-4 h-4 text-[#FFB380]" />}
                  </button>

                  {/* Unassigned / Inactive Barangays */}
                  <button
                    onClick={() => toggleRole('SUPERADMIN', 'UNASSIGNED')}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-left text-xs font-bold transition-all cursor-pointer mt-1 ${
                      currentRole === 'SUPERADMIN' && selectedBarangay === 'UNASSIGNED' ? 'bg-[#0D0D11] text-white' : 'text-zinc-700 hover:bg-[#F6F5F2]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <MapPinOff className={`w-4 h-4 ${currentRole === 'SUPERADMIN' && selectedBarangay === 'UNASSIGNED' ? 'text-[#FFB380]' : 'text-amber-500'}`} />
                      <div>
                        <span className="font-extrabold font-display">No LGU Coverage</span>
                        <div className="text-[10px] text-zinc-400 font-normal">Unassigned / Inactive Barangays</div>
                      </div>
                    </div>
                    {currentRole === 'SUPERADMIN' && selectedBarangay === 'UNASSIGNED' && <Check className="w-4 h-4 text-[#FFB380]" />}
                  </button>

                  <div className="my-1.5 border-t border-zinc-100" />
                  <div className="px-3 py-1.5 text-[10px] font-black text-zinc-400 uppercase tracking-wider font-display">
                    Active LGU Portals
                  </div>

                  {barangays.map((b) => (
                    <button
                      key={b.name}
                      onClick={() => toggleRole('ADMIN', b.name)}
                      className={`w-full flex items-center justify-between px-3.5 py-2 rounded-2xl text-left text-xs transition-all cursor-pointer ${
                        currentRole === 'ADMIN' && selectedBarangay === b.name
                          ? 'bg-[#0D0D11] text-white font-extrabold'
                          : 'text-zinc-700 hover:bg-[#F6F5F2] font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Building2 className="w-4 h-4 text-zinc-400" />
                        <span className="font-display font-bold">Brgy. {b.name}</span>
                      </div>
                      {currentRole === 'ADMIN' && selectedBarangay === b.name && (
                        <Check className="w-4 h-4 text-[#FFB380]" />
                      )}
                    </button>
                  ))}

                  <div className="my-1.5 border-t border-zinc-100" />
                </>
              )}

              <button
                onClick={() => {
                  setDropdownOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-2xl text-left text-xs font-black font-display text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-500" />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>

        {/* Admin Avatar */}
        <div className="relative group cursor-pointer" onClick={() => setDropdownOpen(!dropdownOpen)}>
          <img
            src={currentUser?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"}
            alt="Admin Profile"
            className="w-10 h-10 rounded-full object-cover transition-transform active:scale-95"
          />
        </div>
      </div>
    </header>
  );
};
