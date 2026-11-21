# Installer Windows KasirIn

Folder ini berisi skrip NSIS (`kasirin.nsi`) untuk membuat installer
`KasirIn-Setup.exe`. Skrip ini **hanya bisa dijalankan di Windows** (makensis
tidak tersedia untuk macOS/Linux).

## Cara membangun

Cara termudah adalah menjalankan skrip pembangun paket dari akar repositori
pada komputer Windows:

```bat
powershell -File scripts/build-windows.ps1
```

Skrip tersebut akan:

1. mengecek Node.js minimal versi 22;
2. menjalankan `npm ci` dan `npm run build`;
3. menyiapkan `dist-windows/KasirIn` (staging);
4. membuat `dist-windows/KasirIn-windows.zip`;
5. membuat `dist-windows/KasirIn-Setup.exe` **bila `makensis` ada di PATH**.

Pintasan Start Menu dibuat saat instalasi; pintasan Desktop bersifat opsional
(dapat dicentang pada wizard). Install dir adalah `%LOCALAPPDATA%\KasirIn` dan
**tidak memerlukan hak administrator**. uninstaller sengaja membiarkan folder
data (`%LOCALAPPDATA%\KasirIn\data`) agar transaksi tidak hilang.

## Dependensi runtime

Paket menyertakan `package.json` dan `package-lock.json` tetapi **tidak
membundel `node_modules`**. Jalankan `npm ci` sekali di folder hasil
ekstrak/instal sebelum memakai `run.cmd` agar dependensi (Fastify,
better-sqlite3, dan lain-lain) terpasang dengan versi Windows yang sesuai.
Node.js 22+ tetap harus terpasang.

## NSIS opsional

NSIS **tidak wajib**. Bila `makensis` tidak ditemukan, skrip hanya mencetak
peringatan dan tetap menghasilkan ZIP. Pasang NSIS dari
<https://nsis.sourceforge.io/> bila ingin menghasilkan `.exe`.

Bila ingin menjalankan NSIS langsung (misalnya untuk mencoba perubahan pada
`kasirin.nsi`), jalankan dari akar repositori setelah staging dibuat:

```bat
makensis installer/kasirin.nsi
```

## Rilis otomatis

Workflow [`.github/workflows/release-windows.yml`](../.github/workflows/release-windows.yml)
membangun ZIP dan installer pada runner **windows-latest** setiap kali tag
`v*` didorong, lalu melampirkannya ke GitHub Release.

Dokumentasi lengkap ada di [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md).
Lisensi KasirIn: **AGPL-3.0** — <https://github.com/MarchAja/kasirin>.
