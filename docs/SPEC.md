# KasirIn — Spesifikasi Produk

> POS open source untuk UMKM F&B Indonesia. Berjalan di komputer kasir sendiri,
> tanpa VPS, tanpa langganan. Pelanggan memesan lewat QR di meja.

Status: Milestone 4 dibangun (QRIS otomatis, cadangan, dan aset installer Windows).
Lisensi: AGPL-3.0. Pembuat: @MarchAja.

> Catatan pelaksanaan: keputusan 63–66 (M1 + watermark), 67–73 (M2),
> 74–79 (M3), dan 80–86 (M4) mencatat penyesuaian saat implementasi.
> Semua empat milestone sudah terbangun.

---

## 1. Ringkasan

KasirIn adalah aplikasi point-of-sale untuk **satu outlet F&B** dengan layanan
**makan di tempat**. Pelanggan memindai QR yang ditempel di meja, melihat menu,
dan mengirim pesanan dari HP. Staf menerima pesanan di layar kasir, pesanan masuk
antrean, dan seluruh pesanan selama satu kunjungan meja digabung ke satu tagihan.

Aplikasi berjalan sepenuhnya di komputer kasir. Tidak ada server sewaan. Akses
pelanggan dari data seluler bersifat opsional lewat tunnel (ngrok).

**Pembeda utama:** pemasangan sekali klik di Windows dan tanpa PHP/MySQL/Docker.
Kompetitor open source terdekat (mis. Dikasir) sudah punya menu QR meja, jadi
kita bersaing di kemudahan pasang dan kesederhanaan operasional, bukan jumlah fitur.

---

## 2. Pengguna

| Peran | Kebutuhan utama |
|---|---|
| Pelanggan | Pesan tanpa install aplikasi, tanpa membuat akun |
| Kasir | Menerima pesanan cepat, menagih, menutup meja |
| Pemilik | Mengelola menu, meja, pembayaran, melihat ringkasan harian |

Tidak ada akun pelanggan. Tidak ada data pribadi pelanggan yang disimpan.

---

## 3. Lingkup MVP

### Termasuk

- Menu dengan kategori, harga tetap, satu foto per item, catatan per item.
- Addon per menu: grup yang dapat dipakai ulang, `min`/`max` pilihan, grup
  wajib opsional, harga Rp0 atau menambah, addon dapat ditandai habis sendiri.
- Penanda "habis" per menu dan per addon (tanpa manajemen stok bahan).
- Meja 1–30, QR per meja, cetak semua QR dalam satu lembar A4.
- Pemesanan pelanggan lewat QR, tanpa login.
- Persetujuan pesanan oleh staf; pesanan pertama membuka kunjungan meja.
- Satu tagihan per kunjungan; pesanan tambahan masuk ke tagihan yang sama.
- Status pesanan: `baru` → `diterima` → `disajikan` → `ditutup`, plus `dibatalkan`.
- Pembayaran manual (tunai / QRIS dicek kasir).
- Pembayaran otomatis QRIS dinamis (Midtrans) sebagai adaptor pertama.
- Mode pembayaran dapat diatur: manual saja, otomatis saja, atau keduanya
  (pelanggan memilih).
- Pajak (PB1) dan service charge opsional, default mati.
- Diskon manual per tagihan, hanya pemilik, dengan alasan tercatat.
- Ringkasan tutup hari: total diterima, rincian per metode, tagihan masih terbuka.
- Cadangan harian otomatis + ekspor ke folder pilihan.
- Mode demo dengan menu contoh.
- Akses pelanggan lewat Wi-Fi lokal atau tunnel (ngrok) — opsional.

### Tidak termasuk (MVP)

- Stok bahan / resep / HPP.
- Pisah bill dan pindah meja.
- Layanan takeaway dan delivery.
- Varian harga (ukuran) — dibuat sebagai item terpisah. Addon bukan varian:
  harga dasar item tetap dan addon adalah tambahan per baris pesanan.
