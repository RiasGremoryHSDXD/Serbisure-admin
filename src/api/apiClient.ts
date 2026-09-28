export const VERCEL_API_URL = 'https://serbisure-backend-rho.vercel.app';

/**
 * Resolves the primary API base URL:
 * 1. Explicit VITE_API_URL from environment (.env)
 * 2. Defaults to VERCEL_API_URL if unset or empty
 */
function resolveBaseUrl(): string {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim();
  }
  return VERCEL_API_URL;
}

export const API_BASE_URL = resolveBaseUrl();

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
 * Helper to check if the current configuration is targeting the Vercel cloud backend.
 */
export function isCloudBackend(): boolean {
  return API_BASE_URL.includes('vercel.app');
}

export interface FetchApiOptions extends RequestInit {
  timeoutMs?: number;
  maxRetries?: number;
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
  const { timeoutMs = DEFAULT_TIMEOUT_MS, maxRetries = 1, ...fetchOptions } = options;
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
        // If an endpoint returns 404 OR a 5xx server error on Vercel cloud,
        // gracefully attempt the local backend if reachable (e.g. newly added
        // feature, or a cloud-only NameError like the inbox public_id bug)
        if ((response.status === 404 || response.status >= 500) && isCloudBackend()) {
          try {
            const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
            const localFallbackUrl = `http://127.0.0.1:8000${cleanPath}`;
            const fallbackController = new AbortController();
            const fallbackTimer = setTimeout(() => fallbackController.abort(), 4000);
            const fallbackRes = await fetch(localFallbackUrl, {
              ...fetchOptions,
              headers,
              signal: fallbackController.signal,
            });
            clearTimeout(fallbackTimer);
            if (fallbackRes.ok) {
              console.info(`[API] Endpoint 404 on cloud; resolved via local backend fallback: ${cleanPath}`);
              return await fallbackRes.json();
            }
          } catch {
            // Local backend not reachable, proceed to regular error handling
          }
        }

        // Cold-start / Gateway errors on Vercel: Retry once if attempt <= maxRetries
        if ((response.status === 502 || response.status === 503 || response.status === 504) && attempt <= maxRetries) {
          console.warn(`[API] Cloud backend cold start detected (HTTP ${response.status}). Retrying (${attempt}/${maxRetries})...`);
          await new Promise((resolve) => setTimeout(resolve, 1500));
          continue;
        }

        // Notify app if session is unauthorized / expired
        if (response.status === 401 && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('serbisure:auth_expired'));
        }

        // Parse error message safely (supporting JSON or HTML error pages from Vercel)
        const contentType = response.headers.get('content-type') || '';
        let message = `API Error: ${response.status} ${response.statusText}`;

        if (contentType.includes('application/json')) {
          const errorBody = await response.json().catch(() => ({}));
          message = errorBody.detail || errorBody.error || errorBody.message || message;
        } else {
          const textBody = await response.text().catch(() => '');
          if (response.status === 504 || response.status === 502) {
            message = 'The cloud server is currently waking up or experiencing high latency. Please retry shortly.';
          } else if (textBody.length > 0 && textBody.length < 150) {
            message = textBody.trim();
          }
        }

        throw new Error(message);
      }

      return await response.json();
    } catch (err: any) {
      clearTimeout(timer);

      // Network disconnect or connection refused: attempt alternate backend before retrying
      if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        const altBase = isCloudBackend() ? 'http://127.0.0.1:8000' : VERCEL_API_URL;
        try {
          const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
          const altUrl = `${altBase}${cleanPath}`;
          const altController = new AbortController();
          const altTimer = setTimeout(() => altController.abort(), 4000);
          const altRes = await fetch(altUrl, {
            ...fetchOptions,
            headers,
            signal: altController.signal,
          });
          clearTimeout(altTimer);
          if (altRes.ok) {
            console.info(`[API] Primary connection failed; resolved via alternate backend: ${altUrl}`);
            return await altRes.json();
          }
        } catch {
          // Alternate backend also failed
        }
      }

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
