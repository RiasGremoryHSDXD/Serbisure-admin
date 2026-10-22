import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle, 
  ChevronDown,
  MapPin, 
  RotateCw,
  MessageSquare,
  Send,
  X,
  Loader2,
  AlertCircle,
  Smile,
  Image as ImageIcon,
  ZoomIn,
  Search,
  ExternalLink,
  Lock,
  ChevronLeft
} from 'lucide-react';
import clsx from 'clsx';
import { useAdmin } from '../../context/AdminContext';
import type { AccountRole, AdminRole, UserProfile, ChatMessage, ChatReply, SocialLink } from '../../types/admin';
import { fetchChatThread, sendChatMessage, sendChatImageMessage, sendChatTyping, toggleChatReaction, deleteChatMessage } from '../../api/adminApi';
import { realtime } from '../../realtime';
import { UnreadBadge } from '../chat/UnreadBadge';
import { PresenceIndicator } from '../chat/PresenceIndicator';
import { useChatPresence } from '../../hooks/useChatPresence';
import { createChatTyping } from '../../data/chatTyping';
import { getOptimizedWebpUrl } from '../../utils/imageOptimizer';
import { useMessagingRestriction } from '../../hooks/useMessagingRestriction';
import { AccountControls } from './AccountControls';
import { MessageActions } from '../chat/MessageActions';
import { QuotedReply } from '../chat/QuotedReply';
import { RemoveMessageDialog } from '../chat/RemoveMessageDialog';
import { ChatLanguageDialog, SensitiveMessage } from '../chat/ChatLanguageDialog';
import { containsOffensiveLanguage } from '../../utils/offensiveLanguage';
import { getReplyRelationship, isOutgoingChatMessage, makeChatReply, parseChatReply, withChatReply } from '../../data/chatReplies';

function inboxRole(accountType: string): AccountRole {
  const value = accountType.toUpperCase();
  return value === 'ADMIN' ? 'SUPERADMIN' : value as AccountRole;
}

