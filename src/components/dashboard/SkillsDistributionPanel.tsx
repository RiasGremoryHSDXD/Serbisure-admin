import React from 'react';
import { useAdmin } from '../../context/AdminContext';

export const SkillsDistributionPanel: React.FC = () => {
  const { dashboardSkills, selectedBarangay, dashboardStatsError, isLoadingDashboardStats } = useAdmin();
  return <section className="min-w-0 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-sm border border-zinc-100" aria-label="Skills & Service Distribution">
    <div className="flex flex-wrap justify-between items-start gap-3 mb-5">
      <div className="min-w-0"><h3 className="text-base sm:text-lg leading-snug font-black font-display text-zinc-950">Skills & Service Distribution</h3>
        <p className="text-xs text-zinc-500 mt-1">{selectedBarangay === 'All Barangays' ? 'City-wide' : selectedBarangay} · Verified Kasambahays</p></div>
      {dashboardSkills && <span className="text-xs font-bold rounded-full bg-orange-50 text-orange-800 px-3 py-2">{dashboardSkills.totalWorkers} verified workers</span>}
    </div>
    {dashboardStatsError ? <p role="alert" className="text-sm text-amber-800">Skills data unavailable. Use Sync Real-Time to retry.</p>
      : !dashboardSkills ? <p className="text-sm text-zinc-500">{isLoadingDashboardStats ? 'Loading skills…' : 'Skills data unavailable.'}</p>
      : <>
        {dashboardSkills.totalWorkers === 0 && <p className="text-sm text-zinc-500 mb-4">No verified workers in this area yet.</p>}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-5 sm:gap-x-8 gap-y-4 sm:gap-y-5">{dashboardSkills.categories.map(item => {
          const label = item.category === 'Child_care' ? 'Child Care' : item.category;
          return <div key={item.category}>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-1 sm:gap-3 text-sm mb-2"><span className="font-bold text-zinc-800">{label}</span>
              <span className="text-[11px] sm:text-xs text-zinc-600">{item.count} {item.count === 1 ? 'worker' : 'workers'} ({item.percentage}%)</span></div>
            <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.percentage}
              className="h-2 rounded-full bg-zinc-100 overflow-hidden"><div className="h-full rounded-full bg-orange-400" style={{ width: `${item.percentage}%` }} /></div>
          </div>;
        })}</div>
        <p className="text-[11px] sm:text-xs leading-5 text-zinc-500 mt-4 sm:mt-5">Workers may list several services, so percentages can add up to more than 100%. All-around is counted as its own category.</p>
      </>}
  </section>;
};