- Harga addon negatif (pengurangan).
- Layar dapur terpisah dan printer ESC/POS langsung.
- Refund lewat aplikasi.
- Multi-outlet, multi-terminal kasir, sinkronisasi cloud.
- Akun pelanggan, loyalty, promo otomatis.
- Pemesanan lewat WhatsApp.

---

## 4. Alur utama

### 4.1 Pelanggan

1. Scan QR di meja → halaman menu `https://<host>/m/<token-meja>`.
2. Item tanpa addon: tombol `+` langsung memasukkan ke keranjang.
3. Item dengan addon: tombol `Pilih` membuka sheet addon. Grup opsional
   menampilkan pilihan "Tanpa tambahan" (Rp0) yang terpilih default.
4. Atur jumlah, tulis catatan (mis. "tanpa es"), kirim pesanan.
5. Halaman status menampilkan: pesanan diterima, sedang disiapkan, total tagihan.
4. Membuka QR yang sama lagi menampilkan status dan tagihan berjalan.
5. Jika mode otomatis aktif, pelanggan boleh memilih **Bayar dari HP** atau
   **Bayar di kasir**.

### 4.2 Kasir

1. Pesanan baru muncul di antrean (polling 3 detik).
2. Staf menerima pesanan → kunjungan meja terbuka, pesanan masuk antrean dapur.
3. Pesanan tambahan dari meja yang sama masuk ke tagihan yang sama.
4. Staf dapat membatalkan item sebelum dibayar, dengan alasan tersimpan.
5. Pembayaran manual: kasir memilih tunai/QRIS, menandai lunas.
6. Pembayaran otomatis: kasir membuat tagihan QRIS, pelanggan membayar,
   status diperbarui lewat webhook atau tombol *Cek status pembayaran*.
7. Kasir menutup kunjungan setelah pelanggan selesai; meja siap dipakai lagi.

### 4.3 Pemilik

1. Mengelola menu, kategori, foto, dan penanda habis.
2. Mengelola meja dan mencetak QR.
3. Mengatur pajak, service charge, dan mode pembayaran.
4. Menghubungkan akun Midtrans (sandbox/produksi).
5. Memberi diskon dengan PIN pemilik.
6. Melihat ringkasan harian dan mengunduh cadangan.

---

## 5. Aturan bisnis

### 5.1 Tagihan

- Satu tagihan per kunjungan meja, dibuka saat staf menerima pesanan pertama.
- Pesanan tambahan selama kunjungan berjalan menambah tagihan yang sama.
- Tagihan ditutup manual oleh kasir, bukan otomatis saat lunas.
- Setelah tagihan ditutup, pembayaran berikutnya di meja yang sama menjadi
  tagihan baru (sisa tagihan bila pelanggan memesan lagi sebelum tutup).
- Nominal pajak dan service charge dihitung saat tagihan ditutup, ditampilkan
  terpisah di struk dan ringkasan harian.

### 5.2 Status pesanan

```
baru ──terima──> diterima ──sajikan──> disajikan ──tutup──> ditutup
  │                  │
  └──batal──> dibatalkan <──batal──┘
```

- Dapur mulai bekerja setelah staf menerima pesanan (bukan setelah lunas).
- Pembatalan item hanya sebelum tagihan dibayar dan wajib menyimpan alasan.

### 5.3 Pembayaran otomatis

- Nominal tagihan **terkunci** selama pembayaran otomatis berstatus tertunda.
- Pesanan tambahan ditahan sampai pembayaran final (lunas / kedaluwarsa / batal).
- Jika kedaluwarsa atau dibatalkan, kasir dapat menerima tambahan lalu membuat
  QRIS baru dengan nominal terbaru.
- Webhook tidak selalu bisa mencapai komputer kasir (ngrok mati atau alamat
  berubah). Karena itu layar kasir **wajib** punya tombol *Cek status pembayaran*
  yang menanyakan langsung ke API penyedia. Ini syarat, bukan fitur tambahan.
- Bila koneksi bermasalah, kasir boleh beralih ke pembayaran manual. Jika QRIS
  sudah dibuat dan statusnya belum jelas, tagihan ditandai **perlu dicek** dan
  kasir harus memverifikasi sebelum menagih ulang.

