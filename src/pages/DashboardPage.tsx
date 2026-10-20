import React from 'react';
import { Users, Briefcase, UserCheck, RotateCw } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { StatCard } from '../components/dashboard/StatCard';
import { EmploymentTrendChart } from '../components/dashboard/EmploymentTrendChart';
import { VerificationStatusChart } from '../components/dashboard/VerificationStatusChart';
import { DashboardActivityTable } from '../components/dashboard/DashboardActivityTable';
import { SkillsDistributionPanel } from '../components/dashboard/SkillsDistributionPanel';

export const DashboardPage: React.FC = () => {
  const {
    currentRole,
    selectedBarangay,
    dashboardMetrics,
    dashboardStatsError,
    refreshDashboardStats,
    isLoadingDashboardStats,
  } = useAdmin();

  const isSuperadmin = currentRole === 'SUPERADMIN';
  const placeholder = dashboardStatsError ? 'Unavailable' : 'Loading…';
  const totalWorkers = dashboardMetrics?.totalWorkers ?? placeholder;
  const totalEmployed = dashboardMetrics?.totalEmployed ?? placeholder;
  const totalAvailable = dashboardMetrics?.totalAvailable ?? placeholder;


  return (
    <div className="min-w-0 space-y-4 sm:space-y-7 animate-in fade-in duration-200">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl leading-tight sm:text-3xl md:text-4xl font-black font-display text-[#0D0D11] tracking-tight">
            Kasambahay Workforce
          </h1>
          <p className="text-xs leading-5 text-zinc-500 mt-1 font-medium">
            {isSuperadmin ? 'City-wide administration across all Cagayan de Oro barangays' : `Local LGU operational jurisdiction for Brgy. ${selectedBarangay}`}
          </p>
        </div>

        <button
          onClick={() => refreshDashboardStats()}
          disabled={isLoadingDashboardStats}
          className="min-h-10 flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-zinc-100 text-zinc-700 rounded-full text-xs font-bold transition-all cursor-pointer shadow-xs self-start sm:self-auto shrink-0"
          title="Refresh real-time data from backend"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isLoadingDashboardStats ? 'animate-spin text-[#FFB380]' : 'text-zinc-500'}`} />
          <span>Sync Real-Time</span>
        </button>
      </div>

      {dashboardStatsError && <div role="alert" className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">{dashboardStatsError}</div>}

      {/* Top 3 Stat Cards (SerbiSure Pastel Bento Style) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5">
        <div className="col-span-2 sm:col-span-1">
        <StatCard
          label="TOTAL REGISTERED WORKERS"
          mobileLabel="Registered workers"
          value={totalWorkers}
          icon={Users}
          color="peach"
        />
        </div>
        <StatCard
          label="CURRENTLY EMPLOYED (OCCUPIED)"
          mobileLabel="Occupied"
          value={totalEmployed}
          icon={Briefcase}
          color="mint"
        />
        <div className="sm:col-span-2 md:col-span-1">
          <StatCard
            label="CURRENTLY AVAILABLE"
            mobileLabel="Available"
            value={totalAvailable}
            icon={UserCheck}
            color="sky"
          />
        </div>
      </div>

      <p className="text-[11px] sm:text-xs leading-5 text-zinc-500">Only workers with both NBI and Police clearances verified are counted. Occupied and Available follow the worker’s status toggle.</p>

      {/* Analytics Trends & Verification Funnel */}
      <div className="space-y-4 sm:space-y-6">
        {/* Middle Row: Employment Trends (50%) + Verification Status (50%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch">
          <div className="min-w-0 lg:col-span-6">
            <EmploymentTrendChart />
          </div>
          <div className="min-w-0 lg:col-span-6">
            <VerificationStatusChart />
          </div>
        </div>

        <SkillsDistributionPanel />
        {/* Bottom Row: Rich Activity & Statutory Compliance Table */}
        <DashboardActivityTable />
      </div>

    </div>
  );
};
