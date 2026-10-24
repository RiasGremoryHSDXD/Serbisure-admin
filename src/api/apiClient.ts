// Hosted builds always use Railway for API requests and realtime connections.
// VITE_DEV_API_URL is an optional development-only override; restart Vite after edits.
// Legacy VITE_API_URL deployment settings are intentionally ignored.
export const RAILWAY_API_URL = 'https://serbisure-production-backend.up.railway.app';

function resolveBaseUrl(): string {
  const configured = import.meta.env.DEV && import.meta.env.VITE_DEV_API_URL;
  if (configured && /^https?:\/\//.test(configured)) return configured.replace(/\/+$/, '');
  return RAILWAY_API_URL;
}

const configuredBaseUrl = resolveBaseUrl();
// A phone's localhost is the phone itself. During local development, Vite
// forwards API and WebSocket requests from the page's origin to the PC backend.
const useDevProxy = import.meta.env.DEV && typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1', '[::1]'].includes(new URL(configuredBaseUrl).hostname);
export const API_BASE_URL = useDevProxy ? window.location.origin : configuredBaseUrl;

/**
 * Normalizes and sanitizes endpoints to prevent malformed double slashes or missing leading slashes.
 */
export function buildApiUrl(endpoint: string): string {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const cleanBase = API_BASE_URL.replace(/\/+$/, '');
  const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${cleanBase}${cleanPath}`.replace(/([^:]\/)\/+/g, '$1');
}

/**
 * Transforms raw database, network, and technical constraint errors into clear, friendly English.
 */
export function sanitizeUserFriendlyError(rawMessage: string): string {
  if (!rawMessage || typeof rawMessage !== 'string') {
    return 'An unexpected error occurred. Please try again.';
  }

  const lower = rawMessage.toLowerCase();

  // Contact number duplicate / unique constraint
  if (lower.includes('contact_number') && (lower.includes('duplicate') || lower.includes('already exists') || lower.includes('unique'))) {
    const match = rawMessage.match(/\+?\d[\d\s-]{8,15}\d/);
    const num = match ? match[0] : 'This contact number';
    return `The contact number ${num} is already registered to another account. Please use a different hotline number.`;
  }

  // Barangay duplicate
  if ((lower.includes('barangay') || lower.includes('unique_lgu_account')) && (lower.includes('already exists') || lower.includes('duplicate') || lower.includes('unique constraint'))) {
    return 'This barangay is already registered in the directory. Each barangay can only have one official account.';
  }

  // Email duplicate
  if (lower.includes('email') && (lower.includes('already exists') || lower.includes('duplicate') || lower.includes('unique constraint'))) {
    return 'This email address is already in use by another account. Please use a different email.';
  }

  // Username duplicate
  if (lower.includes('username') && (lower.includes('already exists') || lower.includes('duplicate') || lower.includes('unique constraint'))) {
    return 'This username is already taken. Please choose another username.';
  }

  // General postgres constraint violation
  if (lower.includes('violates unique constraint') || lower.includes('duplicate key value') || lower.includes('database constraint')) {
    if (lower.includes('contact')) {
      return 'The contact number entered is already registered. Please provide a different number.';
    }
    if (lower.includes('barangay')) {
      return 'An official account for this barangay already exists in the system.';
    }
    return 'An account with these details already exists. Please verify the information and try again.';
  }

  // Null constraint
  if (lower.includes('null value in column') || lower.includes('not-null constraint')) {
    return 'Please complete all required fields before submitting.';
  }

  return rawMessage;
}

export interface FetchApiOptions extends RequestInit {
  timeoutMs?: number;
  maxRetries?: number;
  responseType?: 'json' | 'text' | 'blob';
}

const DEFAULT_TIMEOUT_MS = 25000; // 25 seconds to comfortably accommodate Vercel serverless cold starts

/**
 * Enterprise fetch wrapper with:
 * - URL sanitization
 * - Bearer token auto-injection
 * - Cold-start retry mechanism (502, 503, 504, or network timeout)
 * - Safe non-JSON error handling (Vercel edge HTML error parsing)
 * - 401 session expiration event dispatch
 */
export async function fetchApi<T>(endpoint: string, options: FetchApiOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, maxRetries = 1, responseType = 'json', ...fetchOptions } = options;
  const url = buildApiUrl(endpoint);

  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('serbisure_admin_token') : null;
  const headers: Record<string, string> = {
    ...((fetchOptions.headers as Record<string, string>) || {}),
  };

  // Only inject Content-Type: application/json if not FormData
  if (!(fetchOptions.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let attempt = 0;
  while (attempt <= maxRetries) {
    attempt++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timer);

      // Handle HTTP errors
      if (!response.ok) {
        // Cold-start / Gateway errors on Vercel: Retry once if attempt <= maxRetries
        if ((response.status === 502 || response.status === 503 || response.status === 504) && attempt <= maxRetries) {
          console.warn(`[API] Cloud backend cold start detected (HTTP ${response.status}). Retrying (${attempt}/${maxRetries})...`);
          await new Promise((resolve) => setTimeout(resolve, 1500));
          continue;
        }

        // Notify app if session is unauthorized / expired
        if (response.status === 401 && typeof window !== 'undefined') {
          try {
            localStorage.removeItem('serbisure_admin_token');
          } catch {
            // ignore
          }
          window.dispatchEvent(new CustomEvent('serbisure:auth_expired'));
        }

        // Parse error message safely (supporting JSON or HTML error pages from Vercel)
        const contentType = response.headers.get('content-type') || '';
        let message = `API Error: ${response.status} ${response.statusText}`;
        let errorData: Record<string, unknown> = {};

        if (contentType.includes('application/json')) {
          const errorBody = await response.json().catch(() => ({}));
          errorData = errorBody;
          message = errorBody.detail || errorBody.error || errorBody.message || message;
        } else {
          const textBody = await response.text().catch(() => '');
          if (response.status === 504 || response.status === 502) {
            message = 'The cloud server is currently waking up or experiencing high latency. Please retry shortly.';
          } else if (textBody.length > 0 && textBody.length < 150) {
            message = textBody.trim();
          }
        }

        throw Object.assign(new Error(sanitizeUserFriendlyError(message)), { status: response.status, data: errorData });
      }

      if (responseType === 'blob') return await response.blob() as T;
      return responseType === 'text' ? await response.text() as T : await response.json();
    } catch (err: any) {
      clearTimeout(timer);

      // If aborted due to timeout
      if (err.name === 'AbortError') {
        if (attempt <= maxRetries) {
          console.warn(`[API] Request timed out (${timeoutMs}ms). Retrying (${attempt}/${maxRetries})...`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        throw new Error('Connection timed out. The server may be taking longer to respond. Please refresh or retry.');
      }

      // Network disconnect or connection reset: retry once
      if (attempt <= maxRetries && (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError'))) {
        console.warn(`[API] Network connection issue. Retrying (${attempt}/${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }

      throw err;
    }
  }

  throw new Error('Unable to complete request to backend server.');
}