### 5.4 Diskon

- Diskon diberikan per tagihan (nominal atau persen).
- Hanya pemilik; kasir diminta PIN pemilik saat memberi diskon.
- Alasan diskon wajib diisi dan tersimpan di riwayat.

### 5.5 Pajak dan service charge

- Keduanya pengaturan, default mati.
- Nilai default usulan: PB1 10%, service charge 0–10%.
- Ditampilkan terpisah pada struk dan ringkasan harian.

### 5.6 Addon

- Addon disusun dalam **grup yang dapat dipakai ulang** lintas menu
  (mis. "Level pedas" untuk semua makanan).
- Setiap grup punya `min` dan `max` pilihan. `max = 1` tampil sebagai radio,
  `max > 1` sebagai checkbox. Flag `wajib` didukung, default mati.
- Item tanpa addon: tombol `+` langsung memasukkan ke keranjang.
- Item dengan addon: tombol `Pilih` membuka sheet.
- Grup opsional selalu menampilkan pilihan pertama **"Tanpa tambahan" (Rp0)**
  dan terpilih default. Grup wajib tidak menampilkan pilihan itu, dan tombol
  `Tambah` nonaktif sampai syarat terpenuhi.
- Harga addon Rp0 atau menambah. Harga negatif tidak didukung.
- Satu pilihan = satu unit. Untuk dua telur, pemilik membuat addon "Telur ×2".
- Satu baris keranjang = satu kombinasi item + addon + catatan. Dua nasi goreng,
  satu pakai telur, menjadi dua baris. Menambah qty mengalikan harga satuan
  (dasar + addon).
- Nama dan harga addon disalin ke pesanan (snapshot) agar riwayat tidak berubah.
- Addon dapat ditandai habis tanpa mematikan item induknya.
- Di tagihan, tiket dapur, dan struk, addon tampil sebagai baris menjorok di
  bawah item, lengkap dengan jumlahnya.

---

## 6. Data dan privasi

- Tidak ada akun pelanggan, tidak ada nama atau nomor HP.
- Pesanan dikenali dari token meja acak.
- Tidak ada data pribadi yang disimpan → kewajiban UU PDP ringan.
- Data lokal: SQLite, foto menu, dan cadangan.

---

## 7. Arsitektur dan teknologi

| Lapisan | Pilihan |
|---|---|
| Bahasa | TypeScript |
| Server | Node 22 + Fastify |
| Basis data | SQLite (better-sqlite3) + migrasi |
| Frontend | React + Vite + Tailwind |
| Pembaruan layar | Polling 3 detik (tanpa WebSocket/SSE) |
| Pembayaran | Antarmuka `PaymentProvider`, adaptor Midtrans pertama |
| Target OS | Windows (uji utama), macOS/Linux untuk pengembangan |
| Distribusi | `start.bat` untuk MVP → satu `.exe` + installer NSIS |
| Lisensi | AGPL-3.0 |

Satu proses server melayani dua muka: layar kasir/pemilik di jaringan lokal dan
halaman pelanggan lewat tunnel atau Wi-Fi.

### 7.1 Asumsi teknis

| Asumsi | Nilai |
|---|---|
| Terminal kasir | Satu komputer, satu sesi kasir aktif |
| Mata uang | IDR, format `Rp80.000` |
| Alamat QR | `https://<host>/m/<token-meja>` |
| Lokasi data | `%LOCALAPPDATA%\KasirIn\data` |
| Port lokal | 3000, dapat diubah |
| Diskon | PIN pemilik diminta saat kasir memberi diskon |
| Midtrans | Sandbox dulu; kunci produksi diisi pemilik |
| ngrok | Dipasang manual; POS menampilkan panduan dan status tunnel |
| Cetak struk | Dialog cetak browser (driver printer thermal dari OS) |

### 7.2 Model data awal

