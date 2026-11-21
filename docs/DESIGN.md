# KasirIn — Sistem Desain

> Hangat, berlapis, dan tenang. Foto dan warna dipakai untuk memberi hidup;
> garis, ruang, dan tipografi yang menjaga ketenangan.

## 1. Dua muka

| | Kasir & pemilik | Pelanggan |
|---|---|---|
| Mode | Operate | Pesan |
| Ukuran acuan | 1440×900 | 390×844 |
| Input | mouse + keyboard | satu tangan, sentuh |
| Prioritas | status meja dan tombol aksi | foto, harga, tombol tambah |
| Kepadatan | tinggi, kartu 44–68px | longgar, target 44px |
| Gerak | 140–240ms | sama |

Token sama, komposisi berbeda.

## 2. Prinsip

1. **Satu aksen, banyak permukaan.** Hijau pandan hanya untuk aksi dan status
   positif; sisanya kertas, putih, dan tint lembut.
2. **Warna = status.** Status memakai tint latar + titik, bukan blok jenuh.
3. **Kedalaman tipis.** Satu lapis bayangan halus memisahkan kartu dari kertas.
   Tidak ada bayangan berlapis atau efek kaca.
4. **Foto hanya di layar pelanggan.** Foto membuat menu terasa hidup; layar
   kasir tetap tenang.
5. **Ruang kosong mengelompokkan.** Jarak 24–32px antar bagian.
6. **Harga adalah raja di layar pelanggan.** Status adalah raja di layar kasir.
7. **Angka tabular.** Kolom harga dan total tidak bergoyang.
8. **Gerak punya alasan.** Hanya opacity dan transform, 140–240ms, dan selalu
   menghormati `prefers-reduced-motion`.

## 3. Token

```css
--paper:       #FAF6EF;  /* latar utama */
--paper-2:     #F3ECE1;  /* tint netral, chip, field */
--surface:     #FFFFFF;
--ink:         #1B1917;
--muted:       #7A7266;
--line:        #ECE3D5;

--accent:      #1D5C4B;
--accent-2:    #2A7A63;  /* hover */
--accent-soft: #E6F0EB;

--amber:       #B96F14;  --amber-soft: #FBEFDD;  /* baru */
--blue:        #2F6FB0;  --blue-soft:  #EAF2FA;  /* diterima */
--green:       #2E7D4F;  --green-soft: #E9F4EC;  /* disajikan */
--red:         #B23B3B;  --red-soft:   #FBE9E7;  /* perlu dicek */

--r-sm: 8px;  --r: 12px;  --r-lg: 16px;  --r-pill: 999px;

--shadow-1: 0 1px 2px rgba(27,25,23,.06), 0 1px 1px rgba(27,25,23,.03);
--shadow-2: 0 10px 24px -12px rgba(27,25,23,.25), 0 2px 6px rgba(27,25,23,.05);
--shadow-3: 0 24px 60px -20px rgba(27,25,23,.35);

--ease: cubic-bezier(.2,.8,.2,1);
--fast: 140ms;  --med: 240ms;
```

Tipografi: **Plus Jakarta Sans**, bobot 400/500/600/700.

| Peran | Ukuran |
|---|---|
| Label kecil | 11px, tracking 0.09em, uppercase, 600 |
| Teks kasir | 12.5–13.5px |
| Nama item pelanggan | 14.5px, 600 |
| Harga pelanggan | 14px, 700 |
| Judul layar | 21px, 700 |
| Total tagihan | 26px, 700 |
| Angka meja | 15–16px, 700 |

Spasi: skala 8px. Padding kartu 13–20px. Jarak antar bagian 24–32px.
Baris: 1.5 teks, 1.2 judul.
Bayangan: `shadow-1` untuk kartu harian, `shadow-2` untuk kartu yang sedang
aktif atau melayang, `shadow-3` untuk sheet dan bar keranjang.

## 4. Layar kasir

Tiga tata letak, satu sistem.

| Lebar layar | Tata letak | Catatan |
|---|---|---|
| ≥ 1201px (PC) | 3 kolom: 264 / 1fr / 420 | Kartu shift tampil jika tinggi ≥ 820px |
| 1001–1200px (tablet lanskap) | 3 kolom: 224 / 1fr / 344 | Ubin 62px, kartu lebih rapat |
| ≤ 1000px (tablet potret) | Bertumpuk: strip meja, antrean, tagihan di bawah | Jam disembunyikan, ringkasan harian & shift disembunyikan |

Di tablet potret, meja menjadi strip horizontal yang bisa digeser, antrean mengisi
sisa tinggi, dan tagihan menempel di bawah agar selalu terjangkau ibu jari.

```
┌──────────────────────────────────────────────────────────────┐
│ K KasirIn · Warung Bu Sri      ● Lokal  14:32  R Rina        │
├────────────┬──────────────────────────────┬──────────────────┤
│ MEJA       │ Pesanan baru  (2 menunggu)   │ ┌──────────────┐ │
│ 01 02 03   │ ┌──────────────────────────┐ │ │ 07 Meja 7    │ │
│ 04 05 06   │ │ 07 Meja 7  14:29         │ │ │ tagihan      │ │
│ 07 08 09   │ │ [2× Nasi][1× Es Teh]     │ │ │ [ Bayar ]    │ │
│ 10 11 12   │ │                  [Terima]│ │ └──────────────┘ │
│ ┌────────┐ │ └──────────────────────────┘ │ ┌──────────────┐ │
│ │Hari ini│ │ Berjalan                     │ │ Shift kamu   │ │
│ │1,24 jt │ │ Disajikan  Meja 5   Rp42.000 │ │ Tunai 420k   │ │
│ └────────┘ │ Diterima   Meja 3   Rp58.000 │ │ QRIS  820k   │ │
└────────────┴──────────────────────────────┴──────────────────┘
```

