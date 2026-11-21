# Ide yang Dipertimbangkan

Catatan ini menyimpan ide-ide yang muncul selama sesi desain, termasuk yang
tidak dipilih, agar tidak hilang dan bisa ditinjau ulang nanti.

## Kandidat proyek awal (sebelum memilih POS)

| Ide | Alasan dipertimbangkan | Keputusan |
|---|---|---|
| Rekap pesanan WhatsApp untuk pre-order rumahan | Masalah nyata, bisa diuji tanpa integrasi API | Tidak dipilih |
| Kalkulator HPP dan harga jual | Paling cepat selesai, cocok proyek pertama | Tidak dipilih |
| Buku piutang warung | Sederhana, banyak warung memakai bon | Tidak dipilih |
| Rekap pencairan marketplace | Berguna untuk penjual online | Tidak dipilih |
| POS dengan QR di tiap meja | Alur jelas, dampak langsung ke operasional F&B | **Dipilih** |

Alasan memilih POS QR meja: pengguna bisa langsung mencoba tanpa instalasi,
nilainya terasa di operasional harian, dan cakupannya masih bisa dijaga kecil.

## Ide fitur yang ditunda

| Ide | Alasan ditunda |
|---|---|
| Stok bahan dan resep | Proyek tersendiri; bukan alasan orang memakai QR meja |
| Pisah bill | Butuh model data baru; tunggu permintaan nyata |
| Pindah meja | Bisa jadi satu tombol di layar kasir setelah MVP |
| Takeaway dan delivery | Alur berbeda; MVP fokus makan di tempat |
| Layar dapur terpisah | Antrean di layar kasir sudah cukup untuk satu outlet |
| Printer thermal ESC/POS langsung | Dialog cetak browser sudah didukung driver OS |
| Refund lewat aplikasi | Alur pembatalan + catatan manual dulu |
| Varian harga (ukuran, topping) | Dibuat sebagai item terpisah agar model data tetap sederhana |
| Akun pelanggan, loyalty, promo otomatis | Menambah data pribadi dan kompleksitas |
| Pemesanan lewat WhatsApp | Kanal lain, bukan inti masalah meja |
| Multi-outlet dan multi-terminal | Satu outlet, satu kasir dulu |
| Sinkronisasi cloud | Bertentangan dengan prinsip tanpa VPS |

## Ide akses pelanggan

- **Wi-Fi lokal** — QR berisi alamat IP lokal. Tidak butuh internet, tapi
  pelanggan harus tersambung ke Wi-Fi outlet.
- **Tunnel (ngrok)** — QR berisi alamat publik. Pelanggan bisa memakai data
  seluler, tapi komputer kasir dan internet harus aktif. Paket gratis membatasi
  20.000 permintaan HTTP dan 1 GB transfer per bulan serta menampilkan layar
  peringatan sekali per 7 hari per perangkat.
- **Cloudflare Quick Tunnel** — tanpa akun, tapi alamat berubah setiap kali
  dijalankan dan tidak mendukung SSE. Tidak dipilih untuk QR cetak.

Keputusan: keduanya didukung, tunnel bersifat opsional dan diaktifkan pemilik.

## Ide pembayaran

- Manual: tunai, atau QRIS statis yang dicek kasir.
- Otomatis: QRIS dinamis per tagihan lewat penyedia (Midtrans sebagai adaptor
  pertama), dengan antarmuka `PaymentProvider` agar Xendit/Duitku/DOKU bisa
  ditambah.
- Keduanya bisa aktif bersamaan; pelanggan memilih.

## Ide nama

KasirIn (dipilih), Meja, Warungin, PesanDulu, Kursi.

Catatan: paket npm `kasirin` masih tersedia; akun GitHub `kasirin` sudah dipakai
orang lain, jadi repo memakai `github.com/<akun-pribadi>/kasirin`.
