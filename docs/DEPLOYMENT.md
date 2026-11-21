# Panduan Deployment KasirIn

KasirIn adalah POS open source untuk UMKM F&B Indonesia. Aplikasi berjalan
sepenuhnya di **satu komputer kasir** — tanpa VPS, tanpa langganan. Pelanggan
memesan lewat QR di meja, kasir mengelola pesanan dan tagihan.

- Lisensi: **AGPL-3.0** (lihat [`LICENSE`](../LICENSE)).
- Repositori: <https://github.com/MarchAja/kasirin>
- Dibuat oleh [@MarchAja](https://github.com/MarchAja).

Dokumen ini menjelaskan tiga cara menjalankan KasirIn, tempat penyimpanan data,
pengaturan lingkungan, akses pelanggan, firewall, dan cadangan.

---

## 1. Tiga cara menjalankan KasirIn

### Cara A — Pengembangan (sehari-hari saat mengubah kode)

Butuh **Node.js 22 atau lebih baru**. Dari akar repositori:

```bash
npm install
npm run dev
```

Perintah ini menyalakan dua proses sekaligus: API di `http://localhost:3000`
dan web (Vite) di `http://localhost:5173`. Buka **http://localhost:5173**.
Data demo ditanam otomatis saat mode demo aktif. Perintah lain yang berguna:
`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

> Mode pengembangan memakai folder data `./data` di akar repositori dan bukan
> untuk operasi warung sehari-hari.

### Cara B — Produksi dari sumber di Windows (MVP launcher)

Ini cara memakai KasirIn langsung dari sumber (installer `.exe` masih coming
soon). Butuh Node.js 22+ dan Visual Studio Build Tools untuk `better-sqlite3`.

1. Unduh/ekstrak repositori ke folder, misalnya `C:\KasirIn`.
2. Buka **Command Prompt** di folder tersebut, lalu jalankan:

   ```bat
   npm ci
   npm run build
   start.bat
   ```

3. Buka **http://localhost:3000** di browser. Server menyajikan API **dan**
   berkas web yang sudah di-build dalam satu proses (port 3000).

`start.bat` sudah mengecek Node.js minimal versi 22 dan otomatis mengarahkan
`KASIRIN_DATA_DIR` ke `%LOCALAPPDATA%\KasirIn\data` bila belum diatur.
Biarkan jendela Command Prompt tetap terbuka selama KasirIn dipakai; menutupnya
akan menghentikan server.

### Cara C — ZIP portabel dari halaman rilis

> **Installer `.exe` — coming soon.** Untuk sementara, rilis hanya menyertakan
> `KasirIn-windows.zip`. Skrip NSIS tetap ada di repo dan bisa dipakai untuk
> membangun installer secara lokal, tetapi berkasnya belum dipublikasikan.

1. Unduh `KasirIn-windows.zip` dari
   https://github.com/MarchAja/kasirin/releases/latest
2. Ekstrak ke folder, misalnya `C:\KasirIn`.
3. Jalankan `run.cmd` di folder tersebut.
4. Buka http://localhost:3000 di browser.

ZIP sudah **menyertakan `node_modules`** hasil build di Windows, sehingga tidak
perlu `npm ci` dan tidak perlu Visual Studio Build Tools di komputer kasir.
Satu-satunya prasyarat adalah **Node.js 22+** terpasang. `run.cmd` otomatis
mengarahkan data ke `%LOCALAPPDATA%\KasirIn\data`.

Alur singkat pemakaian harian:

1. Masuk sebagai **pemilik**, buka **Meja & QR**, cetak QR setiap meja.
2. Tempel QR di meja. Pelanggan memindai dan mengirim pesanan (tanpa login).
3. Di layar kasir, terima pesanan → sajikan → bayar (tunai/QRIS) → tutup meja.
4. Tutup hari: lihat **Ringkasan** untuk omzet, metode bayar, dan diskon.

---

## 2. Lokasi data

Semua data lokal — basis data SQLite, foto menu, dan cadangan — berada dalam
satu folder data:

| Cara menjalankan | Folder data |
|---|---|
| Pengembangan (`npm run dev`) | `./data` di akar repositori |
| Produksi dari sumber / installer | `%LOCALAPPDATA%\KasirIn\data` |

Di Windows, `%LOCALAPPDATA%` biasanya `C:\Users\<nama>\AppData\Local`. Isinya:

```
%LOCALAPPDATA%\KasirIn\data\
├── kasirin.db      <- basis data SQLite (semua transaksi & pengaturan)
├── uploads\        <- foto menu yang diunggah
└── backups\        <- cadangan otomatis harian
```

Pesanan pelanggan dikenali dari **token meja acak**. KasirIn tidak menyimpan
nama atau nomor HP pelanggan.

---

## 3. Mengubah port dan folder data

Semua pengaturan dibaca dari variabel lingkungan. Daftar lengkap nama dan nilai
default ada di [`.env.example`](../.env.example) di akar repositori. Yang paling
sering diubah:

| Variabel | Default | Fungsi |
|---|---|---|
| `PORT` | `3000` | Port HTTP server |
| `HOST` | `0.0.0.0` | Alamat dengar (biarkan untuk akses LAN) |
| `KASIRIN_DATA_DIR` | `./data` | Folder basis data, unggahan, dan cadangan |
| `KASIRIN_DEMO` | `1` | `1` = aktifkan menu demo, `0` = matikan |

Contoh di **Command Prompt** Windows sebelum menjalankan `start.bat`:

```bat
set PORT=8080
set "KASIRIN_DATA_DIR=D:\KasirInData"
start.bat
```

Pada paket installer, ubah baris `set "KASIRIN_DATA_DIR=..."` di dalam
`run.cmd` bila ingin memindahkan data ke drive lain (misalnya SSD/D drive
terpisah). Pastikan folder tujuan ada dan dapat ditulis.

> Node 22 dapat memuat berkas `.env` lewat `node --env-file=.env ...`.
> `.env.example` adalah referensi; salin menjadi `.env` lalu isi nilainya bila
> ingin memakai cara tersebut. Jangan pernah memasukkan kunci produksi
> (Midtrans, ngrok) ke dalam repositori.

---

## 4. Kredensial demo saat pertama kali

Saat `KASIRIN_DEMO=1` (default), akun contoh siap dipakai:

| Peran | Kredensial |
|---|---|
| Kasir | PIN `123456` |
| Pemilik | kata sandi `owner123` |
| Diskon pemilik | PIN `246810` (diminta saat memberi diskon) |

Nilai tersebut dapat diubah lewat `KASIRIN_KASIR_PIN`,
`KASIRIN_OWNER_PASSWORD`, dan `KASIRIN_OWNER_PIN` — lihat `.env.example`.
**Ganti kredensial default sebelum dipakai untuk transaksi nyata.**

---

## 5. Akses pelanggan: Wi-Fi lokal atau tunnel ngrok

Ada dua mode akses untuk halaman pelanggan (QR meja):

| Mode | Isi QR | Syarat |
|---|---|---|
| **Wi-Fi lokal** (utama) | `http://<ip-lokal>:3000/m/<token>` | Pelanggan tersambung Wi-Fi outlet yang sama dengan komputer kasir |
| **Tunnel ngrok** (opsional) | `https://<nama>.ngrok-free.app/m/<token>` | Komputer kasir menyala dan terhubung internet |

Cara memakai tunnel ngrok:

1. Pasang ngrok dari <https://ngrok.com/download> dan autentikasi
   (`ngrok config add-authtoken <token>`, token juga bisa diisi lewat
   `NGROK_AUTHTOKEN` di `.env.example`).
2. Dengan KasirIn berjalan di port 3000, jalankan di terminal lain:

   ```bash
   ngrok http 3000
   ```

3. Salin alamat `https://...ngrok-free.app` yang muncul, lalu atur sebagai host
   QR di panel pemilik.
4. **Cetak ulang QR meja setiap kali alamat tunnel berubah.** Alamat ngrok
   (khususnya paket gratis) berubah setiap kali ngrok dijalankan ulang, tetapi
   **token meja tidak berubah** — cukup perbarui alamatnya, data meja tetap.

Catatan paket gratis ngrok: alamat relatif stabil per akun, kuota 20.000
permintaan HTTP dan 1 GB transfer keluar per bulan, serta ada layar peringatan
sekali per 7 hari per perangkat pelanggan. Satu pesanan memakai beberapa
permintaan. Karena itu, **Wi-Fi lokal tetap disarankan sebagai jalur utama**;
tunnel hanya cadangan saat pelanggan memakai data seluler.

---

## 6. Firewall dan jaringan

- Izinkan **koneksi masuk TCP port 3000** (atau port yang Anda ubah lewat
  `PORT`) pada **jaringan privat**. Di Windows: *Windows Defender Firewall →
  Advanced settings → Inbound Rules → New Rule → Port → TCP → 3000 →
  Private → allow*.
- Panel kasir/pemilik hanya boleh diakses dari jaringan lokal outlet. Jangan
  meneruskan (`port forwarding`) port kasir ke internet.
- Halaman menu/pemesanan pelanggan yang boleh diakses dari luar hanyalah lewat
  tunnel ngrok, sesuai desain akses KasirIn.
- Untuk mengetahui alamat LAN komputer kasir: jalankan `ipconfig` dan cari
  **IPv4 Address** (mis. `192.168.1.10`). QR Wi-Fi lokal lalu berisi
  `http://192.168.1.10:3000/m/<token>`.
- Bila komputer kasir terhubung ke beberapa jaringan, pastikan profile
  jaringan yang dipakai bertanda **Private**, bukan **Public**.

---

## 7. Cadangan dan pemulihan

KasirIn membuat cadangan otomatis harian di `data\backups` dan menyediakan
ekspor manual dari panel pemilik. Salinan sebaiknya disimpan di perangkat lain
(flash disk / komputer lain).

**Cadangan manual — lakukan saat aplikasi sedang tidak dipakai:**

1. Tutup KasirIn (tutup jendela Command Prompt atau hentikan server).
2. Salin seluruh folder data, terutama:
   - `kasirin.db` — basis data SQLite (transaksi, meja, menu, pengaturan);
   - `uploads\` — foto menu;
   - `backups\` — cadangan otomatis (opsional, tapi disarankan ikut).
3. Simpan ke lokasi lain. Contoh menyalin lewat Command Prompt:

   ```bat
   xcopy /E /I /Y "%LOCALAPPDATA%\KasirIn\data" "D:\Backup\KasirIn\data"
   ```

**Pemulihan:**

1. Tutup KasirIn.
2. Kembalikan `kasirin.db` dan isi `uploads\` ke folder data
   (`%LOCALAPPDATA%\KasirIn\data`), timpa berkas lama.
3. Jalankan KasirIn kembali (`start.bat` atau `run.cmd`) dan cek data di panel
   pemilik.

> Jangan menyalin `kasirin.db` selagi server berjalan — basis data bisa dalam
> keadaan menulis dan salinan menjadi rusak. Selalu hentikan aplikasi dulu.

---

## 8. Membangun paket Windows

**Penting:** installer `.exe` **tidak bisa dibuat di macOS maupun Linux**. NSIS
dan `makensis` hanya berjalan di Windows. Karena itu pembuatan paket dilakukan
oleh alur otomatis GitHub Actions
[`.github/workflows/release-windows.yml`](../.github/workflows/release-windows.yml)
pada runner **Windows**, setiap kali tag `v*` didorong.

Untuk membangun sendiri **di komputer Windows**:

```bat
npm ci
npm run build
powershell -File scripts/build-windows.ps1
```

Skrip `scripts/build-windows.ps1` membuat staging `dist-windows/KasirIn`,
ZIP `dist-windows/KasirIn-windows.zip`, dan — bila `makensis` tersedia di PATH —
installer `dist-windows/KasirIn-Setup.exe`. NSIS bersifat **opsional**: tanpa
NSIS, ZIP tetap dihasilkan dan skrip hanya menampilkan peringatan. Lihat
[`installer/README.md`](../installer/README.md) untuk ringkasan singkat.

Di macOS/Linux Anda tetap bisa melakukan `npm ci`, `npm run build`, dan tes,
tetapi tidak bisa menghasilkan `.exe` Windows.

---

## Lisensi

KasirIn adalah perangkat lunak bebas berlisensi **AGPL-3.0**: Anda boleh
menggunakan, mempelajari, mengubah, dan mendistribusikannya dengan ketentuan
AGPL-3.0. Sumber lengkap: <https://github.com/MarchAja/kasirin> · teks lisensi:
[`LICENSE`](../LICENSE).