- Kolom meja 264px, tagihan 420px, sisanya antrean.
- Ubin meja: nomor, total singkat, titik status. Meja aktif memakai tint aksen
  dan border aksen.
- Kartu ringkasan harian di bawah ubin: omzet, jumlah pesanan, dan tujuh batang
  jam tersibuk.
- Kartu pesanan baru memakai garis kiri amber, badge meja, chip item, dan
  tombol `Terima` terisi.
- Pesanan berjalan memakai pill status bertint: hijau (disajikan), biru
  (diterima), merah (perlu dicek).
- Panel kanan berisi kartu tagihan (`shadow-2`) dan kartu shift kasir.
- Pintasan: `F2` terima, `F4` bayar, `Esc` tutup.

## 5. Layar pelanggan

Urutan: header outlet + meja → pencarian → favorit (rail horizontal) →
kategori → daftar menu → bar keranjang melayang.

- Foto item 74×74px, radius 10px, hanya di layar pelanggan.
- Kartu menu memakai `shadow-1`; hover mengangkat 1px.
- Item tanpa addon: tombol `+` bertint aksen. Item dengan addon: tombol `Pilih`.
- Item habis diredupkan 55% dan fotonya didesaturasi, dengan pill `Habis`.
- Rail favorit memakai scroll native + `scroll-snap-type: x mandatory` dan
  `overscroll-behavior-x: contain`; tidak ada auto-rotate.
- Bar keranjang melayang berisi tumpukan foto item, jumlah, total, dan tombol
  `Keranjang`.

### Sheet addon

- Native `<dialog>` yang dibuka dengan `showModal()`, bukan div overlay.
- Muncul dari bawah dengan radius 20px di sudut atas, latar putih.
- Animasi memakai `@starting-style`, `transition-behavior: allow-discrete`, dan
  `overlay`, sehingga masuk dan keluar mulus tanpa JavaScript animasi.
- Grup opsional menampilkan **"Tanpa tambahan" (Rp0)** sebagai pilihan pertama
  dan terpilih default.
- Pilihan berupa kartu 44px; yang terpilih memakai tint aksen dan border aksen.
- `max = 1` memakai radio, `max > 1` memakai checkbox.
- Grup wajib: tombol `Tambah` nonaktif sampai syarat terpenuhi.
- Ada tombol tutup di sudut kanan atas; `Esc` dan klik di luar juga menutup.

## 6. State wajib

| State | Tampilan |
|---|---|
| Belum ada pesanan | teks muted di kolom antrean, tanpa ilustrasi |
| Menu kosong | ajakan menambah menu di panel pemilik |
| Item habis | kartu diredupkan + pill `Habis` |
| Addon habis | opsi nonaktif + label `Habis` |
| Tunnel mati | titik merah + teks `Tunnel mati` di header |
| Internet putus | banner tipis di atas, aksi manual tetap aktif |
| QRIS tertunda | tagihan terkunci, hitung waktu, tombol `Cek status` |
| Perlu dicek | pill merah, satu-satunya status yang menuntut tindakan |
| Sesi terkunci | layar PIN, nama kasir terakhir |

## 7. Komponen

`Button` (primary, ghost, text), `Card`, `Row`, `List`, `Dot`, `Pill`, `Label`,
`Field`, `Sheet` (dialog), `Stepper`, `Radio`, `Checkbox`, `Money`,
`TableTile`, `OrderCard`, `BillLine`, `CartBar`, `Photo`.

## 8. Larangan

- Gradien dekoratif. Gradien hanya untuk overlay teks di atas foto.
- Lebih dari satu tombol terisi per area aksi.
- Blok warna jenuh untuk status; status memakai tint + titik/pill.
- Bayangan lebih dari satu lapis atau efek kaca/blur.
- Animasi yang memantul atau lebih dari 300ms.
- Animasi tanpa jalur `prefers-reduced-motion`.
- Ikon tanpa teks untuk aksi utama.

## 9. Mockup

Prototipe statis ada di `prototype/`:

- `kasir.html` — papan meja, antrean, tagihan, ringkasan shift.
- `menu.html` — header, pencarian, rail favorit, daftar menu, bar keranjang.
- `addon.html` — sheet addon native dengan pilihan "Tanpa tambahan".

Screenshot: `docs/mockups/kasir.png` (PC 1440×900),
`kasir-tablet.png` (tablet lanskap 1024×768),
`kasir-tablet-portrait.png` (tablet potret 820×1180), `menu.png`, `addon.png`.
Foto contoh: Unsplash, lihat `prototype/CREDITS.md`.

Prototipe adalah acuan visual. Implementasi React memakai token dan pola yang
sama, bukan menyalin HTML-nya.
