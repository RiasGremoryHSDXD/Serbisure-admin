import React from 'react';
import { Users, Briefcase, UserCheck, RotateCw } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { StatCard } from '../components/dashboard/StatCard';
import { EmploymentTrendChart } from '../components/dashboard/EmploymentTrendChart';
import { VerificationStatusChart } from '../components/dashboard/VerificationStatusChart';
import { DashboardActivityTable } from '../components/dashboard/DashboardActivityTable';
import { CITY_METRICS } from '../data/mockData';

export const DashboardPage: React.FC = () => {
  const {
    currentRole,
    selectedBarangay,
    barangays,
    dashboardMetrics,
    refreshDashboardStats,
    isLoadingDashboardStats,
  } = useAdmin();

  const activeBarangay =
    barangays.find((b) => b.name.toLowerCase() === selectedBarangay.toLowerCase()) || barangays[0];
  const isSuperadmin = currentRole === 'SUPERADMIN';

  // Real-time backend metrics take priority over static mock numbers
  const totalWorkers = dashboardMetrics
    ? dashboardMetrics.totalWorkers
    : isSuperadmin
    ? CITY_METRICS.totalWorkers
    : activeBarangay?.totalWorkers ?? 0;

  const totalEmployed = dashboardMetrics
    ? dashboardMetrics.totalEmployed
    : isSuperadmin
    ? CITY_METRICS.totalEmployed
    : activeBarangay?.employed ?? 0;

  const totalAvailable = dashboardMetrics
    ? dashboardMetrics.totalAvailable
    : isSuperadmin
    ? CITY_METRICS.totalAvailable
    : activeBarangay?.available ?? 0;


  return (
    <div className="space-y-7 animate-in fade-in duration-200">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black font-display text-[#0D0D11] tracking-tight">
            {isSuperadmin ? 'City Dashboard' : `Brgy. ${selectedBarangay} Dashboard`}
          </h1>
          <p className="text-xs text-zinc-400 mt-1 font-medium">
            {isSuperadmin ? 'City-wide administration across all Cagayan de Oro barangays' : `Local LGU operational jurisdiction for Brgy. ${selectedBarangay}`}
          </p>
        </div>

        <button
          onClick={() => refreshDashboardStats()}
          disabled={isLoadingDashboardStats}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-zinc-100 text-zinc-700 rounded-full text-xs font-bold transition-all cursor-pointer shadow-xs w-fit"
          title="Refresh real-time data from backend"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isLoadingDashboardStats ? 'animate-spin text-[#FFB380]' : 'text-zinc-500'}`} />
          <span>Sync Real-Time</span>
        </button>
      </div>

      {/* Top 3 Stat Cards (SerbiSure Pastel Bento Style) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          label="TOTAL REGISTERED WORKERS"
          value={totalWorkers}
          icon={Users}
          color="peach"
        />
        <StatCard
          label="CURRENTLY EMPLOYED"
          value={totalEmployed}
          icon={Briefcase}
          color="mint"
        />
        <StatCard
          label="CURRENTLY AVAILABLE"
          value={totalAvailable}
          icon={UserCheck}
          color="sky"
        />
      </div>

      {/* Analytics Trends & Verification Funnel */}
      <div className="space-y-6">
        {/* Middle Row: Employment Trends (50%) + Verification Status (50%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-6">
            <EmploymentTrendChart />
          </div>
          <div className="lg:col-span-6">
            <VerificationStatusChart />
          </div>
        </div>

        {/* Bottom Row: Rich Activity & Statutory Compliance Table */}
        <DashboardActivityTable />
      </div>

    </div>
  );
};
