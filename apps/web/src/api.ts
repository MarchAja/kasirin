import type {
  AntreanResponse,
  BayarRequest,
  DiskonRequest,
  HealthResponse,
  InfoMejaResponse,
  KirimPesananRequest,
  KirimPesananResponse,
  LoginRequest,
  LoginResponse,
  Meja,
  MejaResponse,
  MeResponse,
  MenuResponse,
  PatchMenuRequest,
  PatchMenuResponse,
  PengaturanResponse,
  PesananPublik,
  RingkasanHarian,
  StatusResponse,
  TagihanDetail,
  TagihanResponse,
  UpdatePengaturanRequest,
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

// ---------------------------------------------------------------------------
// Milestone 2 — endpoint pelanggan (tanpa token) & antrean kasir
// ---------------------------------------------------------------------------

export function getInfoMeja(token: string): Promise<InfoMejaResponse> {
  return request<InfoMejaResponse>(`/m/${token}`, {}, false)
}

export function getMenuPelanggan(token: string): Promise<MenuResponse> {
  return request<MenuResponse>(`/m/${token}/menu`, {}, false)
}

export function getStatusMeja(token: string): Promise<StatusResponse> {
  return request<StatusResponse>(`/m/${token}/status`, {}, false)
}

export function kirimPesanan(
  token: string,
  body: KirimPesananRequest,
): Promise<KirimPesananResponse> {
  return request<KirimPesananResponse>(`/m/${token}/orders`, {
    method: 'POST',
    body: JSON.stringify(body),
  }, false)
}

export function getAntrean(): Promise<AntreanResponse> {
  return request<AntreanResponse>('/orders/baru')
}

export function terimaPesanan(id: number): Promise<{ pesanan: PesananPublik }> {
  return request<{ pesanan: PesananPublik }>(`/orders/${id}/accept`, {
    method: 'POST',
  })
}

export function sajikanPesanan(id: number): Promise<{ pesanan: PesananPublik }> {
  return request<{ pesanan: PesananPublik }>(`/orders/${id}/serve`, {
    method: 'POST',
  })
}

// ---------------------------------------------------------------------------
// Milestone 3 — alur kasir: tagihan, bayar, diskon, tutup meja, dan ringkasan
// ---------------------------------------------------------------------------

export function getTagihanMeja(mejaId: number): Promise<TagihanResponse> {
  return request<TagihanResponse>(`/tagihan/meja/${mejaId}`)
}

export function bayarTagihan(
  id: number,
  body: BayarRequest,
): Promise<TagihanResponse> {
  return request<TagihanResponse>(`/tagihan/${id}/bayar`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function beriDiskon(
  id: number,
  body: DiskonRequest,
): Promise<TagihanResponse> {
  return request<TagihanResponse>(`/tagihan/${id}/diskon`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function konfirmasiPembayaran(id: number): Promise<TagihanResponse> {
  return request<TagihanResponse>(`/tagihan/${id}/konfirmasi`, {
    method: 'POST',
  })
}

export function tutupKunjungan(
  id: number,
): Promise<{ meja: Meja; tagihan: TagihanDetail }> {
  return request<{ meja: Meja; tagihan: TagihanDetail }>(
    `/kunjungan/${id}/tutup`,
    { method: 'POST' },
  )
}

export function getRingkasanHarian(): Promise<RingkasanHarian> {
  return request<RingkasanHarian>('/ringkasan/hari-ini')
}

export function getPengaturan(): Promise<PengaturanResponse> {
  return request<PengaturanResponse>('/outlet')
}

export function updatePengaturan(
  body: UpdatePengaturanRequest,
): Promise<PengaturanResponse> {
  return request<PengaturanResponse>('/outlet', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}
