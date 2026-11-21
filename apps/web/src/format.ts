const rupiah = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 0,
})

/** Format mata uang Indonesia, cth: 80000 -> "Rp80.000". */
export function formatRupiah(nilai: number): string {
  return `Rp${rupiah.format(nilai)}`
}

/** Nomor meja dua digit, cth: 7 -> "07". */
export function formatNomorMeja(nomor: number): string {
  return String(nomor).padStart(2, '0')
}

/** Jam lokal 24 jam, cth: "14:32". */
export function formatJam(tanggal: Date): string {
  const jam = String(tanggal.getHours()).padStart(2, '0')
  const menit = String(tanggal.getMinutes()).padStart(2, '0')
  return `${jam}:${menit}`
}

/** Path foto dari server: filename polos dilayani dari /uploads/. */
export function urlFoto(path: string | null): string | null {
  if (!path) return null
  if (path.startsWith('/') || /^https?:\/\//.test(path)) return path
  return `/uploads/${path}`
}