```
outlet          id, nama, alamat, pajak_persen, service_persen, mode_bayar
pengguna        id, nama, peran(owner|kasir), pin_hash / password_hash
kategori        id, nama, urutan
menu_item       id, kategori_id, nama, harga, foto_path, habis, aktif
addon_grup      id, nama, min_pilih, max_pilih, wajib, urutan
addon           id, grup_id, nama, harga, habis, aktif, urutan
menu_addon      menu_item_id, grup_id, urutan
meja            id, nomor, token, aktif
kunjungan       id, meja_id, dibuka_pada, ditutup_pada, status
pesanan         id, kunjungan_id, status, dibuat_pada, diterima_oleh
pesanan_item    id, pesanan_id, menu_item_id, nama_snapshot, harga_snapshot,
                jumlah, catatan, status, alasan_batal
item_addon      id, pesanan_item_id, addon_id, nama_snapshot, harga_snapshot,
                grup_snapshot
tagihan         id, kunjungan_id, subtotal, diskon, pajak, service, total, status
pembayaran      id, tagihan_id, metode, nominal, status, provider_ref,
                dibuat_pada, final_pada
pengaturan      key, value
audit_log       id, pengguna_id, aksi, entitas, entitas_id, detail, waktu
```

Harga dan nama item disalin ke `pesanan_item` agar riwayat tidak berubah saat
menu diedit.

---

## 8. Keamanan dan akses

- Kasir: PIN 4–6 angka dengan numpad. Pemilik: password.
- Sesi kasir terkunci otomatis setelah 15 menit idle.
- Halaman pelanggan tidak butuh login; token meja bersifat acak dan tidak
  dapat ditebak.
- Panel kasir dan pemilik hanya tersedia di jaringan lokal.
- Hanya halaman menu/pemesanan pelanggan yang dibuka lewat tunnel.

---

## 9. Operasional

### 9.1 Ringkasan tutup hari

- Total pembayaran diterima hari itu.
- Rincian per metode bayar.
- Tagihan yang masih terbuka dan tagihan *perlu dicek*.
- Diskon yang diberikan beserta alasannya.

### 9.2 Cadangan

- Cadangan harian otomatis.
- Ekspor manual ke folder pilihan.
- Salinan disarankan disimpan di perangkat lain.

### 9.3 Mode akses pelanggan

| Mode | QR berisi | Syarat |
|---|---|---|
| Wi-Fi lokal | `http://<ip-lokal>:3000/m/<token>` | Pelanggan tersambung Wi-Fi outlet |
| Tunnel | `https://<nama>.ngrok-free.app/m/<token>` | Komputer kasir + internet aktif |

Catatan ngrok gratis: alamat tetap per akun, batas 20.000 permintaan HTTP dan
1 GB transfer keluar per bulan, serta ada layar peringatan sekali per 7 hari per
perangkat pelanggan. Satu pesanan memakai beberapa permintaan.

---

## 10. Milestone

| # | Isi | Hasil |
|---|---|---|
| 1 | Fondasi: skema DB, migrasi, auth PIN/password, meja, menu, mode demo | Aplikasi bisa dijalankan dan diisi data |
| 2 | Alur pelanggan: QR, menu, keranjang, kirim pesanan, halaman status | Pesanan masuk ke sistem |
| 3 | Alur kasir: terima, tagihan, bayar manual, tutup meja, ringkasan harian | **Satu warung bisa beroperasi penuh** |
| 4 | QRIS otomatis + cadangan otomatis + installer Windows | Siap dipakai tanpa didampingi |

Milestone 3 adalah titik layak pakai. Pembayaran otomatis bukan syarat operasi.

---

## 11. Pengujian dan CI

- GitHub Actions sejak commit pertama.
- Lint + typecheck + unit test.
- Satu tes integrasi alur pesan → terima → bayar → tutup dengan SQLite sementara.
- E2E Playwright menyusul setelah UI stabil.

---

## 12. Tata kelola proyek

