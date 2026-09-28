import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle, 
  ChevronDown,
  MapPin, 
  Star,
  UserCheck,
  RotateCw,
  MessageSquare,
  Send,
  X,
  Loader2,
  AlertCircle,
  Smile,
  Image as ImageIcon,
  ZoomIn,
  Search
} from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import type { AccountRole, UserProfile, ChatMessage, ChatInboxEntry } from '../../types/admin';
import { fetchChatThread, sendChatMessage, sendChatImageMessage, markMessageRead, toggleChatReaction, fetchChatInbox } from '../../api/adminApi';
import { getOptimizedWebpUrl } from '../../utils/imageOptimizer';

const CHAT_EMOJIS = ['❤️', '👍', '😂', '😢', '😭', '😮', '😱', '😜', '😡'];
const REACTION_OPTIONS = ['❤️', '👍', '😂', '😮', '😢', '😡'];

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

export const UserDirectory: React.FC = () => {
  const { users, refreshUsers, isLoadingUsers, currentRole, selectedBarangay, userBarangays, currentUser } = useAdmin();
  const [activeTab, setActiveTab] = useState<AccountRole>('HOMEOWNER');
  const [selectedUserId, setSelectedUserId] = useState<string>('usr-homeowner-1');
  const [barangayFilter, setBarangayFilter] = useState<string>('ALL');
  const [userSearch, setUserSearch] = useState<string>('');

  // Chat panel local state
  const [messageThreadUserId, setMessageThreadUserId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isSendingImage, setIsSendingImage] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [inboxEntries, setInboxEntries] = useState<ChatInboxEntry[]>([]);
  const inboxFetchingRef = useRef(false);   // ref-based guard — never stale like state
  const localLastSeenRef = useRef<Map<string, number>>(new Map());

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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

  // Load inbox on mount, then poll every 6 s (well under the 60/min throttle).
  // Pauses automatically when the tab is hidden to avoid wasting quota.
  useEffect(() => {
    loadInbox();
    const POLL_INTERVAL_MS = 6000;
    const interval = setInterval(() => {
      if (!document.hidden) {
        loadInbox();
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openThread = async (userId: string) => {
    setMessageThreadUserId(userId);
    setChatMessages([]);
    setChatError(null);
    setShowEmojiPicker(false);
    setImageFile(null);
    setImagePreviewUrl(null);
    setChatInput('');
    setIsChatLoading(true);
    try {
      const msgs = await fetchChatThread(userId);
      setChatMessages(msgs);
      if (msgs.length > 0) {
        const latestMsg = msgs.reduce((a, b) =>
          new Date(a.createdAt).getTime() > new Date(b.createdAt).getTime() ? a : b
        );
        localLastSeenRef.current.set(userId, new Date(latestMsg.createdAt).getTime());
        setInboxEntries((prev) => [...prev]); // trigger inboxTimeMap recompute
      }
      // Mark unread messages read
      msgs
        .filter((m) => !m.is_read && m.receiver_id !== userId)
        .forEach((m) => markMessageRead(m.chat_message_id).catch(() => {}));
    } catch {
      setChatError('Could not load messages. Please try again.');
    } finally {
      setIsChatLoading(false);
    }
  };

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

  const handleSendImage = async () => {
    if (!messageThreadUserId || !imageFile || isSendingImage) return;
    const fileToSend = imageFile;
    const captionToSend = chatInput.trim();

    setIsSendingImage(true);
    setChatError(null);
    try {
      const sent = await sendChatImageMessage(messageThreadUserId, fileToSend, captionToSend || undefined);
      setChatMessages((prev) => [...prev, sent]);
      loadInbox(); // Re-sort the list after a new image message is sent
      setImageFile(null);
      setImagePreviewUrl(null);
      setChatInput('');
    } catch (err: any) {
      setChatError(err?.message || 'Failed to send image. Please retry.');
    } finally {
      setIsSendingImage(false);
    }
  };

  const handleSend = async () => {
    if (!messageThreadUserId || !chatInput.trim() || isSending) return;
    const payload = chatInput.trim();
    setChatInput('');
    setIsSending(true);
    setChatError(null);
    try {
      const sent = await sendChatMessage(messageThreadUserId, payload);
      setChatMessages((prev) => [...prev, sent]);
      loadInbox(); // Re-sort the list after a new message is sent
    } catch (err: any) {
      setChatError(err?.message || 'Failed to send message. Please retry.');
    } finally {
      setIsSending(false);
    }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    // Optimistic local state update
    setChatMessages((prev) =>
      prev.map((m) => {
        if (m.chat_message_id !== messageId) return m;
        const currentSummary = { ...(m.reaction_summary || {}) };
        const currentMy = m.my_reaction;
        let newMy: string | null = emoji;

        if (currentMy === emoji) {
          newMy = null;
          currentSummary[emoji] = Math.max(0, (currentSummary[emoji] || 1) - 1);
        } else {
          if (currentMy && currentSummary[currentMy]) {
            currentSummary[currentMy] = Math.max(0, currentSummary[currentMy] - 1);
          }
          currentSummary[emoji] = (currentSummary[emoji] || 0) + 1;
        }

        return {
          ...m,
          my_reaction: newMy,
          reaction_summary: currentSummary,
        };
      })
    );

    try {
      const res = await toggleChatReaction(messageId, emoji);
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
    } catch (err: any) {
      console.error('Failed to toggle reaction:', err);
      if (messageThreadUserId) {
        fetchChatThread(messageThreadUserId).then(setChatMessages).catch(() => {});
      }
    }
  };

  const loadInbox = async () => {
    // Use a ref so the guard is never stale between renders
    if (inboxFetchingRef.current) return;
    inboxFetchingRef.current = true;
    try {
      const entries = await fetchChatInbox();
      if (Array.isArray(entries) && entries.length > 0) {
        setInboxEntries(entries);
      }
    } catch (err: any) {
      // Inbox fetch is best-effort — fallback is local sort or original order
      console.warn('[UserDirectory] Inbox fetch failed (sort fallback active):', err?.message ?? err);
    } finally {
      inboxFetchingRef.current = false;
    }
  };

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
  const scopedUsers = (currentRole === 'ADMIN' && selectedBarangay)
    ? users.filter((u) => (u.barangay || '').toLowerCase() === selectedBarangay.toLowerCase())
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

  // Filter users by active tab
  const tabUsers = barangayScopedUsers.filter((u) => u.role === activeTab);
  
  // Client-side name search within the active tab
  const filteredUsers = userSearch.trim()
    ? tabUsers.filter((u) =>
        u.name.toLowerCase().includes(userSearch.trim().toLowerCase())
      )
    : tabUsers;

  // Build a lookup map: userId → last_message_time (ms since epoch, or 0 if no message)
  // Merges local fallback (threads opened this session) and server inbox
  const inboxTimeMap = React.useMemo(() => {
    const map = new Map<string, number>();
    // Layer 1: local fallback (from opened threads this session)
    localLastSeenRef.current.forEach((ts, uid) => map.set(uid, ts));
    // Layer 2: server inbox (overrides local if more recent)
    inboxEntries.forEach((e) => {
      const serverTs = new Date(e.last_message_time).getTime();
      const localTs = map.get(e.partner_id) ?? 0;
      map.set(e.partner_id, Math.max(serverTs, localTs));
    });
    return map;
  }, [inboxEntries]);

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
    filteredUsers.find((u) => u.id === selectedUserId) ||
    filteredUsers[0] ||
    tabUsers[0] ||
    barangayScopedUsers[0];

  // User corresponding to open chat thread
  const threadPartner = users.find((u) => u.id === messageThreadUserId) || selectedUser;

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden bg-white">
      {/* Title & Filter Bar */}
      <div className="px-6 py-3.5 bg-white border-b border-zinc-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl font-black font-display text-[#0D0D11] tracking-tight">
            Users
          </h1>
          <p className="text-xs text-zinc-400 font-medium mt-0.5">
            {currentRole === 'SUPERADMIN' && barangayFilter !== 'ALL' && (
              <span className="text-zinc-700 font-bold mr-1">
                [{barangayFilter === 'UNASSIGNED' ? 'Unassigned' : `Brgy. ${barangayFilter}`}]
              </span>
            )}
            Registered homeowners and verified kasambahays directory
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
          {/* Barangay Filter Dropdown - SUPERADMIN ONLY */}
          {currentRole === 'SUPERADMIN' && (
            <div className="relative">
              <select
                value={barangayFilter}
                onChange={(e) => setBarangayFilter(e.target.value)}
                className="appearance-none bg-[#F6F5F2] hover:bg-zinc-200/70 text-zinc-800 text-xs font-bold py-2 pl-3.5 pr-8 rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FFB380]/40 border-0 transition-colors"
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
          <div className="flex items-center bg-[#EAEAE5] p-1 rounded-full">
            <button
              onClick={() => {
                setActiveTab('HOMEOWNER');
                setMessageThreadUserId(null);
                setUserSearch('');
                const first = users.find((u) => u.role === 'HOMEOWNER');
                if (first) setSelectedUserId(first.id);
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-black font-display transition-all cursor-pointer ${
                activeTab === 'HOMEOWNER'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Homeowners
            </button>
            <button
              onClick={() => {
                setActiveTab('KASAMBAHAY');
                setMessageThreadUserId(null);
                setUserSearch('');
                const first = users.find((u) => u.role === 'KASAMBAHAY');
                if (first) setSelectedUserId(first.id);
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-black font-display transition-all cursor-pointer ${
                activeTab === 'KASAMBAHAY'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Kasambahays
            </button>
          </div>

          {/* Sync Refresh Button */}
          <button
            type="button"
            onClick={() => refreshUsers()}
            title="Sync Users with Backend"
            className="p-2 rounded-full bg-[#F6F5F2] hover:bg-zinc-200/70 text-zinc-700 transition-colors cursor-pointer border-0"
          >
            <RotateCw className={`w-4 h-4 ${isLoadingUsers ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Connected Three-Zone Directory Container (30% / 40% / 30%) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-10 w-full overflow-hidden bg-white">
        {/* Zone 1: User List (col-span-3 = 30%) */}
        <div className="lg:col-span-3 flex flex-col h-full border-r border-zinc-200/80 overflow-hidden bg-white">
          
          {/* Search Bar */}
          <div className="px-4 pt-4 pb-3 border-b border-zinc-100 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  setSelectedUserId('');
                }}
                placeholder={`Search ${activeTab === 'HOMEOWNER' ? 'homeowners' : 'kasambahays'}...`}
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
          <div className="flex-1 overflow-y-auto">
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
                  <span>No {activeTab === 'HOMEOWNER' ? 'homeowners' : 'kasambahays'} found.</span>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {sortedUsers.map((user) => {
                  const isSelected = selectedUser?.id === user.id;
                  return (
                    <li
                      key={user.id}
                      onClick={() => {
                        setSelectedUserId(user.id);
                        openThread(user.id);
                      }}
                      className={`flex items-center gap-3.5 px-3.5 py-3.5 cursor-pointer transition-colors duration-100 ${
                        isSelected
                          ? 'bg-[#FFF8F4] border-l-4 border-[#FFB380]'
                          : 'hover:bg-zinc-50 border-l-4 border-transparent'
                      }`}
                    >
                      {/* Avatar */}
                      <div className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-full overflow-hidden bg-zinc-200 flex items-center justify-center shrink-0">
                        {user.avatar ? (
                          <img
                            src={user.avatar}
                            alt={user.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <span className="font-black text-sm text-zinc-600 font-display">
                            {user.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Name + badges */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-bold font-display truncate text-[#0D0D11] ${isSelected ? 'font-black' : ''}`}>
                            {user.name}
                          </span>
                          {user.verified && (
                            <CheckCircle className="w-3.5 h-3.5 fill-emerald-600 text-white shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                            {user.role === 'HOMEOWNER' ? 'Homeowner' : 'Kasambahay'}
                          </span>
                          {user.hasLguCoverage === false && (
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0"
                              title={`No LGU Account for ${user.barangay}`}
                            >
                              No LGU
                            </span>
                          )}
                        </div>
                        {/* Last message preview */}
                        {inboxTimeMap.get(user.id) !== undefined && (
                          <p className="text-xs text-zinc-500 truncate mt-1 leading-snug font-medium">
                            {inboxEntries.find((e) => e.partner_id === user.id)?.last_message ?? ''}
                          </p>
                        )}
                      </div>
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
                ? `${filteredUsers.length} of ${tabUsers.length} ${activeTab === 'HOMEOWNER' ? 'homeowners' : 'kasambahays'}`
                : `${tabUsers.length} ${activeTab === 'HOMEOWNER' ? 'homeowners' : 'kasambahays'}`}
            </div>
          )}
        </div>

        {/* Zone 2: Chat Panel (col-span-4 = 40%) */}
        <div id="admin-chat-panel" className="lg:col-span-4 flex flex-col h-full border-r border-zinc-200/80 overflow-hidden bg-white">
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
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-white">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full overflow-hidden shrink-0 bg-zinc-200 flex items-center justify-center">
                    {threadPartner?.avatar ? (
                      <img
                        src={threadPartner.avatar}
                        alt={threadPartner.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="font-black text-xs text-zinc-600 font-display">
                        {(threadPartner?.name || 'U').slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-black font-display text-[#0D0D11] truncate">
                      {threadPartner?.name}
                    </h4>
                    <p className="text-[11px] text-zinc-400 font-medium truncate">
                      {threadPartner?.role === 'HOMEOWNER' ? 'Homeowner' : 'Kasambahay'} · Barangay {cleanBarangayName(threadPartner?.barangay) || 'General'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMessageThreadUserId(null)}
                  className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                  title="Close conversation"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Message List Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAF9F6]">
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
                        const isMe = Boolean(
                          (messageThreadUserId && msg.receiver_id === messageThreadUserId) ||
                          (currentUser?.id && (
                            (typeof msg.sender_id === 'string' && (msg.sender_id === currentUser.id || msg.sender_id === currentUser.username)) ||
                            (typeof msg.sender_id === 'object' && ((msg.sender_id as any)?.id === currentUser.id || (msg.sender_id as any)?.username === currentUser.username))
                          ))
                        );

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

                            <div
                              className={`group relative flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-2`}
                            >
                              {/* Bubble Container + Hover Emoji Reaction Bar */}
                              <div className={`relative flex items-center gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                <div
                                  title={formatChatDate(msg.createdAt)}
                                  className={`max-w-[85%] sm:max-w-[460px] rounded-2xl px-4 py-2.5 text-xs font-medium break-words shadow-2xs ${
                                    isMe
                                      ? 'bg-[#0D0D11] text-white rounded-br-xs'
                                      : 'bg-[#F0F0EC] text-zinc-900 rounded-bl-xs'
                                  }`}
                                >
                                  {msg.message_type === 'image' ? (
                                    <div className="space-y-1.5">
                                      {msg.image_url ? (
                                        <button
                                          type="button"
                                          onClick={() => setLightboxUrl(msg.image_url!)}
                                          className="group relative block overflow-hidden rounded-xl cursor-pointer focus:outline-none"
                                          title="Click to expand image"
                                        >
                                          <img
                                            src={getOptimizedWebpUrl(msg.image_url, { quality: 'auto' })}
                                            alt="Chat attachment"
                                            className="max-w-[280px] max-h-[280px] rounded-xl object-cover transition-transform duration-200 group-hover:scale-105"
                                            loading="lazy"
                                          />
                                          <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl text-white">
                                            <ZoomIn className="w-5 h-5 drop-shadow" />
                                          </div>
                                        </button>
                                      ) : (
                                        <div className="flex items-center gap-2 p-3 bg-zinc-200/50 rounded-xl text-zinc-500 text-xs">
                                          <ImageIcon className="w-5 h-5 text-zinc-400 shrink-0" />
                                          <span>Image unavailable</span>
                                        </div>
                                      )}
                                      {msg.message_payload && (
                                        <p className="text-xs break-words leading-relaxed pt-0.5">
                                          {msg.message_payload}
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    msg.message_payload
                                  )}
                                </div>

                                {/* Floating Facebook-style Emoji Reaction Bar on Hover */}
                                <div
                                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-0.5 bg-white border border-zinc-200 rounded-full px-1.5 py-0.5 shadow-md shrink-0"
                                >
                                  {REACTION_OPTIONS.map((emoji) => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() => handleToggleReaction(msg.chat_message_id, emoji)}
                                      className={`hover:scale-125 transition-transform duration-100 text-sm p-1 rounded-full cursor-pointer leading-none ${
                                        msg.my_reaction === emoji ? 'bg-blue-50 ring-1 ring-blue-300' : ''
                                      }`}
                                      title={`React ${emoji}`}
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Reaction summary pills */}
                              {msg.reaction_summary && Object.values(msg.reaction_summary).some((c) => c > 0) && (
                                <div className={`flex flex-wrap gap-1 mt-1 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                  {Object.entries(msg.reaction_summary).map(([rawEmoji, count]) => {
                                    if (count <= 0) return null;
                                    const cleanEmoji = rawEmoji === '\u2764' || rawEmoji.startsWith('\u2764') ? '❤️' : rawEmoji;
                                    const isMyReaction = msg.my_reaction === cleanEmoji;
                                    return (
                                      <button
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
                    <div ref={chatEndRef} />
                  </>
                )}
              </div>

              {/* Message Input Footer - hidden while loading thread */}
              {!isChatLoading && (
                <div className="p-3 bg-white border-t border-zinc-100 shrink-0">
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
                            setChatInput((prev) => prev + emoji);
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

                  <div className="flex items-center gap-1.5 bg-[#F6F5F2] rounded-2xl px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-[#FFB380]/50 transition-all">
                    {/* Emoji toggle button */}
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker((prev) => !prev)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
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
                      className="p-1.5 text-zinc-400 hover:text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
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
                      rows={1}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
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
                      className="flex-1 bg-transparent text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none resize-none max-h-24 py-1 font-medium px-1"
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
                      className="w-8 h-8 rounded-full bg-[#0D0D11] hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center shrink-0 transition-all cursor-pointer active:scale-90"
                      title={imageFile ? 'Send image' : 'Send message'}
                    >
                      {isSending || isSendingImage ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <div className="text-[10px] text-zinc-400 text-right mt-1 px-1">
                    Press Enter to send, Shift+Enter for new line
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Zone 3: Account Details (col-span-3 = 30%) */}
        <div className="lg:col-span-3 flex flex-col h-full overflow-y-auto bg-white p-6 space-y-6">
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
                  <div className="w-16 h-16 min-w-[64px] min-h-[64px] max-w-[64px] max-h-[64px] rounded-full overflow-hidden shrink-0 bg-zinc-200 flex items-center justify-center">
                    {selectedUser.avatar ? (
                      <img
                        src={selectedUser.avatar}
                        alt={selectedUser.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="font-black text-lg text-zinc-600 font-display">
                        {selectedUser.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
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
                  </div>
                </div>

                {/* Information Grid */}
                <div className="grid grid-cols-2 gap-y-4 gap-x-4 pt-4 border-t border-zinc-100">
                  {/* Role */}
                  <div>
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block font-display">
                      Role
                    </span>
                    <span className="text-sm font-black text-[#0D0D11] font-display mt-0.5 block">
                      {selectedUser.role === 'HOMEOWNER' ? 'Homeowner' : 'Kasambahay'}
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

              {/* Linked Kasambahays or Skills & Compliance Profile */}
              <div className="space-y-4 pt-4 border-t border-zinc-100">
                <h4 className="text-base font-black font-display text-[#0D0D11] tracking-tight">
                  {selectedUser.role === 'HOMEOWNER' ? 'Linked Kasambahays' : 'Skills & Endorsements'}
                </h4>

                {selectedUser.role === 'HOMEOWNER' ? (
                  selectedUser.linkedKasambahays && selectedUser.linkedKasambahays.length > 0 ? (
                    <div className="space-y-3">
                      {selectedUser.linkedKasambahays.map((worker) => (
                        <div
                          key={worker.id}
                          className="bg-[#FAFAFA] rounded-2xl p-4 flex items-center justify-between border border-zinc-200/70 transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full overflow-hidden shrink-0 bg-zinc-200 flex items-center justify-center">
                              {worker.avatar ? (
                                <img
                                  src={worker.avatar}
                                  alt={worker.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="font-bold text-xs text-zinc-600">
                                  {worker.name.slice(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-black font-display text-[#0D0D11] text-xs truncate">
                                  {worker.name}
                                </span>
                                {worker.verified && (
                                  <CheckCircle className="w-3.5 h-3.5 fill-emerald-600 text-white shrink-0" />
                                )}
                              </div>
                              <div className="text-[11px] text-zinc-400 font-medium truncate">
                                {worker.role}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-black font-display">
                              <Star className="w-3 h-3 fill-emerald-600 text-emerald-600" />
                              <span>{worker.rating.toFixed(1)}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('KASAMBAHAY');
                                setMessageThreadUserId(null);
                                setSelectedUserId(worker.id || 'usr-kasambahay-1');
                              }}
                              className="text-[10px] font-bold text-zinc-500 hover:text-zinc-950 transition-colors cursor-pointer"
                            >
                              View
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-5 bg-[#FAFAFA] rounded-2xl border border-zinc-200/70 text-center text-zinc-400 text-xs font-medium">
                      No active linked Kasambahay contracts for this homeowner.
                    </div>
                  )
                ) : (
                  /* Kasambahay Skills & Compliance Profile */
                  <div className="bg-[#FAFAFA] rounded-2xl p-5 space-y-4 border border-zinc-200/70">
                    <div className="flex flex-wrap gap-2">
                      {selectedUser.skills && selectedUser.skills.length > 0 ? (
                        selectedUser.skills.map((skill) => (
                          <span
                            key={skill}
                            className="px-3 py-1 bg-white text-zinc-800 text-xs font-bold font-display rounded-full border border-zinc-200/60"
                          >
                            {skill}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-zinc-400 font-medium">No specific skills listed.</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 p-3.5 rounded-2xl">
                      <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>RA 10361 Batas Kasambahay Minimum Wage & Benefit Compliant</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

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
