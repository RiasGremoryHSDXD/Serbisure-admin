import React from 'react';
import { penaltyDate, type PenaltyRecord } from '../../data/penalties';

export function PenaltyHistoryList({ records }: { records: PenaltyRecord[] }): React.ReactElement {
  const cell = 'px-4 py-3 align-top text-sm leading-5 [overflow-wrap:anywhere]';
  return <div role="region" aria-label="Penalty adjustment history" tabIndex={0} className="max-w-full overflow-x-auto rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FFB380]">
    <table className="w-full min-w-[1050px] table-fixed text-left">
      <caption className="sr-only">Penalty adjustments with user, points, score, notes, report, administrator and date</caption>
      <colgroup>{['18%', '7%', '9%', '25%', '15%', '14%', '12%'].map((width, index) => <col key={index} style={{ width }} />)}</colgroup>
      <thead><tr className="border-b border-zinc-100 text-xs uppercase text-zinc-400">
        {['User', 'Change', 'Score', 'Reason / incident notes', 'Report / cancellation', 'Adjusted by', 'Date / period'].map(title => <th key={title} scope="col" className="px-4 py-4 font-semibold">{title}</th>)}
      </tr></thead>
      <tbody className="divide-y divide-zinc-100">{records.map(record => <tr key={record.id} className="hover:bg-zinc-50/60">
        <td className={cell}><p className="font-semibold text-zinc-950">{record.user_name}</p><p className="mt-1 text-xs text-zinc-500">{record.user_role} · {record.user_barangay || 'No barangay'}</p></td>
        <td className={cell}><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${record.points_delta > 0 ? 'bg-orange-50 text-orange-800' : 'bg-emerald-50 text-emerald-800'}`}>{record.points_delta > 0 ? '+' : ''}{record.points_delta}</span></td>
        <td className={`${cell} font-semibold text-zinc-700`}>{record.points_before} → {record.points_after}/3</td>
        <td className={`${cell} text-zinc-700`}>{record.reason.length > 160 ? <details><summary className="cursor-pointer text-xs font-semibold text-zinc-600">View full notes</summary><p className="mt-2 whitespace-pre-wrap">{record.reason}</p></details> : <p className="whitespace-pre-wrap">{record.reason}</p>}</td>
        <td className={cell}><p className={`text-xs font-semibold ${record.report_verified ? 'text-emerald-700' : 'text-zinc-500'}`}>{record.report_verified ? 'Verified report' : 'Not verified'}</p>{record.incident_reference && <p className="mt-1 text-xs text-zinc-600">{record.incident_reference}</p>}{record.booking_id_snapshot && <p className="mt-1 text-xs text-zinc-500" title={record.booking_id_snapshot}>Cancellation #{record.booking_id_snapshot.slice(0, 8)}</p>}</td>
        <td className={cell}><p className="font-medium text-zinc-800">{record.admin_name}</p><p className="mt-1 text-xs text-zinc-500">{record.admin_role}</p></td>
        <td className={cell}><p className="text-xs text-zinc-600">{penaltyDate(record.created_at)}</p><p className="mt-1 text-xs text-zinc-500">Period: {record.penalty_month.slice(0, 7)}</p></td>
      </tr>)}</tbody>
    </table>
  </div>;
}
