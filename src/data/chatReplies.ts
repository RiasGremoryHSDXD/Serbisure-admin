import type { ChatMessage, ChatReply } from '../types/admin';

// This is the quote format already read and written by the mobile chat.
export function parseChatReply(payload?: string | null): { text: string; reply?: ChatReply } {
  const text = payload || '';
  const match = text.match(/^> \[([^\]]+)\]:\s*(.*?)\n\n([\s\S]*)$/);
  if (!match || !match[2]) return { text };
  const [author, second, third] = match[1].split('|');
  const legacyImage = second && /^(https?:\/\/|\/media\/)/i.test(second);
  return { text: match[3], reply: {
    author: author || 'User', text: match[2],
    imageUri: third !== undefined || legacyImage ? second || undefined : undefined,
    messageId: third !== undefined ? third || undefined : legacyImage ? undefined : second || undefined,
  } };
}

export function makeChatReply(message: ChatMessage, author: string, isSelf = false): ChatReply {
  const text = parseChatReply(message.message_payload).text.replace(/\s+/g, ' ').trim();
  return {
    author, text: text ? text.slice(0, 75) + (text.length > 75 ? '…' : '') : message.message_type === 'image' ? '📷 Photo' : 'Message',
    imageUri: message.image_url || undefined, messageId: message.chat_message_id,
    ...(isSelf ? { isSelf: true } : {}),
  };
}

export function withChatReply(text: string, reply?: ChatReply | null): string {
  if (!reply) return text;
  const author = reply.author.replace(/[\[\]|\r\n]/g, ' ').trim() || 'User';
  const snippet = reply.text.replace(/\s+/g, ' ').trim() || 'Message';
  return `> [${author}|${reply.imageUri || ''}|${reply.messageId || ''}]: ${snippet}\n\n${text || '📷 Photo'}`;
}

export function isOutgoingChatMessage(message: ChatMessage, partnerId: string | null, account?: { id?: string; username?: string } | null): boolean {
  return Boolean((partnerId && message.receiver_id === partnerId) ||
    (account && (message.sender_id === account.id || message.sender_id === account.username)));
}

export function getReplyRelationship(currentIsMine: boolean, quotedIsMine: boolean, partnerName: string): string {
  const name = partnerName.trim() || 'User';
  if (currentIsMine) return quotedIsMine ? 'You replied to yourself' : `You replied to ${name}`;
  return quotedIsMine ? `${name} replied to you` : `${name} replied to themself`;
}
