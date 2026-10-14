import { loadTerminalToken, loadTokens, saveTokens, type Tokens } from './storage';

/** Error de la API con el mensaje en español que devuelve el backend. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details: unknown = null
  ) {
    super(message);
  }
}

interface ApiState {
  serverUrl: string | null;
  companyId: number | null;
  onSessionExpired: (() => void) | null;
}

const state: ApiState = { serverUrl: null, companyId: null, onSessionExpired: null };

export function configureApi(partial: Partial<ApiState>) {
  Object.assign(state, partial);
}

/** Acepta "192.168.1.50:4000", "http://..." o "https://..." y quita la barra final. */
export function normalizeServerUrl(input: string) {
  const trimmed = input.trim().replace(/\/+$/, '');
  if (!trimmed) {
    return '';
  }
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

const TIMEOUT_MS = 15000;

async function rawFetch(baseUrl: string, path: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${baseUrl}${path}`, { ...init, signal: controller.signal });
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new ApiError('El servidor no respondió a tiempo. Revisa la red de la terminal.', 0);
    }
    throw new ApiError('No se pudo conectar con el servidor. Revisa la dirección y que la terminal esté en la red.', 0);
  } finally {
    clearTimeout(timer);
  }
}

async function parse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message =
      (body as { message?: string } | null)?.message ?? `Error del servidor (${response.status}).`;
    throw new ApiError(message, response.status, (body as { details?: unknown } | null)?.details ?? null);
  }
  return body as T;
}

/** Prueba un servidor sin sesión: responde si el backend y su base están en línea. */
export async function checkServer(serverUrl: string) {
  const response = await rawFetch(serverUrl, '/api/health', { method: 'GET' });
  const body = await response.json().catch(() => null);
  return {
    ok: response.ok && Boolean(body?.ok),
    database: Boolean(body?.database),
    version: (body?.version as string | undefined) ?? null,
  };
}

let refreshing: Promise<Tokens | null> | null = null;

async function refreshTokens(): Promise<Tokens | null> {
  const current = await loadTokens();
  if (!current || !state.serverUrl) {
    return null;
  }
  try {
    const response = await rawFetch(state.serverUrl, '/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as Tokens;
    const tokens = { accessToken: body.accessToken, refreshToken: body.refreshToken };
    await saveTokens(tokens);
    return tokens;
  } catch {
    return null;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** false en login: no manda token ni intenta renovar la sesión. */
  auth?: boolean;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!state.serverUrl) {
    throw new ApiError('Configura primero la dirección del servidor.', 0);
  }
  const { method = 'GET', body, query, auth = true } = options;
  const search = query
    ? Object.entries(query)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&')
    : '';
  const url = search ? `${path}?${search}` : path;

  const send = async (tokens: Tokens | null) => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (auth && tokens) {
      headers.Authorization = `Bearer ${tokens.accessToken}`;
    }
    if (state.companyId) {
      headers['x-company-id'] = String(state.companyId);
    }
    const terminalToken = await loadTerminalToken();
    if (terminalToken) {
      headers['x-cash-terminal'] = terminalToken;
    }
    return rawFetch(state.serverUrl!, url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let response = await send(auth ? await loadTokens() : null);

  if (auth && response.status === 401) {
    refreshing ??= refreshTokens().finally(() => {
      refreshing = null;
    });
    const tokens = await refreshing;
    if (!tokens) {
      state.onSessionExpired?.();
      throw new ApiError('La sesión expiró. Inicia sesión de nuevo.', 401);
    }
    response = await send(tokens);
  }

  return parse<T>(response);
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }
  return 'Ocurrió un error inesperado.';
}
