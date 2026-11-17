const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export type User = { id: string; email: string; name: string };

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('hp_token');
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem('hp_token', token);
  else localStorage.removeItem('hp_token');
}

export async function api<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, headers, ...rest } = options;
  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };
  if (auth) {
    const token = getToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.message || JSON.stringify(body);
      if (Array.isArray(message)) message = message.join(', ');
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
