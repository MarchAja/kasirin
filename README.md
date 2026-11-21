# KasirIn

POS open source untuk UMKM F&B Indonesia. Pelanggan memesan lewat QR di meja,
kasir mengelola pesanan dan tagihan, semuanya berjalan di komputer kasir sendiri
— tanpa VPS, tanpa langganan.

Lisensi: AGPL-3.0. Status: **Milestone 3** — alur kasir penuh: pembayaran manual,
diskon dengan PIN pemilik, penutupan meja, dan ringkasan harian. Satu warung
sudah bisa beroperasi penuh.

Dibuat oleh [@MarchAja](https://github.com/MarchAja) · Open Source · AGPL-3.0.

## Kenapa KasirIn

- **Tanpa server sewaan.** Data dan aplikasi ada di komputer kasir.
- **Pelanggan tidak perlu install apa pun.** Cukup scan QR di meja.
- **Tetap jalan saat internet putus.** Kasir dapat mencatat pesanan dan
  pembayaran manual.
- **Akses dari data seluler bersifat opsional** lewat tunnel (ngrok).
- **Tanpa data pribadi pelanggan.** Pesanan dikenali dari token meja.

## Lingkup singkat

Satu outlet, makan di tempat. QR per meja, persetujuan pesanan oleh staf, satu
tagihan per kunjungan, pembayaran manual (tunai/QRIS) atau otomatis (QRIS
dinamis Midtrans), ringkasan tutup hari, dan cadangan harian.

Bukan bagian MVP: stok bahan, pisah bill, pindah meja, takeaway/delivery,
layar dapur, printer ESC/POS langsung.

## Dokumen

- [`docs/SPEC.md`](docs/SPEC.md) — spesifikasi lengkap, aturan bisnis, arsitektur,
  milestone, dan log 62 keputusan desain.
- [`docs/DESIGN.md`](docs/DESIGN.md) — sistem desain: token, tipografi, komposisi
  layar kasir dan pelanggan, state, komponen, dan larangan visual.
- [`docs/IDEAS.md`](docs/IDEAS.md) — ide yang dipertimbangkan dan ditunda.

## Prototipe

`prototype/` berisi mockup HTML yang bisa dibuka di browser:

- `kasir.html` — papan meja, antrean pesanan, tagihan, ringkasan shift.
- `menu.html` — pencarian, rail favorit, daftar menu, bar keranjang.
- `addon.html` — sheet addon native dengan pilihan "Tanpa tambahan".

Screenshot ada di `docs/mockups/`:

- `kasir.png` — PC 1440×900
- `kasir-tablet.png` — tablet lanskap 1024×768
- `kasir-tablet-portrait.png` — tablet potret 820×1180
- `menu.png`, `addon.png` — mockup layar pelanggan

Screenshot aplikasi Milestone 2 (bukan mockup):

- `kasir-m2.png` — antrean pesanan, status meja, dan tagihan berjalan
- `pelanggan-menu.png` — menu pelanggan lewat QR
- `pelanggan-addon.png` — sheet addon native
- `pelanggan-status.png` — halaman status dengan total tagihan

Screenshot aplikasi Milestone 3:

- `kasir-m3.png` — panel tagihan lengkap dengan aksi Bayar/Diskon/Tutup meja
- `ringkasan-m3.png` — ringkasan hari ini per metode bayar dan daftar diskon

Layar kasir responsif: ubah lebar jendela di browser untuk melihat ketiga tata
letak. Foto contoh memakai Unsplash (lihat `prototype/CREDITS.md`) dan hanya
untuk mockup.

Panduan web modern dari Google Chrome terpasang di
`.agents/skills/modern-web-guidance/`.

## Rencana teknologi

TypeScript, Node 22, Fastify, SQLite, React, polling 3 detik. Target utama
Windows. Distribusi MVP lewat `start.bat`, lalu installer `.exe`.

## Mulai dari mana

Milestone 1: skema basis data, migrasi, autentikasi PIN/password, meja, menu,
dan mode demo.

## Menjalankan secara lokal

Butuh **Node.js 22 atau lebih baru**. Dari akar repositori:

```bash
npm install
npm run db:migrate   # membuat skema SQLite
npm run db:seed      # menanam data demo (opsional, otomatis saat dev)
npm run dev          # API :3000 + web :5173
```

Buka http://localhost:5173. Data demo:

| Peran | Kredensial |
|---|---|
| Kasir | PIN `123456` |
| Pemilik | kata sandi `owner123` |

Keduanya bisa diubah lewat variabel lingkungan di `.env.example`.

Untuk produksi lokal (Windows: jalankan `start.bat`):

```bash
npm run build
npm run start:prod
```

Lalu buka http://localhost:3000 — server menyajikan API sekaligus berkas web
yang sudah di-build.

## Alur Milestone 2

1. Masuk sebagai **pemilik**, buka **Meja & QR**, lalu cetak QR meja.
2. Pindai QR (atau buka langsung `http://localhost:5173/m/<token-meja>`).
3. Pilih menu, atur addon dan jumlah, lalu kirim pesanan.
4. Halaman status pelanggan memperbarui sendiri tiap 3 detik.
5. Di layar kasir, pesanan muncul di **Pesanan baru** → tombol **Terima**, lalu
   **Disajikan**. Satu tagihan per kunjungan meja otomatis bertambah bila
   pelanggan memesan lagi sebelum meja ditutup.

5. Di panel **Meja**, buka tagihan meja yang dipilih: bayar tunai / QRIS manual,
   beri diskon dengan PIN pemilik `246810` + alasan, atau tandai QRIS sebagai
   *perlu dicek* lalu konfirmasi setelah dicek.
6. Setelah lunas, tombol **Tutup meja** mengembalikan meja ke kondisi kosong.
7. Halaman **Ringkasan** menampilkan omzet hari ini, rincian per metode bayar,
   tagihan terbuka, tagihan perlu dicek, dan daftar diskon beserta alasannya.
8. Pemilik mengatur pajak PB1, service charge, dan mode bayar di **Pengaturan**.

Pembayaran QRIS otomatis (Midtrans), cadangan otomatis, dan installer Windows
masuk Milestone 4.

## Perintah pengembang

| Perintah | Fungsi |
|---|---|
| `npm test` | tes unit + integrasi (Vitest) |
| `npm run typecheck` | cek tipe TypeScript |
| `npm run lint` | ESLint |
| `npm run build` | build server + web |

## Kredit dan watermarks

Mockup dan screenshot memakai foto contoh dari Unsplash
(lihat `prototype/CREDITS.md`) dan watermark **KasirIn · @MarchAja · Open
Source · AGPL-3.0**. Watermark hanya untuk mockup, tidak dipakai aplikasi
produksi.

Lisensi lengkap ada di [`LICENSE`](LICENSE). Kontribusi:
[`CONTRIBUTING.md`](CONTRIBUTING.md).
