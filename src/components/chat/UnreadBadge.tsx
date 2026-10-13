import React from 'react';
import { badgeCount, messageCountLabel } from '../../data/chatInbox';

export const UnreadBadge: React.FC<{ count: number }> = ({ count }) => count > 0 ? (
  <span aria-label={messageCountLabel(count)} className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-orange-600 text-white text-[10px] font-extrabold shrink-0">
    {badgeCount(count)}
  </span>
) : null;
