import React from 'react';
import { 
  LayoutDashboard, 
  CheckCircle2, 
  Users, 
  Settings, 
  LogOut,
  PanelLeft,
  PanelRight,
  X
} from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';

interface SidebarProps {
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (v: boolean) => void;
  isMobileMenuOpen?: boolean;
  setIsMobileMenuOpen?: (v: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  isSidebarCollapsed, 
  setIsSidebarCollapsed,
  isMobileMenuOpen = false,
  setIsMobileMenuOpen
}) => {
  const { currentRole, selectedBarangay, activeNav, setActiveNav, verifications, currentUser, logout } = useAdmin();

  const pendingCount = verifications.filter(v => v.status === 'PENDING / REVIEW').length;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'verifications', label: 'Verifications', icon: CheckCircle2, badge: pendingCount },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (id: string) => {
    setActiveNav(id);
    if (setIsMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <aside 
      className={`bg-white flex flex-col justify-between select-none shrink-0 overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] h-screen shadow-2xl md:shadow-none md:static md:sticky md:top-0 md:z-40 p-6 ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      } ${
        isSidebarCollapsed ? 'md:w-16 md:px-2.5 md:py-5 md:items-center' : 'md:w-68 md:p-6'
      }`}
    >
      {/* Top Section */}
      <div className="flex flex-col gap-6 w-full">
        
        {/* Toggle Button & Brand Header */}
        <div className="w-full">
          {/* Header Controls: Mobile Close Button & Desktop Collapse Toggle */}
          <div className="flex items-center justify-between md:justify-end mb-2">
            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen && setIsMobileMenuOpen(false)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer md:hidden"
              title="Close menu"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Desktop Collapse/Expand Toggle Button */}
            <div className={`hidden md:flex items-center ${isSidebarCollapsed ? 'justify-center w-full mb-1' : 'justify-end'}`}>
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                {isSidebarCollapsed ? (
                  <PanelRight className="w-4 h-4" />
                ) : (
                  <PanelLeft className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className={`flex items-center ${isSidebarCollapsed ? 'md:justify-center' : 'gap-3'} gap-3`}>
            <img 
              src="/serbisure_new_clean.png" 
              alt="SerbiSure Logo" 
              className={`${isSidebarCollapsed ? 'md:w-9 md:h-9' : 'w-10 h-10'} w-10 h-10 object-contain shrink-0`}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/serbisure-logo.png';
              }}
            />
            <div className={`min-w-0 ${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>
              <span className="text-2xl font-black font-display text-[#0D0D11] tracking-tight block leading-tight">
                Serbi<span className="text-[#FFB380]">Sure</span><span className="text-[#FFB380]">.</span>
              </span>
              <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block font-display truncate">
                {currentRole === 'SUPERADMIN' ? 'City Administration' : `Brgy. ${selectedBarangay}`}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1.5 w-full">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                title={isSidebarCollapsed ? item.label : undefined}
                className={
                  isSidebarCollapsed
                    ? `relative w-full md:w-10 md:h-10 md:rounded-full md:mx-auto flex items-center justify-between md:justify-center px-4 py-2.5 md:p-0 rounded-full text-[13px] md:text-xs font-bold font-display tracking-tight transition-all duration-150 cursor-pointer ${
                        isActive
                          ? 'bg-[#0D0D11] text-white'
                          : 'text-zinc-600 hover:bg-[#F6F5F2] hover:text-zinc-900'
                      }`
                    : `w-full flex items-center justify-between px-4 py-2.5 rounded-full text-[13px] font-bold font-display tracking-tight transition-all duration-150 cursor-pointer ${
                        isActive
                          ? 'bg-[#0D0D11] text-white'
                          : 'text-zinc-600 hover:bg-[#F6F5F2] hover:text-zinc-900'
                      }`
                }
              >
                {/* On mobile, or when expanded on desktop, show icon + label + badge */}
                <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'md:hidden' : 'flex'}`}>
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#FFB380]' : 'text-zinc-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`px-2 py-0.5 text-[11px] rounded-full font-black ${
                    isSidebarCollapsed ? 'md:hidden' : ''
                  } ${
                    isActive ? 'bg-[#FFB380] text-white' : 'bg-zinc-100 text-zinc-700'
                  }`}>
                    {item.badge}
                  </span>
                )}

                {/* Desktop collapsed icon-only view */}
                {isSidebarCollapsed && (
                  <div className="relative hidden md:flex items-center justify-center">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#FFB380]' : 'text-zinc-400'}`} />
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-[#FFB380] text-white text-[9px] font-black flex items-center justify-center leading-none">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom User Profile & Logout Box */}
      <div className="pt-3 mt-2 w-full">
        {isSidebarCollapsed ? (
          <>
            {/* Desktop collapsed icon-only profile */}
            <div className="hidden md:flex flex-col items-center gap-2 p-1.5 rounded-2xl bg-[#F6F5F2]">
              <img
                src={currentUser?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"}
                alt="Admin Profile"
                title={currentUser?.name || 'Administrator'}
                className="w-9 h-9 rounded-full object-cover shrink-0"
              />
              <button
                onClick={logout}
                title="Log Out"
                className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-white rounded-full transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile full profile */}
            <div className="flex md:hidden items-center justify-between p-2.5 rounded-3xl bg-[#F6F5F2]">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={currentUser?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"}
                  alt="Admin Profile"
                  className="w-9 h-9 rounded-full object-cover shrink-0"
                />
                <div className="min-w-0 truncate">
                  <div className="text-xs font-black font-display text-zinc-900 truncate">
                    {currentUser?.name || 'Administrator'}
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate font-medium">
                    @{currentUser?.username || 'admin'}
                  </div>
                </div>
              </div>

              <button
                onClick={logout}
                title="Log Out"
                className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-white rounded-full transition-colors cursor-pointer shrink-0 ml-1"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between p-2.5 rounded-3xl bg-[#F6F5F2]">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={currentUser?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"}
                alt="Admin Profile"
                className="w-9 h-9 rounded-full object-cover shrink-0"
              />
              <div className="min-w-0 truncate">
                <div className="text-xs font-black font-display text-zinc-900 truncate">
                  {currentUser?.name || 'Administrator'}
                </div>
                <div className="text-[10px] text-zinc-400 truncate font-medium">
                  @{currentUser?.username || 'admin'}
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              title="Log Out"
              className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-white rounded-full transition-colors cursor-pointer shrink-0 ml-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
