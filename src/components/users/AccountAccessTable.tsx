import React, { useState } from 'react';
import { AccountControls } from './AccountControls';
import { accountAccessStatus, type AccountAccessUser, type AccessStatus } from '../../data/accountAccess';

const statusStyle: Record<AccessStatus, string> = {
  available: 'bg-emerald-50 text-emerald-700', chat_paused: 'bg-amber-50 text-amber-800',
  account_suspended: 'bg-rose-50 text-rose-700', deactivated: 'bg-zinc-100 text-zinc-600',
};
const statusLabel: Record<AccessStatus, string> = {
  available: 'Available', chat_paused: 'Messaging paused', account_suspended: 'Account suspended', deactivated: 'Deactivated',
};

function Avatar({ user }: { user: AccountAccessUser }): React.ReactElement {
  const [failed, setFailed] = useState(false);
  const initials = user.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('');
  return <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F6F5F2] text-xs font-bold text-zinc-600">
    {user.avatar && !failed ? <img src={user.avatar} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} /> : initials}
  </div>;
}

interface Props { users: AccountAccessUser[]; now: number; onSaved: (name: string) => void; disabled?: boolean }

export function AccountAccessTable({ users, now, onSaved, disabled = false }: Props): React.ReactElement {
  return <div className="overflow-x-hidden md:overflow-x-auto">
    <table className="block w-full text-left text-sm md:table md:table-fixed">
      <caption className="sr-only">Homeowner and Kasambahay account access</caption>
      <thead className="hidden text-xs text-zinc-500 md:table-header-group">
        <tr className="contents md:table-row">
          <th scope="col" className="block px-5 py-3 font-semibold md:table-cell md:w-[42%] md:px-6 xl:w-[32%]">User</th>
          <th scope="col" className="hidden w-[23%] px-6 py-3 font-semibold xl:table-cell">Barangay</th>
          <th scope="col" className="block px-3 py-3 font-semibold md:table-cell md:px-6">Access</th>
          <th scope="col" className="hidden w-28 px-3 py-3 text-right font-semibold md:table-cell md:w-48 md:px-6 xl:w-52"><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody className="block divide-y divide-zinc-100 md:table-row-group">
        {users.map(user => {
          const status = accountAccessStatus(user, now);
          const barangay = (user.barangay || '').replace(/^(brgy\.?|barangay)\s+/i, '').trim() || 'Unassigned';
          return <tr key={user.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 p-4 align-middle md:table-row md:p-0">
            <td className="col-span-2 block px-0 py-0 md:table-cell md:px-6 md:py-4">
              <div className="flex items-center gap-3">
                <Avatar key={user.avatar} user={user} />
                <div className="min-w-0">
                  <p className="[overflow-wrap:anywhere] text-sm font-bold text-[#0D0D11]">{user.name}</p>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] sm:text-xs text-zinc-500 md:block">
                    <p>{user.role === 'HOMEOWNER' ? 'Homeowner' : 'Kasambahay'}</p>
                    <p className="break-words md:mt-1 xl:hidden">{barangay === 'Unassigned' ? barangay : `Brgy. ${barangay}`}</p>
                  </div>
                </div>
              </div>
            </td>
            <td className="hidden break-words px-6 py-4 text-zinc-500 xl:table-cell">{barangay === 'Unassigned' ? barangay : `Brgy. ${barangay}`}</td>
            <td className="block min-w-0 px-0 py-0 md:table-cell md:px-6 md:py-4">
              <span className="sr-only">Access: </span>
              <span className={`inline-block rounded-full px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold ${statusStyle[status]}`}>{statusLabel[status]}</span>
              {status === 'chat_paused' && user.chatSuspendedUntil && <p className="mt-1 text-xs leading-4 text-zinc-500">Until {new Date(user.chatSuspendedUntil).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>}
            </td>
            <td className="col-span-1 flex items-end justify-end px-0 py-0 text-right md:table-cell md:px-6 md:py-4">
              {user.canManageSuspension ? <AccountControls userId={user.id} name={user.name} disabled={disabled} onSaved={() => onSaved(user.name)} /> : <span className="text-xs text-zinc-500">Not permitted</span>}
            </td>
          </tr>;
        })}
      </tbody>
    </table>
  </div>;
}
