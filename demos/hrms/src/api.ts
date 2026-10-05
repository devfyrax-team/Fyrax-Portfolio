// The refresh token lives in an httpOnly cookie that scripts cannot read, so this module only ever
// holds the short-lived access token (in memory). The flag below is a non-secret hint that a session
// may exist (and of which kind), so signed-out visitors do not trigger a pointless refresh call.
const SESSION_FLAG = 'hrms.session';

/** A company session (employees, managers, HR, company admins) or a platform session (super admins). */
export type Scope = 'tenant' | 'platform';

export function storedScope(): Scope | null {
  try {
    const v = localStorage.getItem(SESSION_FLAG);
    return v === 'platform' ? 'platform' : v === 'tenant' || v === '1' ? 'tenant' : null;
  } catch {
    return null;
  }
}

let scope: Scope = storedScope() ?? 'tenant';
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;

// Earlier versions kept the refresh token in localStorage, where any script could read it. Remove leftovers.
try {
  localStorage.removeItem('hrms.refresh');
} catch {
  /* ignore */
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function setTokens(t: { accessToken: string }, as: Scope = scope) {
  accessToken = t.accessToken;
  scope = as;
  try {
    localStorage.setItem(SESSION_FLAG, as);
  } catch {
    /* storage unavailable: the session just won't survive a reload */
  }
}

export function clearTokens() {
  accessToken = null;
  try {
    localStorage.removeItem(SESSION_FLAG);
  } catch {
    /* ignore */
  }
}

export const hasStoredSession = () => storedScope() !== null;

// The API reports errors as a string or as a flattened zod object; turn either into one readable line.
function messageOf(body: any, fallback: string): string {
  const e = body?.error;
  if (typeof e === 'string') return e;
  if (e?.fieldErrors) {
    for (const [field, msgs] of Object.entries<string[]>(e.fieldErrors)) {
      // Password rules already read as a sentence ("Include at least one number"), so skip the field name.
      if (msgs?.length) return /password/i.test(field) ? msgs[0] : `${field}: ${msgs[0]}`;
    }
  }
  if (e?.formErrors?.length) return e.formErrors[0];
  return fallback;
}

export async function refreshSession(): Promise<boolean> {
  // One refresh at a time in this page: refresh tokens rotate, so parallel calls would invalidate each other.
  refreshing ??= (async () => {
    try {
      // Another tab or a page load may have rotated the cookie a moment ago. If we lost that race, the
      // browser already holds the new cookie, so one short retry picks it up before we give up.
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await fetch(scope === 'platform' ? '/api/platform/auth/refresh' : '/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
        if (r.ok) {
          setTokens(await r.json(), scope);
          return true;
        }
        if (r.status !== 401) return false;
        if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 400));
      }
      clearTokens();
      return false;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function raw(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const res = await fetch(`/api${path}`, { ...init, headers, credentials: 'same-origin' });
  // An expired access token is renewed once and the call retried. Sign-in and recovery calls never need it.
  const isSignIn = path.startsWith('/auth/') || path.startsWith('/platform/auth/');
  if (res.status === 401 && retry && !isSignIn && (await refreshSession())) return raw(path, init, false);
  return res;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await raw(path, init);
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, messageOf(body, `Request failed (${res.status})`));
  return body as T;
}

const send = (method: string) => <T>(path: string, data?: unknown) =>
  request<T>(path, { method, body: data === undefined ? undefined : JSON.stringify(data) });

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: send('POST'),
  put: send('PUT'),
  patch: send('PATCH'),
  del: send('DELETE'),
};

/** Downloads an authenticated file (the browser cannot attach the bearer token to a plain link). */
export async function downloadFile(path: string, filename: string) {
  const res = await raw(path);
  if (!res.ok) throw new ApiError(res.status, messageOf(await res.json().catch(() => null), 'Download failed'));
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Sends a file as the request body (the API reads its details from the query string). */
export async function uploadFile<T>(path: string, file: File): Promise<T> {
  const res = await raw(path, { method: 'POST', body: file, headers: { 'Content-Type': file.type } });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, messageOf(body, `Upload failed (${res.status})`));
  return body as T;
}

/**
 * Sends text (a CSV file the person chose) as the request body. A refusal that carries a report of what is wrong with the
 * file is handed back like a normal answer, so the screen can show it line by line; any other failure throws.
 */
export async function postText<T>(path: string, text: string): Promise<T> {
  const res = await raw(path, { method: 'POST', body: text, headers: { 'Content-Type': 'text/csv' } });
  const body = await res.json().catch(() => null);
  if (!res.ok && !(body && Array.isArray(body.rows))) throw new ApiError(res.status, messageOf(body, `Request failed (${res.status})`));
  return body as T;
}
