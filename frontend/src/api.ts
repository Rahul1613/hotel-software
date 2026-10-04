export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string = 'UNKNOWN', status: number = 500) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem('ekdant_token');
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem('ekdant_token', token);
    } else {
      localStorage.removeItem('ekdant_token');
    }
  } catch {}
}

export function getTableSessionToken(): string | null {
  try {
    return localStorage.getItem('ekdant_table_session_token');
  } catch {
    return null;
  }
}

export function setTableSessionToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem('ekdant_table_session_token', token);
    } else {
      localStorage.removeItem('ekdant_table_session_token');
    }
  } catch {}
}

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const authToken = getAuthToken();
  if (authToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  const tableToken = getTableSessionToken();
  if (tableToken && !headers.has('X-Table-Session-Token')) {
    headers.set('X-Table-Session-Token', tableToken);
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    // If staff endpoint returned 401, clear stale token
    if (authToken && endpoint.includes('/api/')) {
      setAuthToken(null);
    }
  }

  let data: any = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    const errorMsg = data?.error?.message || data?.message || `Request failed with status ${res.status}`;
    const errorCode = data?.error?.code || 'HTTP_ERROR';
    throw new ApiError(errorMsg, errorCode, res.status);
  }

  return data as T;
}
