import React from 'react';
import { AlertTriangle, CheckCircle2, FileCheck, Scale } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';

export const LogisticsOverview: React.FC = () => {
  const { bookings } = useAdmin();

  return (
    <div className="space-y-8">
      {/* Compliance Overview Banner */}
      <div className="bg-white p-8 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#FFF4ED] text-[#FFB380] rounded-full text-xs font-black uppercase tracking-wider font-display">
            <Scale className="w-4 h-4" />
            <span>Republic Act No. 10361 Compliance Engine</span>
          </div>
          <h3 className="text-2xl font-black font-display text-[#0D0D11] tracking-tight">
            Logistics & Misclassification Safeguards
          </h3>
          <p className="text-xs text-zinc-500 max-w-2xl leading-relaxed font-medium">
            SerbiSure automatically enforces a hard limit of <strong>3 short-term bookings per month</strong> between any employer-worker pair to prevent statutory benefit evasion.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="p-4 bg-[#F6F5F2] rounded-2xl text-center min-w-[100px]">
            <div className="text-2xl font-black font-display text-[#FFB380]">{new Set(bookings.filter(b => b.isCapped && b.pairKey).map(b => b.pairKey)).size}</div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase font-display mt-0.5">Pairs at Limit (loaded)</div>
          </div>
          <div className="p-4 bg-[#F6F5F2] rounded-2xl text-center min-w-[100px]">
            <div className="text-2xl font-black font-display text-emerald-600">{bookings.length ? Math.round(bookings.filter(b => b.status === 'COMPLIANT').length / bookings.length * 100) + '%' : 'No data'}</div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase font-display mt-0.5">Wage Compliant</div>
          </div>
        </div>
      </div>

      {/* Bookings & Compliance Table */}
      <div className="bg-white rounded-3xl p-8 space-y-6">
        <h4 className="text-lg font-black font-display text-[#0D0D11] tracking-tight">
          Active Hiring Pipelines & Compliance Tracking
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[11px] font-black uppercase tracking-wider text-zinc-400 font-display">
                <th className="py-3 px-3">Employer & Worker</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Monthly Frequency</th>
                <th className="py-3 px-3">Wage & Baseline</th>
                <th className="py-3 px-3">Statutory Benefits</th>
                <th className="py-3 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="text-xs space-y-1">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-[#F6F5F2] transition-colors">
                  {/* Employer & Worker */}
                  <td className="py-3.5 px-3 rounded-l-2xl">
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2 overflow-hidden">
                        <img
                          src={b.homeownerAvatar}
                          alt={b.homeownerName}
                          className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover"
                          title={`Homeowner: ${b.homeownerName}`}
                        />
                        <img
                          src={b.workerAvatar}
                          alt={b.workerName}
                          className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover"
                          title={`Kasambahay: ${b.workerName}`}
                        />
                      </div>
                      <div>
                        <div className="font-black font-display text-[#0D0D11]">
                          {b.homeownerName} <span className="text-zinc-400 font-normal">→</span> {b.workerName}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-medium">
                          Started: {b.startDate}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="py-3.5 px-3 font-bold text-zinc-800">
                    <div>{b.serviceCategory}</div>
                    <span className="text-[10px] font-black font-display text-[#FFB380]">
                      {b.contractType}
                    </span>
                  </td>

                  {/* Monthly Frequency */}
                  <td className="py-3.5 px-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black font-display text-[#0D0D11]">
                          {b.monthlyBookingsCount} / 3
                        </span>
                        {b.isCapped ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-[#FFF4ED] text-[#FFB380] text-[10px] font-black font-display">
                            Capped
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                            Within Limit
                          </span>
                        )}
                      </div>
                      <div className="w-24 h-1.5 rounded-full bg-[#F0F0EC] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            b.monthlyBookingsCount >= 3 ? 'bg-[#FFB380]' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${(b.monthlyBookingsCount / 3) * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Wage & Baseline */}
                  <td className="py-3.5 px-3">
                    <div>
                      <span className="font-black font-display text-[#0D0D11]">
                        ₱{b.offeredWage.toLocaleString()}
                      </span>
                      <span className="text-zinc-400 text-[10px] font-medium">
                        {' '}/ {b.ratePeriod || (b.contractType.includes('Long-Term') ? 'month' : 'day')}
                      </span>
                    </div>
                    <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{b.rateNeedsReview ? 'Rate requires review' : b.isBelowMinimumWage ? 'Below applicable minimum' : 'Meets applicable rate minimum'}</span>
                    </div>
                  </td>

                  {/* Statutory Benefits */}
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-1.5">
                      {['SSS', 'PhilHealth', 'Pag-IBIG', '13th Mo'].map((item) => (
                        <span
                          key={item}
                          className="px-2.5 py-0.5 bg-[#F0F0EC] text-zinc-700 rounded-full text-[10px] font-bold font-display"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-3 text-right rounded-r-2xl">
                    {b.status === 'FLAGGED_THROTTLED' ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black font-display bg-[#FFF4ED] text-[#FFB380]">
                        <AlertTriangle className="w-3 h-3 text-[#FFB380]" />
                        <span>LEGACY PAIR OVER LIMIT</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black font-display bg-emerald-50 text-emerald-700">
                        <FileCheck className="w-3 h-3 text-emerald-600" />
                        <span>{b.status === 'COMPLIANT' ? 'RATE COMPLIANT' : b.status === 'BELOW_MINIMUM_WAGE' ? 'BELOW MINIMUM' : 'REQUIRES REVIEW'}</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
