// Kontrak API KasirIn — didefinisikan lokal agar paket web berdiri sendiri.
// Milestone 1: autentikasi, meja, dan menu.
// Milestone 2: pesanan pelanggan, status meja, dan antrean kasir.

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

/** Status meja ringkas yang dikirim bersama daftar meja. */
export type StatusMeja =
  | 'kosong'
  | 'baru'
  | 'diterima'
  | 'disajikan'
  | 'perlu_dicek'

export interface Meja {
  id: number
  nomor: number
  token: string
  aktif: boolean
  status: StatusMeja
  total: number
  kunjungan_id: number | null
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

// ---------------------------------------------------------------------------
// Milestone 2 — halaman pelanggan & antrean kasir
// ---------------------------------------------------------------------------

export type StatusPesanan =
  | 'baru'
  | 'diterima'
  | 'disajikan'
  | 'ditutup'
  | 'dibatalkan'

export interface MejaPublik {
  id: number
  nomor: number
  token: string
  aktif: boolean
}

export interface OutletPublik {
  nama: string
  alamat: string | null
  mode_bayar: 'manual' | 'otomatis' | 'keduanya'
}

export interface InfoMejaResponse {
  meja: MejaPublik
  outlet: OutletPublik
  kunjungan_terbuka: boolean
}

export interface AddonSnapshot {
  addon_id: number
  nama: string
  harga: number
  grup: string
}

export interface ItemPesanan {
  id: number
  nama: string
  harga_satuan: number
  jumlah: number
  catatan: string | null
  addons: AddonSnapshot[]
  status: StatusPesanan
}

export interface PesananPublik {
  id: number
  status: StatusPesanan
  dibuat_pada: string
  items: ItemPesanan[]
}

export interface TagihanRingkas {
  subtotal: number
  diskon: number
  pajak: number
  service: number
  total: number
  status: string
}

export interface StatusResponse {
  meja: MejaPublik
  outlet: OutletPublik
  ada_kunjungan: boolean
  kunjungan_id: number | null
  dibuka_pada: string | null
  pesanan: PesananPublik[]
  tagihan: TagihanRingkas | null
}

export interface KirimItem {
  menu_item_id: number
  jumlah: number
  catatan?: string
  pilihan_addon: number[]
}

export interface KirimPesananRequest {
  items: KirimItem[]
}

export interface KirimPesananResponse {
  pesanan: PesananPublik
  kunjungan_id: number
}

export interface PesananAntrean {
  id: number
  meja_id: number
  meja_nomor: number
  status: StatusPesanan
  dibuat_pada: string
  items: ItemPesanan[]
  total: number
}

/** Respons daftar pesanan yang perlu tindakan kasir (baru / diterima). */
export interface AntreanResponse {
  pesanan: PesananAntrean[]
}
