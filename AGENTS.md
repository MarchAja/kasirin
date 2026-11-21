# AGENTS.md — Panduan untuk Agen AI

Panduan ini untuk agen coding (Claude Code, Codex, OpenCode, dan sejenisnya)
yang bekerja di repositori KasirIn. Baca `docs/SPEC.md` dan `docs/DESIGN.md`
sebelum mengubah kode.

## Tentang proyek

KasirIn adalah POS open source untuk UMKM F&B Indonesia. Berjalan lokal di
komputer kasir (tanpa VPS), QR per meja untuk pemesanan pelanggan, satu tagihan
per kunjungan meja, pembayaran manual dan otomatis (QRIS/Midtrans). Lisensi
AGPL-3.0. Target utama Windows. Detail ruang lingkup ada di `docs/SPEC.md`.

## Susunan repositori (setelah dibangun)

```
apps/
  server/     Fastify + SQLite (better-sqlite3), migrasi, dan API
  web/        React + Vite + Tailwind (layar kasir dan panel pemilik)
docs/         SPEC.md, DESIGN.md, IDEAS.md, mockups/
prototype/    Mockup HTML statis (acuan visual, bukan kode produksi)
```

Milestone 3 sudah membangun `apps/server` dan `apps/web`: fondasi (M1), alur
pelanggan lewat QR (M2), serta pembayaran manual, diskon, tutup meja, dan
ringkasan harian (M3). Tipe kontrak API disimpan lokal di
`apps/web/src/types.ts` agar kedua workspace bisa dibangun tanpa urutan build
tambahan.

## Perintah

Jalankan dari akar repositori (npm workspaces):

- `npm install` — pasang dependensi saat menyiapkan lingkungan.
- `npm run dev` — jalankan server dan web dalam mode pengembangan.
- `npm run build` — build produksi untuk semua workspace.
- `npm run typecheck` — cek tipe TypeScript (strict).
- `npm test` — jalankan seluruh test (unit + integrasi).
- `npm run lint` — jalankan lint/format check.

Selalu jalankan `npm run lint`, `npm run typecheck`, dan `npm test` sebelum
mengakhiri pekerjaan. CI GitHub Actions menjalankan perintah yang sama pada
setiap push dan pull request ke `main`.

## Konvensi

- **TypeScript strict.** Tanpa `any` kecuali benar-benar tak terhindarkan.
  Kontrak API didefinisikan di `apps/web/src/types.ts` dan dipakai sebagai
  acuan bersama dengan rute di `apps/server/src/routes/`.
- **UI Bahasa Indonesia.** Semua teks yang dilihat pengguna berbahasa
  Indonesia. Simpan teks di satu berkas terpusat agar mudah di-i18n kelak.
- **Desain mengikuti token.** Pakai token warna, tipografi, radius, bayangan,
  dan pola di `docs/DESIGN.md`. Jangan pakai gradien dekoratif, bayangan
  berlapis, glassmorphism, atau animasi memantul. Hormati
  `prefers-reduced-motion`.
- **Status pakai tint + titik/pill**, bukan blok warna jenuh. Aksen hijau pandan
  hanya untuk aksi dan status positif.
- **Dua muka.** Layar kasir/pemilik (operasional, padat) dan layar pelanggan
  (foto, harga, sentuh satu tangan). Token sama, komposisi beda.
- **Mata uang IDR**, format `Rp80.000`. Angka memakai tabular numerals.
- **Harga dan nama item disalin (snapshot)** ke `pesanan_item` dan `item_addon`
  agar riwayat tidak berubah saat menu diedit.
- **Pembaruan layar pakai polling 3 detik**, bukan WebSocket/SSE.
- **Data lokal SQLite.** Semua perubahan skema lewat migrasi, bukan edit manual.
- **Token meja acak** untuk mengidentifikasi pelanggan; jangan simpan nama atau
  nomor HP pelanggan.

## Batasan lingkup — jangan menambahkan tanpa diminta

Sesuai `docs/SPEC.md` bagian non-goals, jangan mengerjakan hal berikut dalam MVP:

- Stok bahan, resep, atau HPP — cukup penanda "habis".
- Pisah bill dan pindah meja.
- Takeaway dan delivery.
- Varian harga/ukuran — buat sebagai item terpisah; addon bukan varian.
- Harga addon negatif.
- Layar dapur terpisah dan printer ESC/POS langsung.
- Refund lewat aplikasi.
- Multi-outlet, multi-terminal kasir, sinkronisasi cloud.
- Akun pelanggan, loyalty, promo otomatis, pemesanan lewat WhatsApp.
- Mode gelap (tidak masuk MVP).

Jika sebuah permintaan tampak membutuhkan fitur di atas, berhenti dan tanyakan
kepada manusia daripada mengimplementasikannya diam-diam.

## Aturan kerja

- Baca dulu berkas yang sudah ada sebelum mengubahnya; perlakukan kode orang
  lain sebagai pekerjaan yang harus dihormati.
- Perubahan kecil dan terfokus. Jangan menyentuh `package.json`, `packages/`,
  `apps/`, `docs/`, atau `prototype/` kecuali itu memang tugas yang diberikan.
- **Jangan commit kecuali diminta secara eksplisit.** Jangan push, merge, atau
  reset.
- Jangan mengungkap atau menulis kunci produksi (Midtrans, ngrok, password)
  ke dalam kode; gunakan variabel lingkungan dari `.env.example`.
