import type {
  HealthResponse,
  LoginRequest,
  LoginResponse,
  MejaResponse,
  MeResponse,
  MenuResponse,
  PatchMenuRequest,
  PatchMenuResponse,
} from './types'

export const TOKEN_KEY = 'kasirin.token'

const UNAUTHORIZED_EVENT = 'kasirin:unauthorized'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Penyimpanan tidak tersedia (mis. mode privat) — sesi tetap berjalan.
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Abaikan.
  }
}

/** Dipanggil dari App agar 401 kapan pun mengembalikan ke layar masuk. */
export function onUnauthorized(cb: () => void): () => void {
  window.addEventListener(UNAUTHORIZED_EVENT, cb)
  return () => window.removeEventListener(UNAUTHORIZED_EVENT, cb)
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = true,
): Promise<T> {
  const token = getToken()
  const headers = new Headers(options.headers)
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')
  if (auth && token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`/api${path}`, { ...options, headers })
  } catch {
    throw new ApiError(0, 'NetworkError')
  }

  if (response.status === 401 && auth && token) {
    clearToken()
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
  }

  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const obj =
      payload !== null && typeof payload === 'object'
        ? (payload as Record<string, unknown>)
        : null
    const pesan =
      typeof obj?.error === 'string'
        ? obj.error
        : typeof obj?.message === 'string'
          ? obj.message
          : `HTTP ${response.status}`
    throw new ApiError(response.status, pesan)
  }

  return payload as T
}

export function login(body: LoginRequest): Promise<LoginResponse> {
  return request<LoginResponse>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify(body) },
    false,
  )
}

export function getMe(): Promise<MeResponse> {
  return request<MeResponse>('/auth/me')
}

export function getTables(): Promise<MejaResponse> {
  return request<MejaResponse>('/tables')
}

export function getMenu(): Promise<MenuResponse> {
  return request<MenuResponse>('/menu')
}

export function patchMenu(
  id: number,
  body: PatchMenuRequest,
): Promise<PatchMenuResponse> {
  return request<PatchMenuResponse>(`/menu/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health', {}, false)
}
