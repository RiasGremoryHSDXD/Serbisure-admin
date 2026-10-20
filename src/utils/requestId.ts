/** UUID v4 for request deduplication on HTTPS, localhost, and HTTP LAN browsers. */
export function createRequestId(): string {
  const provider = globalThis.crypto;
  if (typeof provider?.randomUUID === 'function') return provider.randomUUID();
  // getRandomValues remains available on HTTP LAN origins where randomUUID is not.
  if (typeof provider?.getRandomValues !== 'function') {
    throw new Error('Your browser could not prepare the message. Refresh the page and try again.');
  }
  const bytes = provider.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
