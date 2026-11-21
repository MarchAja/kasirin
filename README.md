# KasirIn

POS open source untuk UMKM F&B Indonesia. Pelanggan memesan lewat QR di meja,
kasir mengelola pesanan dan tagihan, semuanya berjalan di komputer kasir sendiri
— tanpa VPS, tanpa langganan.

Lisensi: AGPL-3.0. Status: **Milestone 4 selesai** — keempat milestone sudah
terbangun: fondasi, pemesanan pelanggan lewat QR, alur kasir penuh, serta QRIS
otomatis, cadangan, dan aset installer Windows.

Panduan pemasangan: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

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

Screenshot aplikasi Milestone 4:

- `qris-m4.png` — dialog QRIS dengan cek status dan penguncian tagihan
- `cadangan-m4.png` — halaman cadangan dan ekspor

Layar kasir responsif: ubah lebar jendela di browser untuk melihat ketiga tata
letak. Foto contoh memakai Unsplash (lihat `prototype/CREDITS.md`) dan hanya
untuk mockup.

Panduan web modern dari Google Chrome terpasang di
`.agents/skills/modern-web-guidance/`.

## Rencana teknologi

TypeScript, Node 22, Fastify, SQLite, React, polling 3 detik. Target utama
Windows. Distribusi lewat ZIP portabel dan `start.bat`. **Installer `.exe` —
coming soon.**

## Instalasi manual (Windows)

> **Installer `.exe` — coming soon.** Untuk sementara, pasang dari ZIP portabel
> atau langsung dari sumber. Setelah terpasang, KasirIn berjalan offline penuh.

### 1. Pasang prasyarat (sekali saja)

| Kebutuhan | Kenapa | Cara |
|---|---|---|
| **Node.js 22 atau lebih baru** | Menjalankan server KasirIn | Unduh MSI dari https://nodejs.org/, instal dengan opsi default. Cek: `node --version` |
| **Visual Studio Build Tools** + workload *Desktop development with C++* | Menyusun modul SQLite (`better-sqlite3`) saat `npm ci` | Unduh "Visual Studio Build Tools" dari https://visualstudio.microsoft.com/downloads/, saat instalasi centang workload **Desktop development with C++** |
| **Python 3.11+** | Dibutuhkan `node-gyp` | Unduh dari https://www.python.org/downloads/, centang **Add Python to PATH** saat instalasi |
| **Koneksi internet** | Hanya saat `npm ci` mengunduh paket | Setelah itu tidak diperlukan |

### 2. Dari ZIP rilis

1. Unduh `KasirIn-windows.zip` dari
   https://github.com/MarchAja/kasirin/releases/latest
2. Ekstrak ke folder, misalnya `C:\KasirIn`.
3. Buka **Command Prompt** di folder tersebut, lalu jalankan:

   ```bat
   npm ci
   ```

   Perintah ini membaca `package-lock.json`, mengunduh semua paket dengan versi
   yang persis sama, dan menyusun `better-sqlite3`. Biasanya memakan waktu
   beberapa menit. ZIP **tidak** menyertakan `node_modules`, jadi langkah ini
   wajib dilakukan sekali di komputer kasir.

   Bila muncul error `Could not find any Visual Studio installation to use`,
   pasang Visual Studio Build Tools seperti di tabel prasyarat lalu ulangi
   `npm ci`.

4. Jalankan aplikasi:

   ```bat
   run.cmd
   ```

5. Buka http://localhost:3000 di browser. Biarkan jendela Command Prompt tetap
   terbuka selama KasirIn dipakai; menutupnya akan menghentikan server.

6. Masuk dengan PIN kasir `123456` atau kata sandi pemilik `owner123`
   (PIN diskon pemilik: `246810`).

### 3. Dari sumber

```bat
npm ci
npm run build
start.bat
```

Kebutuhannya sama dengan ZIP (Node.js 22+, Build Tools, Python), plus Git untuk
mengunduh sumber. Buka http://localhost:3000 setelahnya.

### 4. Data dan pengaturan

Data tersimpan di `%LOCALAPPDATA%\KasirIn\data` (SQLite, foto, dan cadangan).
`run.cmd`/`start.bat` otomatis mengatur lokasi ini. Untuk memindahkannya, set
`KASIRIN_DATA_DIR` sebelum menjalankan. Port default `3000` bisa diubah lewat
`PORT`; salin `.env.example` menjadi `.env` untuk menyimpan pengaturan.

Panduan lengkap (firewall, ngrok, cadangan, pemulihan):
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Menjalankan secara lokal (pengembangan)

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

9. Untuk QRIS otomatis, pemilik mengatur mode bayar di **Pengaturan**
   (`manual` / `otomatis` / `keduanya`). Tanpa kunci Midtrans, aplikasi memakai
   penyedia **simulasi** agar alur bisa dicoba: buat QRIS → "Simulasikan
   pembayaran" → **Cek status pembayaran**. Dengan `MIDTRANS_SERVER_KEY`,
   adaptor Midtrans yang dipakai dan webhook diverifikasi lewat signature.
10. Saat QRIS tertunda, tagihan **terkunci** (pesanan tambahan ditolak sampai
    status final). Tombol **Cek status pembayaran** selalu tersedia; bila
    koneksi gagal, tagihan ditandai *perlu dicek*.
11. Halaman **Cadangan** (pemilik) membuat, mengunduh, dan mengekspor cadangan
    SQLite. Cadangan harian otomatis disimpan di `data/backups` (retensi 7).

Aset installer Windows ada di `installer/` dan `scripts/build-windows.ps1`.
File `.exe` **tidak** bisa dibuat di macOS/Linux; workflow
`.github/workflows/release-windows.yml` membangunnya di runner Windows saat tag
`v*` di-push.

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