- Repo: `github.com/<akun-pribadi>/kasirin`.
- `README.md` Bahasa Indonesia.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, template issue/PR.
- `AGENTS.md` untuk agen AI.
- Antarmuka Bahasa Indonesia; seluruh teks di satu file terpusat agar i18n mudah.

---

## 13. Risiko

| Risiko | Mitigasi |
|---|---|
| Webhook pembayaran tidak sampai ke lokal | Tombol cek status langsung ke API; tandai *perlu dicek* |
| Alamat tunnel berubah | Halaman cetak ulang QR; token meja tidak berubah |
| Kuota ngrok gratis habis | Mode Wi-Fi lokal sebagai jalur utama; tunnel hanya opsional |
| Komputer kasir rusak | Cadangan harian + ekspor ke folder/perangkat lain |
| Fitur melebar (stok, split bill) | Daftar non-lingkup di atas dijadikan acuan |

---

## 14. Log keputusan

| # | Keputusan |
|---|---|
| 1 | Pengguna pertama: pelaku F&B yang mudah ditemui; utamakan penggunaan nyata |
| 2 | Berjalan lokal, tanpa VPS atau layanan berbayar |
| 3 | QR di meja untuk pelanggan memesan sendiri |
| 4 | Akses data seluler opsional lewat tunnel (ngrok) |
| 5 | Cakupan: semua F&B, mulai dari satu outlet makan di tempat |
| 6 | Staf menerima pesanan sebelum diteruskan ke dapur |
| 7 | Pembayaran manual dan otomatis, dapat diatur di pengaturan |
| 8 | Otomatis memakai QRIS dinamis dari satu penyedia |
| 9 | Biaya per transaksi penyedia dapat diterima |
| 10 | Pelanggan memilih sendiri metode bayar |
| 11 | Dapur mulai setelah staf menerima, bukan setelah lunas |
| 12 | Satu tagihan per kunjungan meja |
| 13 | Antrean pesanan di layar kasir; layar dapur menyusul |
| 14 | Kunjungan dibuka oleh penerimaan pesanan pertama |
| 15 | Nominal terkunci selama pembayaran otomatis tertunda |
| 16 | Kasir boleh beralih ke manual saat internet bermasalah |
| 17 | Windows sebagai target instalasi pertama |
| 18 | Lisensi AGPL-3.0 |
| 19 | Saat tunnel mati, pelanggan dibantu kasir |
| 20 | Kasir menutup kunjungan setelah pelanggan selesai |
| 21 | Item berharga tetap + catatan; tanpa varian |
| 22 | Setiap outlet memakai akun merchant sendiri |
| 23 | Cadangan harian otomatis + ekspor manual |
| 24 | Kasir dapat membatalkan item sebelum dibayar, dengan alasan |
| 25 | Ringkasan harian: total diterima, per metode, tagihan terbuka |
| 26 | Dua peran: pemilik dan kasir |
| 27 | Stack TypeScript + Fastify + SQLite + React |
| 28 | Mode demo dengan menu contoh sejak awal |
| 29 | Midtrans sebagai adaptor pembayaran pertama |
| 30 | Pajak dan service charge opsional, default mati |
| 31 | Status: baru, diterima, disajikan, ditutup, dibatalkan |
| 32 | Polling 3 detik |
| 33 | UI Bahasa Indonesia, siap i18n |
| 34 | Nama proyek: KasirIn |
| 35 | MVP pakai `start.bat`, installer menyusul |
| 36 | PIN kasir, password pemilik, kunci idle 15 menit |
| 37 | Struk lewat dialog cetak browser |
| 38 | Satu foto per menu, maksimal 800px |
| 39 | Halaman meja + cetak QR satu lembar A4, 1–30 meja |
| 40 | CI: lint, typecheck, unit, satu tes integrasi |
| 41 | Empat milestone, milestone 3 adalah titik layak pakai |
| 42 | Berkas repo lengkap sejak awal, termasuk `AGENTS.md` |
| 43 | Tanpa stok bahan; cukup penanda habis |
| 44 | Diskon manual per tagihan, hanya pemilik, dengan alasan |
| 45 | Pelanggan tanpa nama/nomor HP |
| 46 | Halaman status pesanan per meja |
| 47 | Pisah bill dan pindah meja di luar MVP |
| 48 | Repo di akun GitHub pribadi |
| 49 | Asumsi teknis pada §7.1 diterima |
| 50 | Mulai Milestone 1 setelah spesifikasi ini ditulis |
| 51 | Layar kasir berbentuk papan meja, bukan feed pesanan |
| 52 | Nada visual: kertas hangat + hijau pandan, mode gelap tidak masuk MVP |
| 53 | Prototipe HTML statis dibuat sebelum Milestone 1 |
| 54 | Addon memakai grup yang dapat dipakai ulang lintas menu |
| 55 | Grup addon punya min/max; radio bila max 1, checkbox bila lebih |
| 56 | Harga addon Rp0 atau menambah, tidak boleh negatif |
| 57 | Satu pilihan addon = satu unit |
| 58 | Addon dapat ditandai habis sendiri |
| 59 | Panel pemilik hanya untuk desktop pada MVP |
| 60 | Prototipe pertama: kasir, menu pelanggan, sheet addon |
| 61 | Near-monochrome, status berupa titik berwarna |
| 62 | Mockup disimpan di `docs/mockups/` |
| 63 | Watermark mockup: `KasirIn · @MarchAja · Open Source · AGPL-3.0` |
| 64 | Build M1 memakai npm workspaces: `apps/server` dan `apps/web` |
| 65 | Kontrak API didefinisikan lokal per workspace, tanpa paket `shared` |
| 66 | Kredensial demo: PIN kasir `123456`, kata sandi pemilik `owner123`, dapat diubah lewat env |
| 67 | QR meja mengarah ke `/m/<token>`; halaman pelanggan tanpa login |
| 68 | Kunjungan dibuka saat pesanan pertama dikirim; pesanan berikutnya masuk tagihan yang sama |
| 69 | Baris tagihan dibuat saat kasir menerima pesanan pertama, bukan saat pesanan dikirim |
| 70 | Validasi addon (grup terkait, wajib/min/max, habis) dilakukan di server, bukan hanya UI |
| 71 | Nama dan harga addon disalin ke `item_addon` sebagai snapshot |
| 72 | Antrean kasir dan halaman status pelanggan memakai polling 3 detik |
| 73 | QR dicetak dari panel pemilik memakai `qrcode`; URL dihasilkan dari asal halaman + token meja |
| 74 | Diskon memakai PIN pemilik terpisah (`KASIRIN_OWNER_PIN`, demo `246810`) dan alasan wajib |
| 75 | Pajak & service dihitung ulang dari pengaturan outlet setiap tagihan berubah |
| 76 | QRIS manual yang belum jelas ditandai `perlu_dicek`; kasir mengonfirmasi sebelum menutup meja |
| 77 | Meja hanya bisa ditutup setelah tagihan lunas; tagihan berstatus `ditutup`, bukan dihapus |
| 78 | Setelah meja ditutup, pesanan berikutnya membuka kunjungan dan tagihan baru |
| 79 | Ringkasan harian dihitung dari pembayaran lunas hari berjalan (waktu lokal) |
| 80 | Antarmuka `PenyediaBayar` dengan adaptor Midtrans dan adaptor simulasi untuk demo tanpa kredensial |
| 81 | QRIS bisa dibuat kasir maupun pelanggan; mode bayar `manual` menonaktifkan keduanya |
| 82 | Tagihan dikunci (`tertunda` / `perlu_dicek`) sampai status final; QRIS dibatalkan mengembalikan ke `buka` |
| 83 | Tombol cek status langsung ke API penyedia wajib ada; kegagalan menandai `perlu_dicek` |
| 84 | Webhook Midtrans diverifikasi dengan signature SHA-512 |
| 85 | Cadangan SQLite harian otomatis dengan retensi 7 berkas + ekspor manual ke folder pilihan |
| 86 | `.exe` tidak dibuat di macOS; workflow `release-windows.yml` membangunnya di runner Windows |
