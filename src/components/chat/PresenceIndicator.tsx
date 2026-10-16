import React from 'react';

export const PresenceIndicator: React.FC<{ online?: boolean; compact?: boolean }> = ({ online, compact = false }) => {
  if (online === undefined) return null;
  const label = online ? 'Active' : 'Inactive';
  return <span title={label} aria-label={label} className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-zinc-500">
    <span aria-hidden="true" className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
    {!compact && label}
  </span>;
};
