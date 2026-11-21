# Berkontribusi ke KasirIn

Terima kasih sudah mau membantu KasirIn. Sebelum mulai, baca
[`docs/SPEC.md`](docs/SPEC.md) untuk ruang lingkup dan aturan bisnis, serta
[`docs/DESIGN.md`](docs/DESIGN.md) untuk sistem desain.

## Menjalankan secara lokal

Butuh **Node.js 22 atau lebih baru** dan npm.

```bash
git clone https://github.com/MarchAja/kasirin.git
cd kasirin
npm install
cp .env.example .env      # lalu isi nilai yang dibutuhkan (Windows: salin & ganti nama)
npm run dev
```

Perintah yang biasa dipakai (dari akar repositori):

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Menjalankan server dan web saat pengembangan |
| `npm run build` | Build produksi semua workspace |
| `npm run typecheck` | Cek tipe TypeScript |
| `npm test` | Menjalankan unit test dan test integrasi |
| `npm run lint` | Cek gaya kode / format |

Di Windows, `start.bat` dapat dipakai untuk menjalankan versi produksi dengan
cepat.

## Alur kontribusi

1. Buka issue terlebih dahulu untuk perubahan besar agar arahnya disepakati.
2. Buat branch dari `main` dengan nama berikut:
   - `feat/nama-fitur` — fitur baru
   - `fix/nama-bug` — perbaikan bug
   - `docs/nama-dokumen` — dokumentasi
   - `refactor/nama-bagian` — refactor tanpa ubah perilaku
   - `test/nama-bagian` — penambahan test
3. Awali pesan commit dengan tipe (`feat:`, `fix:`, `docs:`, `refactor:`,
   `test:`, `chore:`), diikuti deskripsi pendek dalam Bahasa Indonesia atau
   Inggris. Contoh: `fix: tagihan terkunci saat QRIS tertunda`.
4. Buka pull request ke `main`, tautkan issue yang relevan, dan isi checklist.
5. Tunggu CI hijau dan review sebelum digabung.

## Test yang wajib

- `npm run lint`, `npm run typecheck`, dan `npm test` **harus lulus** sebelum PR
  dibuka.
- Setiap perubahan logika bisnis harus disertai unit test.
- Perubahan pada alur pesan → terima → bayar → tutup harus menjaga test
  integrasi tetap lulus (SQLite sementara).
- Perubahan UI sebaiknya menyertakan screenshot sebelum/sesudah.

## Batasan lingkup

KasirIn sengaja sederhana. Perubahan **di luar** MVP tidak akan diterima
kecuali ada keputusan desain baru. Lihat daftar "Tidak termasuk (MVP)" dan
"Non-goals" di [`docs/SPEC.md`](docs/SPEC.md). Secara ringkas, jangan mengusulkan
dalam PR MVP ini:

- manajemen stok bahan, resep, atau HPP;
- pisah bill atau pindah meja;
- takeaway/delivery;
- varian harga/ukuran dan harga addon negatif;
- layar dapur terpisah atau printer ESC/POS;
- refund, multi-outlet, sinkronisasi cloud;
- akun pelanggan, loyalty, promo otomatis, pemesanan via WhatsApp.

Teks antarmuka wajib Bahasa Indonesia dan mengikuti token di `docs/DESIGN.md`.

## Perjanjian lisensi

KasirIn dilisensikan di bawah **GNU Affero General Public License v3.0**
(AGPL-3.0). Dengan berkontribusi, kamu menyetujui bahwa kontribusimu
(dokumen, kode, desain, dan aset) dilisensikan di bawah AGPL-3.0 tanpa syarat
tambahan, dan kamu memiliki hak untuk memberikan lisensi tersebut. Pastikan
kontribusimu tidak melanggar hak cipta pihak ketiga. Lihat berkas
[`LICENSE`](LICENSE) untuk teks lengkap.

## Kode etik

Semua partisipan tunduk pada [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