const SOCIAL_PLATFORMS: Record<string, { name: string; color: string; icon: React.ReactNode }> = {
  facebook: {
    name: 'Facebook',
    color: '#1877F2',
    icon: (
      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  instagram: {
    name: 'Instagram',
    color: '#E1306C',
    icon: (
      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
  },
  twitter: {
    name: 'X (Twitter)',
    color: '#000000',
    icon: (
      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
  x: {
    name: 'X',
    color: '#000000',
    icon: (
      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
  tiktok: {
    name: 'TikTok',
    color: '#010101',
    icon: (
      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 2.89 3.5 2.77 1.81-.02 3.29-1.43 3.36-3.24.04-3.87.01-7.75.02-11.62 0-.34.02-.68.08-1.02z"/>
      </svg>
    ),
  },
  telegram: {
    name: 'Telegram',
    color: '#2AABEE',
    icon: (
      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    ),
  },
  linkedin: {
    name: 'LinkedIn',
    color: '#0077B5',
    icon: (
      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
      </svg>
    ),
  },
  youtube: {
    name: 'YouTube',
    color: '#FF0000',
    icon: (
      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
  },
};

const getPlatformMeta = (platformKey: string, platformName?: string) => {
  const key = (platformKey || '').toLowerCase().trim();
  if (SOCIAL_PLATFORMS[key]) {
    return SOCIAL_PLATFORMS[key];
  }
  return {
    name: platformName || key || 'Social Profile',
    color: '#6B7280',
    icon: <ExternalLink className="w-4 h-4 text-white" />,
  };
};

const CHAT_EMOJIS = ['❤️', '👍', '😂', '😢', '😭', '😮', '😱', '😜', '😡'];

function formatChatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((today.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24));

    const timeStr = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    if (diffDays <= 0) return timeStr;
    if (diffDays === 1) return `Yesterday ${timeStr}`;
    if (diffDays <= 6) {
      const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
      return `${weekday} ${timeStr}`;
    }
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const day = d.getDate();
    if (d.getFullYear() === now.getFullYear()) {
      return `${month} ${day} ${timeStr}`;
    }
    return `${month} ${day}, ${d.getFullYear()} ${timeStr}`;
  } catch {
    return dateStr;
  }
}

const UserAvatar: React.FC<{
  src?: string | null;
  name?: string;
  sizeClass?: string;
  textClass?: string;
}> = ({
  src,
  name = '',
  sizeClass = 'w-12 h-12 min-w-[48px] min-h-[48px]',
  textClass = 'font-black text-sm text-zinc-600 font-display',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [src]);

  const cleanName = (name || '').trim();
  const getInitials = (n: string) => {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '??';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };
  const initials = getInitials(cleanName);
  const optimizedUrl = src ? getOptimizedWebpUrl(src, { width: 128, height: 128, crop: 'fill', quality: 'auto' }) : null;

  return (
    <div className={`${sizeClass} rounded-full overflow-hidden bg-zinc-200 flex items-center justify-center shrink-0 select-none`}>
      {optimizedUrl && !imgFailed ? (
        <img
          src={optimizedUrl}
          alt={name || 'Avatar'}
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className={textClass}>{initials}</span>
      )}
    </div>
  );
};

export const UserDirectory: React.FC = () => {
  const { users, refreshUsers, isLoadingUsers, currentRole, selectedBarangay, userBarangays, currentUser, chatInbox: inboxEntries, refreshChatInbox, requestedChatPartner, clearChatPartnerRequest } = useAdmin();
  const [activeTab, setActiveTab] = useState<AccountRole>('HOMEOWNER');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [barangayFilter, setBarangayFilter] = useState<string>('ALL');
  const [userSearch, setUserSearch] = useState<string>('');

  // Chat panel local state
  const [messageThreadUserId, setMessageThreadUserId] = useState<string | null>(null);
  const sendGuard = useRef(false);
  const removedMessages = useRef(new Set<string>());
  const messageActionsPending = useRef(new Set<string>());
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<ChatReply | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ChatMessage | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [languageWarning, setLanguageWarning] = useState<{ generation: number; send: () => void } | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const sendThread = useRef({ id: messageThreadUserId, account: currentUser?.id, generation: 0 });
  if (sendThread.current.id !== messageThreadUserId || sendThread.current.account !== currentUser?.id) {
    sendThread.current = { id: messageThreadUserId, account: currentUser?.id, generation: sendThread.current.generation + 1 };
    removedMessages.current.clear();
    messageActionsPending.current.clear();
  }
  useEffect(() => {
    setReplyingTo(null); setActionNotice(null); setPendingActions(new Set());
    setRemoveTarget(null); setRemoveError(null);
    setLanguageWarning(null);
  }, [messageThreadUserId, currentUser?.id]);
  useEffect(() => () => { sendThread.current.generation++; }, []);
  const restrictedUntil = useMessagingRestriction();
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [typingPartnerId, setTypingPartnerId] = useState<string | null>(null);
  const partnerTyping = !!messageThreadUserId && typingPartnerId === messageThreadUserId;
  const composerTyping = useRef<ReturnType<typeof createChatTyping> | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isSendingImage, setIsSendingImage] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to latest message
  useEffect(() => {
    const list = chatScrollRef.current;
    list?.scrollTo?.({ top: list.scrollHeight, behavior: 'smooth' });
  }, [chatMessages, partnerTyping]);

  useEffect(() => {
    if (!messageThreadUserId) return;
    const followKeyboard = () => {
      const list = chatScrollRef.current;
      if (list && document.activeElement === composerRef.current) list.scrollTo?.({ top: list.scrollHeight });
    };
    window.visualViewport?.addEventListener('resize', followKeyboard);
    window.addEventListener('resize', followKeyboard);
    return () => {
      window.visualViewport?.removeEventListener('resize', followKeyboard);
      window.removeEventListener('resize', followKeyboard);
    };
  }, [messageThreadUserId]);

  useEffect(() => {
    if (!messageThreadUserId || !currentUser?.id) return;
    const typing = createChatTyping(value => sendChatTyping(messageThreadUserId, value));
    composerTyping.current = typing;
    const stopWhenHidden = () => { if (document.hidden) typing.stop(); };
    document.addEventListener('visibilitychange', stopWhenHidden);
    return () => {
      typing.dispose();
      if (composerTyping.current === typing) composerTyping.current = null;
      document.removeEventListener('visibilitychange', stopWhenHidden);
    };
  }, [messageThreadUserId, currentUser?.id]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  // Only a visible, explicitly opened conversation is fetched (the backend marks it read).
  useEffect(() => {
    if (!messageThreadUserId) return;
    let active = true;
    let fetching = false;
    let queued = false;
    let typingTimer: ReturnType<typeof setTimeout> | undefined;
    setTypingPartnerId(null);
    let loaded = false;
    const sync = async () => {
      if (!active || document.hidden) return;
      if (fetching) { queued = true; return; }
      fetching = true;
      try {
        const msgs = await fetchChatThread(messageThreadUserId);
        if (!active) return;
        const visible = msgs.filter(message => !removedMessages.current.has(message.chat_message_id));
        setChatMessages(prev => JSON.stringify(prev) === JSON.stringify(visible) ? prev : visible);
        setReplyingTo(reply => reply?.messageId && !visible.some(message => message.chat_message_id === reply.messageId) ? null : reply);
        setChatError(null);
        loaded = true;
        // Re-read authoritative counts after the successful server read acknowledgement.
        void refreshChatInbox();
      } catch {
        if (active && !loaded) setChatError('Could not load messages. Please try again.');
      } finally {
        fetching = false;
        if (active) setIsChatLoading(false);
        if (active && queued) { queued = false; void sync(); }
      }
    };
    void sync();
    const offEvent = realtime.subscribe(event => {
      if (event.type === 'chat.typing' && event.partner_id === messageThreadUserId) {
        setTypingPartnerId(event.is_typing === true ? messageThreadUserId : null);
        clearTimeout(typingTimer);
        if (event.is_typing === true) typingTimer = setTimeout(() => setTypingPartnerId(null), 5000);
        return;
      }
      if (event.type === 'chat.changed' && event.partner_id === messageThreadUserId) {
        clearTimeout(typingTimer); setTypingPartnerId(null);
      }
      if (event.type === 'sync' || event.type === 'booking.changed' || (event.type === 'chat.changed' && event.partner_id === messageThreadUserId)) void sync();
    });
    const offStatus = realtime.subscribeStatus(status => {
      if (status !== 'connected') { clearTimeout(typingTimer); setTypingPartnerId(null); }
    });
    const timer = window.setInterval(() => { if (realtime.status !== 'connected') void sync(); }, 30000);
    document.addEventListener('visibilitychange', sync);
    return () => {
      active = false;
      offEvent(); offStatus(); clearTimeout(typingTimer);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [messageThreadUserId, currentUser?.id, refreshChatInbox]);

  const openThread = (userId: string) => {
    const target = users.find(u => u.id === userId);
    if (target && !canMessage(currentRole, target) && !inboxEntries.some(entry => entry.partner_id === userId)) {
      setMessageThreadUserId(null);
      return;
    }
    if (userId === messageThreadUserId) { void refreshChatInbox(); return; }
    setMessageThreadUserId(userId);
    setChatMessages([]);
    setChatError(null);
    setShowEmojiPicker(false);
    setImageFile(null);
    setImagePreviewUrl(null);
    setChatInput('');
    setIsChatLoading(true);
  };

  // Header inbox works across pages, role tabs, searches and directory filters.
  useEffect(() => {
    if (!requestedChatPartner) return;
    const target = users.find(u => u.id === requestedChatPartner.partner_id);
    const role = target?.role ?? inboxRole(requestedChatPartner.partner_account_type);
    setActiveTab(role);
    setBarangayFilter('ALL');
    setUserSearch('');
    setSelectedUserId(requestedChatPartner.partner_id);
    openThread(requestedChatPartner.partner_id);
    clearChatPartnerRequest();
    // The request object changes for every explicit selection, including the same partner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedChatPartner]);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Allowed types: JPEG, PNG, WEBP (consistent with mobile and backend)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setChatError('Only JPEG, PNG, or WEBP images are allowed.');
      return;
    }

    // 10 MB limit (consistent with backend and mobile)
    if (file.size > 10 * 1024 * 1024) {
      setChatError('Image must be smaller than 10 MB.');
      return;
    }

    setChatError(null);
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    e.target.value = '';
  };

  const handleSendImage = async (acknowledged = false) => {
    if (!messageThreadUserId || !imageFile || isSendingImage || sendGuard.current) return;
    const captionPayload = withChatReply(chatInput.trim(), replyingTo);
    if (captionPayload.length > 500) { setChatError('Message is too long. Shorten it and try again.'); return; }
    if (!acknowledged && containsOffensiveLanguage(captionPayload)) {
      setLanguageWarning({ generation: sendThread.current.generation, send: () => { void handleSendImage(true); } });
      return;
    }
    sendGuard.current = true;
    const generation = sendThread.current.generation;
    composerTyping.current?.stop();
    const fileToSend = imageFile;

    setIsSendingImage(true);
    setChatError(null);
    setActionNotice(null);
    try {
      const sent = acknowledged
        ? await sendChatImageMessage(messageThreadUserId, fileToSend, captionPayload || undefined, true)
        : await sendChatImageMessage(messageThreadUserId, fileToSend, captionPayload || undefined);
      if (generation !== sendThread.current.generation) return;
      setChatMessages((prev) => [...prev, sent]);
      void refreshChatInbox(); // Re-sort the list after a new image message is sent
      setImageFile(null);
      setImagePreviewUrl(null);
      setChatInput('');
      setReplyingTo(null);
    } catch (err: any) {
      if (generation !== sendThread.current.generation) return;
      if (err?.data?.code === 'offensive_language_warning') {
        setLanguageWarning({ generation, send: () => { void handleSendImage(true); } });
        return;
      }
      const message = err?.message || 'Could not send the image. Please try again.';
      setChatError(message);
      setActionNotice(message);
    } finally {
      sendGuard.current = false;
      setIsSendingImage(false);
    }
  };

  const handleSend = async (acknowledged = false) => {
    if (!messageThreadUserId || !chatInput.trim() || isSending || sendGuard.current) return;
    const messagePayload = withChatReply(chatInput.trim(), replyingTo);
    if (messagePayload.length > 500) { setChatError('Message is too long. Shorten it and try again.'); return; }
    if (!acknowledged && containsOffensiveLanguage(messagePayload)) {
      setLanguageWarning({ generation: sendThread.current.generation, send: () => { void handleSend(true); } });
      return;
    }
    sendGuard.current = true;
    const generation = sendThread.current.generation;
    const payload = chatInput.trim();
    composerTyping.current?.stop();
    setChatInput('');
    setIsSending(true);
    setChatError(null);
    setActionNotice(null);
    try {
      const sent = acknowledged ? await sendChatMessage(messageThreadUserId, messagePayload, true)
        : await sendChatMessage(messageThreadUserId, messagePayload);
      if (generation !== sendThread.current.generation) return;
      setChatMessages((prev) => [...prev, sent]);
      setReplyingTo(null);
      void refreshChatInbox(); // Re-sort the list after a new message is sent
    } catch (err: any) {
      if (generation !== sendThread.current.generation) return;
      if (err?.data?.code === 'offensive_language_warning') {
        setChatInput(current => current || payload);
        setLanguageWarning({ generation, send: () => { void handleSend(true); } });
        return;
      }
      const message = err?.message || 'Could not send the message. Please try again.';
      setChatError(message);
      setActionNotice(message);
      setChatInput(current => current || payload);
    } finally {
      sendGuard.current = false;
      setIsSending(false);
    }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (messageActionsPending.current.has(messageId)) return;
    messageActionsPending.current.add(messageId);
    setPendingActions(new Set(messageActionsPending.current));
    const generation = sendThread.current.generation;
    try {
      const res = await toggleChatReaction(messageId, emoji);
      if (generation !== sendThread.current.generation) return;
      if (res?.data) {
        setChatMessages((prev) =>
          prev.map((m) =>
            m.chat_message_id === messageId
              ? {
                  ...m,
                  my_reaction: res.data.my_reaction,
                  reaction_summary: res.data.reaction_counts,
                }
              : m
          )
        );
      }
    } catch {
      if (generation === sendThread.current.generation) setActionNotice('Could not update the reaction. Try again.');
    } finally {
      if (generation === sendThread.current.generation) {
        messageActionsPending.current.delete(messageId);
        setPendingActions(new Set(messageActionsPending.current));
      }
    }
  };

  const handleRemoveMessage = async (message: ChatMessage) => {
    const id = message.chat_message_id;
    if (messageActionsPending.current.has(id)) return;
    setRemoveError(null);
    messageActionsPending.current.add(id);
    setPendingActions(new Set(messageActionsPending.current));
    const generation = sendThread.current.generation;
    try {
      await deleteChatMessage(id);
      if (generation !== sendThread.current.generation) return;
      removedMessages.current.add(id);
      setChatMessages(messages => messages.filter(item => item.chat_message_id !== id));
      setReplyingTo(reply => reply?.messageId === id ? null : reply);
      setRemoveTarget(null);
      setActionNotice('Message removed for you.');
      void refreshChatInbox();
    } catch {
      if (generation === sendThread.current.generation) setRemoveError('Could not remove the message. Try again.');
    } finally {
      if (generation === sendThread.current.generation) {
        messageActionsPending.current.delete(id);
        setPendingActions(new Set(messageActionsPending.current));
      }
    }
  };

  const handleCopyMessage = async (text: string) => {
    const generation = sendThread.current.generation;
    try {
      await navigator.clipboard.writeText(text);
      if (generation === sendThread.current.generation) setActionNotice('Text copied.');
    } catch {
      if (generation === sendThread.current.generation) setActionNotice('Could not copy the text. Try again.');
    }
  };

  /**
   * RBAC: Returns true if the logged-in admin is permitted to message this user.
   * - SUPERADMIN can message anyone.
   * - ADMIN (Barangay) can only message Homeowners and Kasambahays.
   */
  function canMessage(currentRole: AdminRole, targetUser: Pick<UserProfile, 'role'>): boolean {
    if (currentRole === 'SUPERADMIN') return true;
    return targetUser.role === 'HOMEOWNER' || targetUser.role === 'KASAMBAHAY' || targetUser.role === 'SUPERADMIN';
  }

  // Helper to normalize barangay strings
  const cleanBarangayName = (name?: string) => {
    return (name || '').replace(/^(brgy\.?|barangay)\s+/i, '').trim();
  };

  // Dynamically compute all distinct barangays across registered users
  const allBarangayOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    (userBarangays || []).forEach((b) => {
      const cleaned = cleanBarangayName(b);
      if (cleaned && cleaned.toLowerCase() !== 'all' && cleaned.toLowerCase() !== 'all barangays' && cleaned.toLowerCase() !== 'unassigned') {
        const key = cleaned.toLowerCase();
        if (!map.has(key)) {
          const formatted = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
          map.set(key, formatted);
        }
      }
    });

    users.forEach((u) => {
      const cleaned = cleanBarangayName(u.barangay);
      if (cleaned && cleaned.toLowerCase() !== 'all' && cleaned.toLowerCase() !== 'all barangays' && cleaned.toLowerCase() !== 'unassigned') {
        const key = cleaned.toLowerCase();
        if (!map.has(key)) {
          const formatted = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
          map.set(key, formatted);
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [userBarangays, users]);

  const hasUnassigned = React.useMemo(() => {
    return users.some(
      (u) => u.hasLguCoverage === false || !u.barangay || cleanBarangayName(u.barangay).toLowerCase() === 'unassigned'
    );
  }, [users]);

  // Strictly scope user directory to assigned barangay if logged in as local LGU officer or unassigned perspective
  // For Barangay Admin, also include SUPERADMIN so they can contact City Administration
  const scopedUsers = (currentRole === 'ADMIN' && selectedBarangay)
    ? users.filter((u) => u.role === 'SUPERADMIN' || (u.barangay || '').toLowerCase() === selectedBarangay.toLowerCase())
    : (selectedBarangay === 'UNASSIGNED'
        ? users.filter((u) => u.hasLguCoverage === false || (u.barangay || '').toLowerCase() === 'unassigned')
        : users);

  // Barangay filter strictly for Superadmin
  const barangayScopedUsers = (currentRole === 'SUPERADMIN' && barangayFilter !== 'ALL')
    ? scopedUsers.filter((u) => {
        if (barangayFilter === 'UNASSIGNED') {
          return u.hasLguCoverage === false || !u.barangay || cleanBarangayName(u.barangay).toLowerCase() === 'unassigned';
        }
        return cleanBarangayName(u.barangay).toLowerCase() === cleanBarangayName(barangayFilter).toLowerCase();
      })
    : scopedUsers;

  // Filter out currently logged in admin so they never message themselves
  const displayableUsers = barangayScopedUsers.filter(
    (u) => u.id !== currentUser?.id && u.email !== currentUser?.email
  );

  // Filter users by active tab
  const tabUsers = displayableUsers.filter((u) => u.role === activeTab);
  
  // Client-side name search within the active tab
  const filteredUsers = userSearch.trim()
    ? tabUsers.filter((u) =>
        u.name.toLowerCase().includes(userSearch.trim().toLowerCase())
      )
    : tabUsers;

  const inboxTimeMap = React.useMemo(() => new Map(
    inboxEntries.map(entry => [entry.partner_id, Date.parse(entry.last_message_time)])
  ), [inboxEntries]);
  const inboxByPartner = React.useMemo(() => new Map(
    inboxEntries.map(entry => [entry.partner_id, entry])
  ), [inboxEntries]);
  const unreadForRole = (role: AccountRole) => inboxEntries
    .filter(entry => inboxRole(entry.partner_account_type) === role)
    .reduce((total, entry) => total + entry.unread_count, 0);

  // Sort filteredUsers: messaged users by recency desc, then un-messaged users in original order
  const sortedUsers = React.useMemo(() => {
    return [...filteredUsers].sort((a, b) => {
      const ta = inboxTimeMap.get(a.id) ?? 0;
      const tb = inboxTimeMap.get(b.id) ?? 0;
      if (ta === 0 && tb === 0) return 0;   // Both never messaged — preserve original order
      return tb - ta;                         // Most recent first
    });
  }, [filteredUsers, inboxTimeMap]);

  // Active selected user or fallback to first
  const selectedUser: UserProfile | undefined =
    messageThreadUserId ? users.find(u => u.id === messageThreadUserId) :
    filteredUsers.find((u) => u.id === selectedUserId) ||
    filteredUsers[0] ||
    tabUsers[0] ||
    barangayScopedUsers[0];

  // User corresponding to open chat thread
  const threadEntry = inboxByPartner.get(messageThreadUserId ?? '');
  const threadPartner = users.find(u => u.id === messageThreadUserId) ?? (threadEntry ? {
    name: threadEntry.partner_name, avatar: threadEntry.partner_profile_image ?? undefined,
    role: inboxRole(threadEntry.partner_account_type), barangay: undefined,
  } : undefined);
  const presence = useChatPresence(currentUser?.id ?? null, [
    ...sortedUsers.slice(0, 75).map(user => user.id),
    ...(messageThreadUserId ? [messageThreadUserId] : []),
  ]);
  const threadPresence = messageThreadUserId ? presence(messageThreadUserId) : undefined;

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 h-full w-full overflow-hidden bg-white">
      {/* Title & Filter Bar */}
      <div className={clsx('px-4 sm:px-6 py-3 sm:py-3.5 bg-white border-b border-zinc-200/80 flex-col xl:flex-row items-start xl:items-center justify-between gap-3 sm:gap-4 shrink-0', messageThreadUserId !== null ? 'hidden lg:flex' : 'flex')}>
        <div>
          <h1 className="text-xl font-black font-display text-[#0D0D11] tracking-tight">
            Users
          </h1>
          <p className="text-[11px] sm:text-xs text-zinc-500 leading-relaxed font-medium mt-0.5">
            {currentRole === 'SUPERADMIN' && barangayFilter !== 'ALL' && (
              <span className="text-zinc-700 font-bold mr-1">
                [{barangayFilter === 'UNASSIGNED' ? 'Unassigned' : `Brgy. ${barangayFilter}`}]
              </span>
            )}
            Registered homeowners and verified kasambahays directory
          </p>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_40px] lg:flex lg:flex-wrap items-center gap-2 w-full xl:w-auto lg:justify-end min-w-0">
          {/* Barangay Filter Dropdown - SUPERADMIN ONLY */}
          {currentRole === 'SUPERADMIN' && (
            <div className="relative min-w-0 col-start-1 row-start-1">
              <select
                value={barangayFilter}
                aria-label="Filter users by barangay"
                onChange={(e) => setBarangayFilter(e.target.value)}
                className="w-full lg:w-auto min-w-0 min-h-10 appearance-none bg-[#F6F5F2] hover:bg-zinc-200/70 text-zinc-800 text-xs font-bold py-2 pl-3.5 pr-8 rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FFB380]/40 border-0 transition-colors"
                title="Filter users by Barangay"
              >
                <option value="ALL">All Barangays</option>
                {allBarangayOptions.map((bgy) => (
                  <option key={bgy} value={bgy}>
                    Brgy. {bgy}
                  </option>
                ))}
                {hasUnassigned && (
                  <option value="UNASSIGNED">Unassigned / No LGU</option>
                )}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-600 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {/* Segmented Tab Switcher */}
          <div className="col-span-2 row-start-2 grid grid-cols-3 lg:flex items-stretch bg-[#EAEAE5] p-1 rounded-2xl lg:rounded-full min-w-0 max-w-full">
            <button
              onClick={() => {
                setActiveTab('HOMEOWNER');
                setMessageThreadUserId(null);
                setUserSearch('');
                const first = displayableUsers.find((u) => u.role === 'HOMEOWNER');
                if (first) setSelectedUserId(first.id);
              }}
              aria-pressed={activeTab === 'HOMEOWNER'}
              className={`inline-flex min-w-0 min-h-11 justify-center items-center flex-wrap gap-1 lg:gap-2 px-1.5 lg:px-4 py-1.5 rounded-xl lg:rounded-full text-[10px] sm:text-xs font-black font-display transition-all cursor-pointer ${
                activeTab === 'HOMEOWNER'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Homeowners <UnreadBadge count={unreadForRole('HOMEOWNER')} />
            </button>
            <button
              onClick={() => {
                setActiveTab('KASAMBAHAY');
                setMessageThreadUserId(null);
                setUserSearch('');
                const first = displayableUsers.find((u) => u.role === 'KASAMBAHAY');
                if (first) setSelectedUserId(first.id);
              }}
              aria-pressed={activeTab === 'KASAMBAHAY'}
              className={`inline-flex min-w-0 min-h-11 justify-center items-center flex-wrap gap-1 lg:gap-2 px-1.5 lg:px-4 py-1.5 rounded-xl lg:rounded-full text-[10px] sm:text-xs font-black font-display transition-all cursor-pointer ${
                activeTab === 'KASAMBAHAY'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Kasambahays <UnreadBadge count={unreadForRole('KASAMBAHAY')} />
            </button>
            {currentRole === 'SUPERADMIN' ? (
              <button
                onClick={() => {
                  setActiveTab('BARANGAY');
                  setMessageThreadUserId(null);
                  setUserSearch('');
                  const first = displayableUsers.find((u) => u.role === 'BARANGAY');
                  if (first) setSelectedUserId(first.id);
                }}
                aria-pressed={activeTab === 'BARANGAY'}
                className={`inline-flex min-w-0 min-h-11 justify-center items-center flex-wrap gap-1 lg:gap-2 px-1.5 lg:px-4 py-1.5 rounded-xl lg:rounded-full text-[10px] sm:text-xs font-black font-display transition-all cursor-pointer ${
                  activeTab === 'BARANGAY'
                    ? 'bg-white text-zinc-950 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Barangay Admins <UnreadBadge count={unreadForRole('BARANGAY')} />
              </button>
            ) : (
              <button
                onClick={() => {
                  setActiveTab('SUPERADMIN');
                  setMessageThreadUserId(null);
                  setUserSearch('');
                  const first = displayableUsers.find((u) => u.role === 'SUPERADMIN');
                  if (first) setSelectedUserId(first.id);
                }}
                aria-pressed={activeTab === 'SUPERADMIN'}
                className={`inline-flex min-w-0 min-h-11 justify-center items-center flex-wrap gap-1 lg:gap-2 px-1.5 lg:px-4 py-1.5 rounded-xl lg:rounded-full text-[10px] sm:text-xs font-black font-display transition-all cursor-pointer ${
                  activeTab === 'SUPERADMIN'
                    ? 'bg-white text-zinc-950 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                City SuperAdmin <UnreadBadge count={unreadForRole('SUPERADMIN')} />
              </button>
            )}
          </div>

          {/* Sync Refresh Button */}
          <button
            type="button"
            onClick={() => { void refreshUsers(); void refreshChatInbox(); }}
            title="Sync Users with Backend"
            aria-label="Refresh users"
            className="col-start-2 row-start-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F6F5F2] hover:bg-zinc-200/70 text-zinc-700 transition-colors cursor-pointer border-0"
          >
            <RotateCw className={`w-4 h-4 ${isLoadingUsers ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Connected Three-Zone Directory Container (30% / 40% / 30%) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-10 w-full overflow-hidden bg-white">
        {/* Zone 1: User List (col-span-3 = 30%) */}
        <div className={clsx("lg:col-span-3 flex flex-col min-h-0 min-w-0 h-full border-r border-zinc-200/80 overflow-hidden bg-white", messageThreadUserId !== null ? "hidden lg:flex" : "flex")}>
          
          {/* Search Bar */}
          <div className="px-4 py-3 border-b border-zinc-100 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                aria-label="Search users"
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  setSelectedUserId('');
                }}
                placeholder={`Search ${activeTab === 'HOMEOWNER' ? 'homeowners' : activeTab === 'KASAMBAHAY' ? 'kasambahays' : activeTab === 'BARANGAY' ? 'barangay admins' : 'superadmin'}...`}
                className="w-full bg-[#F6F5F2] text-sm text-zinc-800 placeholder-zinc-400 rounded-full pl-9 pr-8 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#FFB380]/40 transition-all font-medium"
              />
              {userSearch && (
                <button
                  type="button"
                  onClick={() => setUserSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Scrollable User List */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {isLoadingUsers ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-400 text-xs font-medium gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#FFB380]" />
                <span>Loading users directory...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-zinc-400 text-xs font-medium gap-1 px-4">
                {userSearch.trim() ? (
                  <>
                    <Search className="w-5 h-5 text-zinc-300 mb-1" />
                    <span>No users match "<strong className="text-zinc-600">{userSearch.trim()}</strong>"</span>
                    <button
                      type="button"
                      onClick={() => setUserSearch('')}
                      className="mt-2 text-[#FFB380] font-bold hover:underline cursor-pointer text-[11px]"
                    >
                      Clear search
                    </button>
                  </>
                ) : (
                  <span>No {activeTab === 'HOMEOWNER' ? 'homeowners' : activeTab === 'KASAMBAHAY' ? 'kasambahays' : activeTab === 'BARANGAY' ? 'barangay admins' : 'superadmin accounts'} found.</span>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {sortedUsers.map((user) => {
                  const isSelected = selectedUser?.id === user.id;
                  const unread = inboxByPartner.get(user.id)?.unread_count ?? 0;
                  const online = presence(user.id);
                  return (
                    <li
                      key={user.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${user.name}, ${unread} unread messages. Open conversation`}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault(); setSelectedUserId(user.id); openThread(user.id);
                        }
                      }}
                      onClick={() => {
                        setSelectedUserId(user.id);
                        if (canMessage(currentRole, user)) {
                          openThread(user.id);
                        } else {
                          setMessageThreadUserId(null);
                        }
                      }}
                      className={`flex items-center gap-3 sm:gap-3.5 px-3.5 py-3 sm:py-4 cursor-pointer transition-colors duration-100 ${
                        isSelected
                          ? 'bg-[#FFF8F4] border-l-4 border-[#FFB380]'
                          : 'hover:bg-zinc-50 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <UserAvatar
                          src={user.avatar}
                          name={user.name}
                          sizeClass="w-10 h-10 min-w-[40px] min-h-[40px] sm:w-12 sm:h-12 sm:min-w-[48px] sm:min-h-[48px]"
                          textClass="font-black text-sm text-zinc-600 font-display"
                        />
                        {online !== undefined && (
                          <span className="absolute bottom-0 right-0 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white ring-2 ring-white">
                            <PresenceIndicator online={online} compact />
                          </span>
                        )}
                      </div>

                      {/* Name + badges */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span title={user.name} className={`text-sm font-display min-w-0 [overflow-wrap:anywhere] sm:truncate text-[#0D0D11] ${isSelected || unread > 0 ? 'font-bold' : 'font-semibold'}`}>
                            {user.name}
                          </span>
                          {user.verified && (
                            <span title="Verified" role="img" aria-label="Verified" className="shrink-0">
                              <CheckCircle aria-hidden="true" className="w-3.5 h-3.5 fill-emerald-600 text-white" />
                            </span>
                          )}
                        </div>
                        {/* Last message preview */}
                        {inboxTimeMap.get(user.id) !== undefined && (
                          <p className={`text-xs truncate mt-1 leading-snug ${unread > 0 ? 'text-zinc-900 font-bold' : 'text-zinc-500 font-medium'}`}>
                            {inboxByPartner.get(user.id)?.last_message ?? ''}
                          </p>
                        )}
                      </div>
                      <UnreadBadge count={unread} />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer: result count */}
          {!isLoadingUsers && (
            <div className="px-4 py-2 border-t border-zinc-100 shrink-0 text-[10px] text-zinc-400 font-medium">
              {userSearch.trim()
                ? `${filteredUsers.length} of ${tabUsers.length} ${activeTab === 'HOMEOWNER' ? 'homeowners' : activeTab === 'KASAMBAHAY' ? 'kasambahays' : activeTab === 'BARANGAY' ? 'barangay admins' : 'superadmin accounts'}`
                : `${tabUsers.length} ${activeTab === 'HOMEOWNER' ? 'homeowners' : activeTab === 'KASAMBAHAY' ? 'kasambahays' : activeTab === 'BARANGAY' ? 'barangay admins' : 'superadmin accounts'}`}
            </div>
          )}
        </div>

        {/* Zone 2: Chat Panel (col-span-4 = 40%) */}
        <div id="admin-chat-panel" className={clsx("admin-chat-thread lg:col-span-4 flex flex-col min-h-0 min-w-0 h-full border-r border-zinc-200/80 overflow-hidden bg-white", messageThreadUserId === null ? "hidden lg:flex" : "flex")}>
          {messageThreadUserId === null ? (
            /* Chat Panel Empty State */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white">
              <div className="w-16 h-16 rounded-full bg-[#FFF4ED] text-[#FFB380] flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 fill-[#FFB380]/20" />
              </div>
              <h4 className="text-base font-black font-display text-[#0D0D11]">
                Admin Messaging
              </h4>
              <p className="text-xs text-zinc-400 font-medium mt-1 max-w-[220px]">
                Select a user from the list to start a conversation.
              </p>
            </div>
          ) : (
            /* Chat Panel Active Thread */
            <div className="flex-1 flex flex-col min-h-0 min-w-0 h-full overflow-hidden">
              {/* Header */}
              <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-zinc-100 flex items-center gap-2 sm:gap-4 shrink-0 bg-white">
                <div className="flex flex-1 items-center gap-2 sm:gap-3 min-w-0">
                  {/* Mobile Back Button to return to User List */}
                  <button
                    type="button"
                    onClick={() => setMessageThreadUserId(null)}
                    className="flex h-10 w-10 -ml-1.5 items-center justify-center rounded-full text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer lg:hidden shrink-0"
                    title="Back to users"
                    aria-label="Back to users"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <UserAvatar
                    src={threadPartner?.avatar}
                    name={threadPartner?.name || 'User'}
                    sizeClass="w-10 h-10 min-w-[40px] min-h-[40px]"
                    textClass="font-black text-xs text-zinc-600 font-display"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold font-display leading-5 text-[#0D0D11] [overflow-wrap:anywhere] sm:truncate" title={threadPartner?.name}>
                      {threadPartner?.name}
                    </h4>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0 leading-4">
                      <PresenceIndicator online={threadPresence} />
                      {threadPresence !== undefined && <span aria-hidden="true" className="h-3 w-px shrink-0 bg-zinc-200" />}
                      <span className="text-[11px] text-zinc-500 truncate">
                        {threadPartner?.role === 'SUPERADMIN'
                          ? 'City Administration'
                          : `Brgy. ${cleanBarangayName(threadPartner?.barangay) || 'General'}`}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMessageThreadUserId(null)}
                  className="hidden lg:flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-50 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 transition-colors cursor-pointer"
                  title="Close conversation"
                  aria-label="Close conversation"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Message List Area */}
              <div ref={chatScrollRef} aria-label="Conversation messages" className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain p-3 sm:p-4 space-y-3 bg-[#FAF9F6]">
                {isChatLoading ? (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-2 py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-[#FFB380]" />
                    <span className="text-xs font-medium">Loading conversation...</span>
                  </div>
                ) : (
                  <>
                    {chatError && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between text-xs text-amber-900 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="truncate">{chatError}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => messageThreadUserId && openThread(messageThreadUserId)}
                          className="px-2.5 py-1 bg-amber-200/70 hover:bg-amber-200 text-amber-950 font-bold rounded-lg cursor-pointer shrink-0 text-[11px]"
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    {chatMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center py-12">
                        <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 mb-2">
                          <MessageSquare className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-bold text-zinc-600 font-display">No messages yet. Say hello!</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">Send a direct message from SerbiSure Admin.</p>
                      </div>
                    ) : (
                      chatMessages.map((msg, index) => {
                        const isAdminMessage = (message: ChatMessage) => isOutgoingChatMessage(message, messageThreadUserId, currentUser);
                        const isMe = isAdminMessage(msg);
                        const { text: messageText, reply } = parseChatReply(msg.message_payload);
                        const quotedMessage = reply?.messageId ? chatMessages.find(message => message.chat_message_id === reply.messageId) : undefined;
                        const normalizedReplyAuthor = reply?.author.trim().toLocaleLowerCase();
                        const adminNames = [currentUser?.name, currentUser?.username].filter(Boolean).map(value => value!.trim().toLocaleLowerCase());
                        const quotedIsMe = quotedMessage ? isAdminMessage(quotedMessage)
                          : normalizedReplyAuthor === 'you' ? isMe
                            : normalizedReplyAuthor && adminNames.includes(normalizedReplyAuthor) ? true
                              : normalizedReplyAuthor === threadPartner?.name.trim().toLocaleLowerCase() ? false
                                : !isMe;
                        const replyRelationship = reply ? getReplyRelationship(isMe, quotedIsMe, threadPartner?.name || 'User') : '';
                        const nextMessage = chatMessages[index + 1];
                        const nextIsMe = nextMessage ? isAdminMessage(nextMessage) : true;
                        // Keep the avatar at the bottom of each incoming message group,
                        // while earlier bubbles reserve the same space for alignment.
                        const showIncomingAvatar = !isMe && nextIsMe;

                        // Facebook Messenger style: show centered timestamp between message clusters (gap >= 15 mins or new day)
                        const prevMsg = chatMessages[index - 1];
                        const showCenteredTimestamp = (() => {
                          if (!prevMsg) return true;
                          const prevTime = new Date(prevMsg.createdAt).getTime();
                          const currTime = new Date(msg.createdAt).getTime();
                          if (isNaN(prevTime) || isNaN(currTime)) return false;
                          const diffMinutes = Math.abs(currTime - prevTime) / (1000 * 60);
                          const prevDate = new Date(prevTime).toDateString();
                          const currDate = new Date(currTime).toDateString();
                          return diffMinutes >= 15 || prevDate !== currDate;
                        })();

                        return (
                          <React.Fragment key={msg.chat_message_id || `msg-${index}`}>
                            {/* Facebook-style Centered Timestamp */}
                            {showCenteredTimestamp && (
                              <div className="flex items-center justify-center my-3.5 w-full shrink-0">
                                <span className="text-[11px] font-medium text-zinc-400 select-none tracking-tight">
                                  {formatChatDate(msg.createdAt)}
                                </span>
                              </div>
                            )}

                            <div id={`chat-message-${msg.chat_message_id}`}
                              className={`group relative flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-2`}
                            >
                              <div className={`chat-message-row flex min-w-0 max-w-full items-end gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                {!isMe && (showIncomingAvatar ? (
                                  <UserAvatar
                                    src={threadPartner?.avatar}
                                    name={threadPartner?.name || 'User'}
                                    sizeClass="w-7 h-7 min-w-[28px] min-h-[28px]"
                                    textClass="font-black text-[10px] text-zinc-600 font-display"
                                  />
                                ) : (
                                  <span aria-hidden="true" className="w-7 h-7 min-w-[28px] shrink-0" />
                                ))}

                                {/* Bubble Container + Hover Emoji Reaction Bar */}
                                <div className={clsx('chat-message-content relative flex min-w-0 max-w-full items-center gap-1.5', isMe ? 'chat-message-content--mine flex-row-reverse' : 'flex-row')}>
                                  <SensitiveMessage key={`${currentUser?.id}-${messageThreadUserId}-${msg.chat_message_id}`} sensitive={!isMe && (!!msg.is_sensitive || containsOffensiveLanguage(msg.message_payload))}>
                                  <MessageActions mine={isMe} reaction={msg.my_reaction} hasText={!!messageText.trim()} busy={pendingActions.has(msg.chat_message_id)}
                                    disabled={pendingActions.has(msg.chat_message_id) || isSending || isSendingImage}
                                    onReact={emoji => void handleToggleReaction(msg.chat_message_id, emoji)}
                                    onReply={() => {
                                      setReplyingTo(makeChatReply(msg, isMe ? currentUser?.name || 'Admin' : threadPartner?.name || 'User', isMe));
                                      composerRef.current?.focus({ preventScroll: true });
                                    }}
                                    onRemove={() => { setRemoveError(null); setRemoveTarget(msg); }}
                                    onCopy={() => void handleCopyMessage(messageText)}>
                                  <div className={clsx('flex min-w-0 max-w-full flex-col', isMe ? 'items-end' : 'items-start')}>
                                  {reply && <QuotedReply key={`${msg.chat_message_id}-${reply.messageId}`} reply={reply} relationship={replyRelationship} mine={isMe} />}
                                  {msg.message_type === 'image' ? (
                                    /* Facebook Messenger style: Standalone borderless image without outer bubble box */
                                    <div className={`flex flex-col gap-1.5 ${isMe ? 'items-end' : 'items-start'}`}>
                                      {msg.image_url ? (
                                        <button
                                          type="button"
                                          onClick={() => setLightboxUrl(msg.image_url!)}
                                          className="chat-message-image group relative block overflow-hidden rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer focus:outline-none border border-black/5 bg-transparent p-0"
                                          title="Click to expand image"
                                        >
                                          <img
                                            src={getOptimizedWebpUrl(msg.image_url, { quality: 'auto' })}
                                            alt="Chat attachment"
                                            draggable={false}
                                            className="mx-auto w-auto h-auto max-w-full max-h-[280px] sm:max-h-[320px] rounded-2xl object-contain block"
                                            loading="lazy"
                                          />
                                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl text-white">
                                            <ZoomIn className="w-6 h-6 drop-shadow" />
                                          </div>
                                        </button>
                                      ) : (
                                        <div className="flex items-center gap-2 p-3 bg-zinc-100 rounded-2xl text-zinc-500 text-xs border border-zinc-200">
                                          <ImageIcon className="w-5 h-5 text-zinc-400 shrink-0" />
                                          <span>Image unavailable</span>
                                        </div>
                                      )}

                                      {/* Optional caption below image */}
                                      {messageText && (
                                        <div
                                          className={`max-w-full sm:max-w-[320px] rounded-2xl px-4 py-2 text-[13px] sm:text-xs leading-relaxed font-medium [overflow-wrap:anywhere] shadow-2xs ${
                                            isMe
                                              ? 'bg-[#0D0D11] text-white rounded-br-xs'
                                              : 'bg-[#F0F0EC] text-zinc-900 rounded-bl-xs'
                                          }`}
                                        >
                                          {messageText}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    /* Standard text message bubble */
                                    <div
                                      title={formatChatDate(msg.createdAt)}
                                      className={`w-fit max-w-full sm:max-w-[460px] rounded-2xl px-4 py-2.5 text-[13px] sm:text-xs leading-relaxed font-medium [overflow-wrap:anywhere] shadow-2xs ${
                                        isMe
                                          ? 'bg-[#0D0D11] text-white rounded-br-xs'
                                          : 'bg-[#F0F0EC] text-zinc-900 rounded-bl-xs'
                                      }`}
                                    >
                                      {messageText}
                                    </div>
                                  )}
                                  </div>

                                  </MessageActions>
                                  </SensitiveMessage>
                                </div>
                              </div>

                              {/* Reaction summary pills */}
                              {msg.reaction_summary && Object.values(msg.reaction_summary).some((c) => c > 0) && (
                                <div className={`flex flex-wrap gap-1 mt-1 px-1 ${isMe ? 'justify-end' : 'justify-start ml-8'}`}>
                                  {Object.entries(msg.reaction_summary).map(([rawEmoji, count]) => {
                                    if (count <= 0) return null;
                                    const cleanEmoji = rawEmoji === '\u2764' || rawEmoji.startsWith('\u2764') ? '❤️' : rawEmoji;
                                    const isMyReaction = msg.my_reaction === cleanEmoji;
                                    return (
                                      <button disabled={pendingActions.has(msg.chat_message_id)}
                                        key={rawEmoji}
                                        type="button"
                                        onClick={() => handleToggleReaction(msg.chat_message_id, cleanEmoji)}
                                        className={`text-[11px] border rounded-full px-2 py-0.5 shadow-2xs flex items-center gap-1 font-medium cursor-pointer transition-transform hover:scale-105 ${
                                          isMyReaction
                                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                                            : 'bg-white border-zinc-200 text-zinc-700'
                                        }`}
                                        title={`${isMyReaction ? 'Remove' : 'Add'} ${cleanEmoji} reaction`}
                                      >
                                        <span>{cleanEmoji}</span>
                                        <span className="text-[10px] text-zinc-500 font-bold">{count}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </React.Fragment>
                        );
                      })
                    )}
                    {partnerTyping && (
                      <div role="status" aria-live="polite" aria-label="Typing" className="flex items-end gap-1.5 py-1">
                        <UserAvatar
                          src={threadPartner?.avatar}
                          name={threadPartner?.name || 'User'}
                          sizeClass="w-7 h-7 min-w-[28px] min-h-[28px]"
                          textClass="font-black text-[10px] text-zinc-600 font-display"
                        />
                        <span aria-hidden="true" className="inline-flex gap-1 rounded-2xl bg-white px-3 py-2">
                          {[0, 1, 2].map(dot => <span key={dot} className="w-1.5 h-1.5 rounded-full bg-zinc-400 motion-safe:animate-bounce" style={{ animationDelay: `${dot * 150}ms` }} />)}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Message Input Footer - hidden while loading thread */}
              {!isChatLoading && (
                <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white border-t border-zinc-100 shrink-0">
                  {threadPartner && !canMessage(currentRole, threadPartner) ? (
                    <div className="flex items-center justify-center gap-2 py-3 px-4 bg-zinc-100 rounded-2xl text-zinc-400 text-xs font-bold select-none">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Messaging restricted</span>
                    </div>
                  ) : (
                    <>
                      {actionNotice && <div role="status" className="mb-2 flex items-center justify-between gap-2 text-xs text-zinc-600">
                        <span>{actionNotice}</span><button type="button" aria-label="Dismiss message notice" onClick={() => setActionNotice(null)} className="rounded-full p-1"><X size={14} /></button>
                      </div>}
                      {replyingTo && <div className="mb-3 flex min-w-0 items-center gap-3 px-1 pb-1" aria-label="Reply preview">
                        <div className="min-w-0 flex-1"><QuotedReply key={replyingTo.messageId} reply={replyingTo} variant="composer" author={replyingTo.isSelf ? 'Replying to yourself' : `Replying to ${replyingTo.author}`} /></div>
                        <button type="button" aria-label="Cancel reply" disabled={isSending || isSendingImage} onClick={() => setReplyingTo(null)} className="shrink-0 rounded-full p-2 text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-950 disabled:opacity-40"><X size={17} /></button>
                      </div>}
                      {/* Selected image preview */}
                      {imagePreviewUrl && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200 mb-2">
                          <img
                            src={imagePreviewUrl}
                            alt="Preview"
                            className="w-12 h-12 object-cover rounded-lg border border-zinc-200 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-zinc-700 truncate">{imageFile?.name}</p>
                            <p className="text-[10px] text-zinc-400">
                              {imageFile ? `${(imageFile.size / 1024).toFixed(1)} KB` : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setImageFile(null);
                              setImagePreviewUrl(null);
                            }}
                            className="text-zinc-400 hover:text-red-500 transition-colors shrink-0 p-1 cursor-pointer"
                            title="Remove image"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* Emoji picker panel */}
                      {showEmojiPicker && (
                        <div
                          ref={emojiPickerRef}
                          className="flex flex-wrap gap-1.5 p-2 bg-white border border-zinc-200 rounded-2xl shadow-lg mb-2"
                        >
                          {CHAT_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                const value = chatInput + emoji;
                                setChatInput(value);
                                composerTyping.current?.change(value);
                                setShowEmojiPicker(false);
                              }}
                              className="text-xl hover:scale-125 transition-transform cursor-pointer p-1 rounded-lg hover:bg-zinc-100"
                              title={`Insert ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="flex min-w-0 items-center gap-0.5 sm:gap-1.5 bg-[#F6F5F2] rounded-2xl px-2 py-1.5 focus-within:ring-2 focus-within:ring-[#FFB380]/50 transition-all">
                        {/* Emoji toggle button */}
                        <button
                          type="button"
                          onClick={() => setShowEmojiPicker((prev) => !prev)}
                          className={`flex h-10 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-lg transition-colors cursor-pointer shrink-0 ${
                            showEmojiPicker ? 'text-[#FFB380] bg-white shadow-2xs' : 'text-zinc-400 hover:text-zinc-700'
                          }`}
                          title="Insert emoji"
                        >
                          <Smile className="w-4 h-4" />
                        </button>

                        {/* Image attach button */}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isSending || isSendingImage}
                          className="flex h-10 w-9 sm:h-8 sm:w-8 items-center justify-center text-zinc-400 hover:text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
                          title="Attach image (JPEG, PNG, WEBP)"
                        >
                          <ImageIcon className="w-4 h-4" />
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={handleImageFileChange}
                        />

                        {/* Textarea */}
                        <textarea
                          ref={composerRef}
                          aria-label="Message"
                          rows={1}
                          onFocus={() => { const list = chatScrollRef.current; list?.scrollTo?.({ top: list.scrollHeight }); }}
                          value={chatInput}
                          onChange={e => {
                            setChatInput(e.target.value);
                            composerTyping.current?.change(e.target.value);
                          }}
                          onBlur={() => composerTyping.current?.stop()}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setReplyingTo(null);
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              if (!isSending && !isSendingImage) {
                                if (imageFile) {
                                  handleSendImage();
                                } else if (chatInput.trim()) {
                                  handleSend();
                                }
                              }
                            }
                          }}
                          disabled={isSending || isSendingImage}
                          placeholder={imageFile ? 'Add a caption (optional)...' : 'Write a message...'}
                          className="flex-1 min-w-0 min-h-10 bg-transparent text-base leading-5 text-zinc-900 placeholder:text-zinc-400 focus:outline-none resize-none max-h-24 py-2.5 font-medium px-1"
                        />

                        {/* Send button */}
                        <button
                          type="button"
                          onClick={() => {
                            if (imageFile) {
                              handleSendImage();
                            } else {
                              handleSend();
                            }
                          }}
                          disabled={isSending || isSendingImage || (!chatInput.trim() && !imageFile)}
                          className="w-10 h-10 sm:w-8 sm:h-8 rounded-full bg-[#0D0D11] hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center shrink-0 transition-all cursor-pointer active:scale-90"
                          title={imageFile ? 'Send image' : 'Send message'}
                        >
                          {isSending || isSendingImage ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <p className="mt-1 text-center text-[10px] text-zinc-400 sm:hidden">Swipe to reply · Hold for reactions and more</p>
                      <div className={clsx('text-[10px] text-zinc-400 text-right mt-1 px-1', !restrictedUntil && 'hidden sm:block')}>
                        {restrictedUntil ? `Messaging paused until ${new Date(restrictedUntil).toLocaleString()}. Your Barangay desk and SerbiSure Support remain available.` : 'Press Enter to send, Shift+Enter for new line'}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Zone 3: Account Details (col-span-3 = 30%) */}
        <div className="hidden lg:flex lg:col-span-3 flex-col h-full overflow-y-auto bg-white p-6 space-y-6">
          {!selectedUser ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-400 text-xs font-medium">
              Select a user to view profile details.
            </div>
          ) : (
            <>
              {/* Profile Section */}
              <div className="space-y-5">
                {/* Header: Centered Avatar, Name with Verified Badge, Address */}
                <div className="flex flex-col items-center text-center gap-2.5">
                  <UserAvatar
                    src={selectedUser.avatar}
                    name={selectedUser.name}
                    sizeClass="w-16 h-16 min-w-[64px] min-h-[64px] max-w-[64px] max-h-[64px]"
                    textClass="font-black text-lg text-zinc-600 font-display"
                  />
                  <div className="space-y-1 min-w-0 w-full">
                    <div className="flex items-center justify-center gap-1.5">
                      <h3 className="text-base font-black font-display text-[#0D0D11] tracking-tight truncate">
                        {selectedUser.name}
                      </h3>
                      {selectedUser.verified && (
                        <CheckCircle className="w-4 h-4 fill-emerald-600 text-white shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center justify-center gap-1 text-xs text-zinc-500 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-[#FFB380] shrink-0" />
                      <span className="truncate">{selectedUser.address}</span>
                    </div>
                    {selectedUser.hasLguCoverage === false && (
                      <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        No LGU Account ({selectedUser.barangay || 'Unassigned'})
                      </span>
                    )}

                    {/* Action: Message button or Locked Badge */}
                    <div className="pt-2 flex justify-center">
                      {canMessage(currentRole, selectedUser) ? (
                        <button
                          type="button"
                          onClick={() => openThread(selectedUser.id)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[#0D0D11] hover:bg-zinc-800 text-white transition-all cursor-pointer shadow-xs active:scale-95"
                          title={`Message ${selectedUser.name}`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Message</span>
                        </button>
                      ) : (
                        <div
                          className={clsx(
                            'flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold',
                            'bg-zinc-100 text-zinc-400 cursor-not-allowed select-none'
                          )}
                          title="Messaging restricted"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Messaging restricted</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {selectedUser.canManageSuspension && ['BARANGAY', 'SUPERADMIN'].includes(selectedUser.role) && <div className="flex justify-center">
                  <AccountControls key={selectedUser.id} userId={selectedUser.id} name={selectedUser.name} onSaved={() => { void refreshUsers(); }} />
                </div>}

                {/* Information Grid */}
                <div className="grid grid-cols-2 gap-y-4 gap-x-4 pt-4 border-t border-zinc-100">
                  {/* Role */}
                  <div>
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block font-display">
                      Role
                    </span>
                    <span className="text-sm font-black text-[#0D0D11] font-display mt-0.5 block">
                      {selectedUser.role === 'HOMEOWNER'
                        ? 'Homeowner'
                        : selectedUser.role === 'KASAMBAHAY'
                          ? 'Kasambahay'
                          : selectedUser.role === 'BARANGAY'
                            ? 'Barangay Officer'
                            : 'City SuperAdmin'}
                    </span>
                  </div>

                  {/* Email Address */}
                  <div>
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block font-display">
                      Email Address
                    </span>
                    <span className="text-xs font-semibold text-zinc-800 font-mono mt-0.5 block truncate" title={selectedUser.email}>
                      {selectedUser.email}
                    </span>
                  </div>

                  {/* Contact Number */}
                  <div>
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block font-display">
                      Contact Number
                    </span>
                    <span className="text-sm font-semibold text-zinc-800 mt-0.5 block">
                      {selectedUser.contactNumber}
                    </span>
                  </div>

                  {/* Member Since */}
                  <div>
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block font-display">
                      Member Since
                    </span>
                    <span className="text-sm font-semibold text-zinc-800 mt-0.5 block">
                      {selectedUser.joinedDate}
                    </span>
                  </div>

                  {/* Barangay Info */}
                  <div className="col-span-2">
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block font-display">
                      Barangay Info
                    </span>
                    <span className="text-sm font-semibold text-zinc-800 mt-0.5 block">
                      Brgy. {cleanBarangayName(selectedUser.barangay) || 'General'}{selectedUser.city ? `, ${selectedUser.city}` : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Social Media Section (Homeowner & Kasambahay) */}
              <div className="space-y-4 pt-4 border-t border-zinc-100">
                <h4 className="text-base font-black font-display text-[#0D0D11] tracking-tight">
                  Social Media
                </h4>
                {selectedUser.socialLinks && selectedUser.socialLinks.length > 0 ? (
                  <div className="space-y-2.5">
                    {selectedUser.socialLinks.map((link: SocialLink, idx: number) => {
                      const meta = getPlatformMeta(link.platform, link.platform_name);
                      const rawUrl = (link.url || '').trim();
                      const safeUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
                        ? rawUrl
                        : `https://${rawUrl}`;
                      const rawHandle = (link.handle || '').trim();
                      const displayHandle = rawHandle
                        ? (rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`)
                        : rawUrl.replace(/^https?:\/\/(www\.)?/, '');

                      return (
                        <a
                          key={`${link.platform}-${idx}`}
                          href={safeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center justify-between p-3 rounded-2xl bg-[#FAFAFA] hover:bg-zinc-100/80 border border-zinc-200/70 hover:border-zinc-300 transition-all text-left cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white shadow-xs"
                              style={{ backgroundColor: meta.color }}
                            >
                              {meta.icon}
                            </div>
                            <div className="min-w-0">
                              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block font-display">
                                {link.platform_name || meta.name}
                              </div>
                              <div className="text-xs font-bold text-[#0D0D11] truncate group-hover:text-blue-600 transition-colors font-mono">
                                {displayHandle}
                              </div>
                            </div>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-700 shrink-0 ml-2 transition-colors" />
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-5 bg-[#FAFAFA] rounded-2xl border border-zinc-200/70 text-center text-zinc-400 text-xs font-medium">
                    No social links shared.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {languageWarning && <ChatLanguageDialog mode="send" onClose={() => {
        setLanguageWarning(null); queueMicrotask(() => composerRef.current?.focus({ preventScroll: true }));
      }} onConfirm={() => {
        const warning = languageWarning; setLanguageWarning(null);
        if (warning.generation === sendThread.current.generation) warning.send();
      }} />}
      {removeTarget && <RemoveMessageDialog busy={pendingActions.has(removeTarget.chat_message_id)} error={removeError}
        onCancel={() => { setRemoveTarget(null); setRemoveError(null); }}
        onRemove={() => void handleRemoveMessage(removeTarget)} />}

      {/* Lightbox for full size image preview */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 rounded-full transition-colors cursor-pointer"
            title="Close lightbox"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={getOptimizedWebpUrl(lightboxUrl, { quality: 'auto' })}
            alt="Full size chat image"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
