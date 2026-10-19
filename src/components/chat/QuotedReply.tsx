import React from 'react';
import { Reply } from 'lucide-react';
import type { ChatReply } from '../../types/admin';
import { getOptimizedWebpUrl } from '../../utils/imageOptimizer';

function isGenericPhotoLabel(text: string): boolean {
  return ['photo', '📷 photo', '🖼 photo', '🖼️ photo'].includes(text.trim().toLocaleLowerCase());
}

export function QuotedReply({ reply, author, relationship, mine = false, variant = 'message' }: {
  reply: ChatReply;
  author?: string;
  relationship?: string;
  mine?: boolean;
  variant?: 'message' | 'composer';
}) {
  const [failed, setFailed] = React.useState(false);
  const photo = reply.imageUri && /^https?:\/\//i.test(reply.imageUri) && !failed;
  const photoOnly = Boolean(photo && isGenericPhotoLabel(reply.text));
  const isComposer = variant === 'composer';
  if (isComposer) return <div className="flex min-w-0 max-w-full items-center gap-3 py-1">
    {photo && <img src={getOptimizedWebpUrl(reply.imageUri!, { width: 80, height: 80, crop: 'fill' })} alt="Quoted photo" onError={() => setFailed(true)} className="h-10 w-10 shrink-0 rounded-lg object-cover" />}
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold leading-5 text-zinc-900">{author}</p>
      {!photoOnly && <p className="mt-0.5 truncate text-sm leading-5 text-zinc-500" title={reply.text}>{reply.text}</p>}
    </div>
  </div>;

  return <div className={`mb-1 flex min-w-0 max-w-full flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
    <p aria-label="Reply relationship" className={`flex max-w-full items-center gap-1 truncate text-[11px] font-medium text-zinc-500 ${mine ? 'justify-end text-right' : 'justify-start text-left'}`}>
      <Reply aria-hidden="true" className="h-3 w-3 shrink-0 fill-current" />
      <span className="truncate">{relationship}</span>
    </p>
    {photoOnly ? (
      <img src={getOptimizedWebpUrl(reply.imageUri!, { width: 180, height: 180, crop: 'fill' })} alt="Quoted photo" onError={() => setFailed(true)} className="h-20 w-20 shrink-0 rounded-2xl object-cover shadow-sm" />
    ) : (
      <div className={`flex w-fit min-w-0 max-w-full items-center gap-2 rounded-2xl bg-[#F0F0EC] px-3 py-2 text-xs text-zinc-600 ${mine ? 'rounded-br-md' : 'rounded-bl-md'}`}>
        {photo && <img src={getOptimizedWebpUrl(reply.imageUri!, { width: 80, height: 80, crop: 'fill' })} alt="Quoted photo" onError={() => setFailed(true)} className="h-9 w-9 shrink-0 rounded-lg object-cover" />}
        <p className="truncate" title={reply.text}>{reply.text}</p>
      </div>
    )}
  </div>;
}
