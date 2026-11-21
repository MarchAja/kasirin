// Kontrak API KasirIn — didefinisikan lokal agar paket web berdiri sendiri.
// Milestone 1: autentikasi, meja, dan menu.

export type Peran = 'owner' | 'kasir'

export interface Pengguna {
  id: number
  nama: string
  peran: Peran
}

export interface LoginRequest {
  pin?: string
  password?: string
}

export interface LoginResponse {
  token: string
  pengguna: Pengguna
}

export interface MeResponse {
  pengguna: Pengguna
}

export interface Meja {
  id: number
  nomor: number
  token: string
  aktif: boolean
}

export interface MejaResponse {
  meja: Meja[]
}

export interface Kategori {
  id: number
  nama: string
  urutan: number
}

export interface Addon {
  id: number
  grup_id: number
  nama: string
  harga: number
  habis: boolean
  aktif: boolean
  urutan: number
}

export interface GrupAddon {
  id: number
  nama: string
  min_pilih: number
  max_pilih: number
  wajib: boolean
  urutan: number
  addons: Addon[]
}

export interface MenuItem {
  id: number
  kategori_id: number
  nama: string
  harga: number
  foto_path: string | null
  habis: boolean
  aktif: boolean
  grup_addon: number[]
}

export interface MenuResponse {
  kategori: Kategori[]
  items: MenuItem[]
  grup_addon: GrupAddon[]
}

export interface PatchMenuRequest {
  habis?: boolean
  aktif?: boolean
}

export interface PatchMenuResponse {
  item: MenuItem
}

export interface HealthResponse {
  ok: boolean
  versi: string
}
