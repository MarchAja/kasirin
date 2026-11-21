; kasirin.nsi — Skrip installer NSIS untuk KasirIn.
; Dibangun oleh scripts/build-windows.ps1 (atau dijalankan manual dengan makensis).
;
; Jalankan dari akar repositori:
;   makensis installer/kasirin.nsi
;
; Path relatif memakai ${__FILEDIR__} (folder tempat berkas .nsi ini berada),
; sehingga tetap benar walau makensis dipanggil dari folder lain.

; ===================== Informasi aplikasi =====================
!define APPNAME     "KasirIn"
!define APPVERSION  "0.1.0"
!define APPPUBLISHER "MarchAja"
!define APPINSTDIR  "$LOCALAPPDATA\KasirIn"
!define APPEXE      "run.cmd"

Name "${APPNAME}"
OutFile "${__FILEDIR__}\..\dist-windows\${APPNAME}-Setup.exe"
InstallDir "${APPINSTDIR}"
InstallDirRegKey HKCU "Software\${APPPUBLISHER}\${APPNAME}" "InstallDir"

; Kompresi solid LZMA menghasilkan installer lebih kecil.
SetCompressor /SOLID lzma

; Dukung Unicode agar teks Bahasa Indonesia tampil benar.
Unicode true

; Pasang per-user: tidak meminta hak administrator.
RequestExecutionLevel user

; Antarmuka modern (MUI2).
!include "MUI2.nsh"

; ===================== Tampilan & metadata =====================
BrandingText "${APPNAME} - @${APPPUBLISHER} - AGPL-3.0"
ShowInstDetails show
ShowUninstDetails show

VIProductVersion "0.1.0.0"
VIAddVersionKey "ProductName" "${APPNAME}"
VIAddVersionKey "ProductVersion" "${APPVERSION}"
VIAddVersionKey "CompanyName" "${APPPUBLISHER}"
VIAddVersionKey "FileDescription" "Installer ${APPNAME} - POS untuk UMKM F&B Indonesia"
VIAddVersionKey "LegalCopyright" "${APPPUBLISHER} - AGPL-3.0"

; ===================== Konfigurasi halaman =====================
!define MUI_ABORTWARNING
; Berkas lisensi berada di akar repo, satu level di atas folder installer/
; (relatif terhadap berkas .nsi ini).
!define MUI_LICENSEFILE "${__FILEDIR__}\..\LICENSE"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APPEXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Jalankan ${APPNAME} sekarang"

; Urutan halaman wizard instalasi.
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "${__FILEDIR__}\..\LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; Halaman wizard uninstall.
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Bahasa antarmuka installer.
!insertmacro MUI_LANGUAGE "Indonesian"

; ===================== Bagian instalasi =====================
Section "Instal ${APPNAME}" SEC_UTAMA
    ; Folder tujuan instalasi.
    SetOutPath "$INSTDIR"

    ; Salin seluruh isi staging (dibuat oleh scripts/build-windows.ps1).
    ; staging: ..\dist-windows\KasirIn
    File /r "${__FILEDIR__}\..\dist-windows\${APPNAME}\*.*"

    ; Ingat lokasi instalasi untuk pembaruan berikutnya (per-user).
    WriteRegStr HKCU "Software\${APPPUBLISHER}\${APPNAME}" "InstallDir" "$INSTDIR"
    WriteRegStr HKCU "Software\${APPPUBLISHER}\${APPNAME}" "Version" "${APPVERSION}"

    ; Pintasan di Start Menu.
    CreateDirectory "$SMPROGRAMS\${APPNAME}"
    CreateShortcut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\${APPEXE}"
    CreateShortcut "$SMPROGRAMS\${APPNAME}\Uninstall ${APPNAME}.lnk" "$INSTDIR\Uninstall.exe"

    ; Tulis uninstaller.
    WriteUninstaller "$INSTDIR\Uninstall.exe"

    ; Pendaftaran di Add/Remove Programs (tingkat pengguna).
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayName" "${APPNAME} ${APPVERSION}"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayVersion" "${APPVERSION}"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "Publisher" "${APPPUBLISHER}"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "NoModificationWnd" 1
SectionEnd

; Pintasan Desktop bersifat opsional (tidak dicentang secara default).
Section /o "Buat pintasan di Desktop (opsional)" SEC_DESKTOP
    CreateShortcut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${APPEXE}"
SectionEnd

; ===================== Bagian uninstall =====================
Section "Uninstall"
    ; Hapus pintasan.
    Delete "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk"
    Delete "$SMPROGRAMS\${APPNAME}\Uninstall ${APPNAME}.lnk"
    RMDir "$SMPROGRAMS\${APPNAME}"
    Delete "$DESKTOP\${APPNAME}.lnk"

    ; Hapus berkas aplikasi, TAPI biarkan folder data tetap ada.
    ; Data berada di %LOCALAPPDATA%\KasirIn\data = $INSTDIR\data.
    ; Karena itu kita menghapus berkas satu per satu, bukan RMDir /r "$INSTDIR".
    RMDir /r "$INSTDIR\apps"
    Delete "$INSTDIR\package.json"
    Delete "$INSTDIR\package-lock.json"
    Delete "$INSTDIR\start.bat"
    Delete "$INSTDIR\run.cmd"
    Delete "$INSTDIR\LICENSE"
    Delete "$INSTDIR\README.md"
    Delete "$INSTDIR\.env.example"
    Delete "$INSTDIR\Uninstall.exe"
    ; RMDir tanpa /r hanya berhasil bila folder kosong. Selama folder data
    ; masih berisi, folder KasirIn sengaja dibiarkan (data tidak hilang).
    RMDir "$INSTDIR"

    ; Bersihkan entri registry.
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"
    DeleteRegKey HKCU "Software\${APPPUBLISHER}\${APPNAME}"
SectionEnd
