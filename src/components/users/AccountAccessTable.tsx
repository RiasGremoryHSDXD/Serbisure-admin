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
  return <div className="overflow-x-auto">
    <table className="w-full table-fixed text-left text-sm">
      <caption className="sr-only">Homeowner and Kasambahay account access</caption>
      <thead className="text-xs text-zinc-500">
        <tr>
          <th scope="col" className="w-[42%] px-5 py-3 font-semibold xl:w-[32%] sm:px-6">User</th>
          <th scope="col" className="hidden w-[23%] px-6 py-3 font-semibold xl:table-cell">Barangay</th>
          <th scope="col" className="px-3 py-3 font-semibold sm:px-6">Access</th>
          <th scope="col" className="w-28 px-3 py-3 text-right font-semibold sm:w-36 xl:w-52 sm:px-6"><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-100">
        {users.map(user => {
          const status = accountAccessStatus(user, now);
          const barangay = (user.barangay || '').replace(/^(brgy\.?|barangay)\s+/i, '').trim() || 'Unassigned';
          return <tr key={user.id} className="align-middle">
            <td className="px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="hidden sm:block"><Avatar key={user.avatar} user={user} /></div>
                <div className="min-w-0">
                  <p className="break-words font-bold text-[#0D0D11]">{user.name}</p>
                  <p className="mt-1 text-xs text-zinc-500">{user.role === 'HOMEOWNER' ? 'Homeowner' : 'Kasambahay'}</p>
                  <p className="mt-1 break-words text-xs text-zinc-500 xl:hidden">{barangay === 'Unassigned' ? barangay : `Brgy. ${barangay}`}</p>
                </div>
              </div>
            </td>
            <td className="hidden break-words px-6 py-4 text-zinc-500 xl:table-cell">{barangay === 'Unassigned' ? barangay : `Brgy. ${barangay}`}</td>
            <td className="px-3 py-4 sm:px-6">
              <span className={`inline-block rounded-2xl px-2.5 py-1.5 text-xs font-semibold ${statusStyle[status]}`}>{statusLabel[status]}</span>
              {status === 'chat_paused' && user.chatSuspendedUntil && <p className="mt-1 text-xs leading-4 text-zinc-500">Until {new Date(user.chatSuspendedUntil).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>}
            </td>
            <td className="px-3 py-4 text-right sm:px-6">
              {user.canManageSuspension ? <AccountControls userId={user.id} name={user.name} disabled={disabled} onSaved={() => onSaved(user.name)} /> : <span className="text-xs text-zinc-500">Not permitted</span>}
            </td>
          </tr>;
        })}
      </tbody>
    </table>
  </div>;
}
