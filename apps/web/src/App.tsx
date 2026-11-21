import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import QRCode from 'qrcode'
import {
  ApiError,
  bayarTagihan,
  beriDiskon,
  clearToken,
  getAntrean,
  getHealth,
  getMe,
  getMenu,
  getPengaturan,
  getRingkasanHarian,
  getTagihanMeja,
  getToken,
  getTables,
  konfirmasiPembayaran,
  login,
  onUnauthorized,
  patchMenu,
  sajikanPesanan,
  setToken,
  terimaPesanan,
  tutupKunjungan,
  updatePengaturan,
} from './api'
import { formatJam, formatNomorMeja, formatRupiah, urlFoto } from './format'
import Pelanggan from './pelanggan/Pelanggan'
import { teks } from './teks'
import type {
  BayarRequest,
  DiskonRequest,
  GrupAddon,
  LoginRequest,
  Meja,
  MenuItem,
  MenuResponse,
  MetodeBayar,
  PatchMenuRequest,
  PengaturanResponse,
  Pengguna,
  PesananAntrean,
  RingkasanHarian,
  StatusMeja,
  StatusPesanan,
  StatusTagihan,
  TagihanDetail,
  UpdatePengaturanRequest,
} from './types'

type Tone = 'netral' | 'akcen' | 'hijau' | 'kuning' | 'biru' | 'merah'
type Mode = 'kasir' | 'owner'
type Halaman = 'meja' | 'menu' | 'qr' | 'ringkasan' | 'pengaturan'
type FieldMenu = 'habis' | 'aktif'
type DialogAksi = 'bayar' | 'diskon' | 'konfirmasi' | 'tutup' | null

interface Sesi {
  token: string
  pengguna: Pengguna
}

const PIL_TONE: Record<Tone, string> = {
  netral: 'bg-paper-2 text-muted',
  akcen: 'bg-accent-soft text-accent',
  hijau: 'bg-green-soft text-green',
  kuning: 'bg-amber-soft text-amber',
  biru: 'bg-blue-soft text-blue',
  merah: 'bg-red-soft text-red',
}

const DOT_TONE: Record<Tone, string> = {
  netral: 'bg-idle',
  akcen: 'bg-accent',
  hijau: 'bg-green',
  kuning: 'bg-amber',
  biru: 'bg-blue',
  merah: 'bg-red',
}

const STATUS_MEJA_TONE: Record<StatusMeja, Tone> = {
  kosong: 'netral',
  baru: 'kuning',
  diterima: 'biru',
  disajikan: 'hijau',
  perlu_dicek: 'merah',
}

const LABEL_STATUS_MEJA: Record<StatusMeja, string> = {
  kosong: teks.statusKosong,
  baru: teks.statusBaru,
  diterima: teks.statusDiterima,
  disajikan: teks.statusDisajikan,
  perlu_dicek: teks.statusPerluDicek,
}

const STATUS_TAGIHAN_TONE: Record<StatusTagihan, Tone> = {
  buka: 'netral',
  tertunda: 'kuning',
  lunas: 'hijau',
  perlu_dicek: 'merah',
  ditutup: 'netral',
}

const LABEL_STATUS_TAGIHAN: Record<StatusTagihan, string> = {
  buka: teks.statusBuka,
  tertunda: teks.statusTertunda,
  lunas: teks.statusLunas,
  perlu_dicek: teks.statusPerluDicek,
  ditutup: teks.statusDitutup,
}

const TOMBOL_PRIMER =
  'inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent text-[14px] font-semibold text-white shadow-2 transition-all duration-150 hover:bg-accent-2 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50'

const TOMBOL_AKSI_PRIMER =
  'inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-accent text-[12.5px] font-semibold text-white shadow-1 transition-all duration-150 hover:bg-accent-2 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50'

const TOMBOL_SEKUNDER =
  'inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-line bg-surface px-3 text-[12.5px] font-semibold text-muted transition-all duration-150 hover:border-accent hover:text-accent active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50'

/** Jam lokal dari ISO, atau string kosong bila tanggal tidak valid. */
function jamDibuat(iso: string): string {
  const tanggal = new Date(iso)
  return Number.isNaN(tanggal.getTime()) ? '' : formatJam(tanggal)
}

/** Waktu relatif singkat untuk kartu antrean, cth: "2 mnt lalu". */
function waktuRelatif(iso: string): string {
  const waktu = new Date(iso).getTime()
  if (Number.isNaN(waktu)) return ''
  const menit = Math.max(0, Math.floor((Date.now() - waktu) / 60_000))
  if (menit < 1) return teks.baruSaja
  if (menit < 60) return `${menit} ${teks.menitLalu}`
  return `${Math.floor(menit / 60)} ${teks.jamLalu}`
}

function labelStatusPesanan(status: StatusPesanan): string {
  switch (status) {
    case 'baru':
      return teks.statusBaru
    case 'diterima':
      return teks.statusDiterima
    case 'disajikan':
      return teks.statusDisajikan
    case 'ditutup':
      return teks.statusDitutup
    case 'dibatalkan':
      return teks.statusDibatalkan
  }
}

function pesanError(err: unknown, konteks: 'login' | 'biasa'): string {
  if (!(err instanceof ApiError)) return teks.gagalUmum
  if (err.status === 0) return teks.serverMati
  if (err.status === 401) {
    if (konteks === 'login') {
      return err.message.startsWith('HTTP') ? teks.pinSalah : err.message
    }
    return teks.sesiBerakhir
  }
  return err.message || teks.gagalUmum
}

function Logo({ size = 36 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-[10px] bg-accent font-bold text-white shadow-1"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.46) }}
    >
      K
    </span>
  )
}

function Label({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted">
      {children}
    </div>
  )
}

function Pill({
  tone = 'netral',
  dot = false,
  children,
}: {
  tone?: Tone
  dot?: boolean
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11.5px] font-semibold ${PIL_TONE[tone]}`}
    >
      {dot && (
        <span
          className={`h-[7px] w-[7px] shrink-0 rounded-full ${DOT_TONE[tone]}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  )
}

function Spinner() {
  return (
    <span
      className="spinner inline-block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    />
  )
}

function ErrorBanner({
  pesan,
  onRetry,
}: {
  pesan: string
  onRetry?: () => void
}) {
  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-3 rounded-md border border-red/30 bg-red-soft px-4 py-3 text-[13px] text-red"
    >
      <span className="text-[15px] font-bold leading-none" aria-hidden="true">
        !
      </span>
      <span className="flex-1">{pesan}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="font-semibold underline underline-offset-2 transition-opacity duration-150 hover:opacity-70"
        >
          {teks.cobaLagi}
        </button>
      )}
    </div>
  )
}

function Footer() {
  return (
    <div className="pointer-events-none fixed bottom-2.5 right-3 z-50 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/90 px-2.5 py-1.5 text-[10px] font-semibold text-muted shadow-1">
      <span
        className="grid h-3.5 w-3.5 place-items-center rounded-[4px] bg-accent text-[8px] text-white"
        aria-hidden="true"
      >
        K
      </span>
      <span>{teks.watermark}</span>
    </div>
  )
}

function NumKey({
  children,
  onClick,
}: {
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-12 rounded-md border border-line bg-paper text-[17px] font-semibold text-ink transition-all duration-150 hover:border-accent hover:bg-accent-soft hover:text-accent active:translate-y-px"
    >
      {children}
    </button>
  )
}

function KunciTeks({
  children,
  onClick,
}: {
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-12 rounded-md border border-line bg-paper-2 text-[12px] font-semibold text-muted transition-colors duration-150 hover:border-accent hover:text-accent"
    >
      {children}
    </button>
  )
}

function NavItem({
  aktif,
  label,
  onClick,
}: {
  aktif: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-current={aktif ? 'page' : undefined}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-[13.5px] font-semibold transition-colors duration-150 ${
        aktif ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-paper-2 hover:text-ink'
      }`}
    >
      <span
        className={`h-[7px] w-[7px] shrink-0 rounded-full ${aktif ? 'bg-accent' : 'bg-idle'}`}
        aria-hidden="true"
      />
      {label}
    </button>
  )
}

function TableTile({
  meja,
  selected,
  onSelect,
}: {
  meja: Meja
  selected: boolean
  onSelect: (id: number) => void
}) {
  const tone = meja.aktif ? STATUS_MEJA_TONE[meja.status] : 'merah'
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={!meja.aktif}
      onClick={() => onSelect(meja.id)}
      className={`rounded-md border p-3.5 text-left shadow-1 transition-all duration-150 ${
        selected
          ? 'border-accent bg-accent-soft ring-1 ring-accent'
          : 'border-line bg-surface hover:-translate-y-px hover:border-accent hover:shadow-2'
      } ${meja.aktif ? '' : 'opacity-50'}`}
    >
      <span className="flex items-start justify-between">
        <span
          className={`tabular-nums text-[16px] font-bold leading-none ${selected ? 'text-accent' : 'text-ink'}`}
        >
          {formatNomorMeja(meja.nomor)}
        </span>
        <span
          className={`mt-0.5 h-[7px] w-[7px] shrink-0 rounded-full ${DOT_TONE[tone]}`}
          aria-hidden="true"
        />
      </span>
      <span className={`mt-3 block text-[12px] ${meja.aktif ? 'text-muted' : 'text-red'}`}>
        {meja.total > 0
          ? formatRupiah(meja.total)
          : meja.aktif
            ? teks.kosong
            : teks.nonaktif}
      </span>
      {meja.aktif && meja.status !== 'kosong' && (
        <span className={`mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${PIL_TONE[tone]}`}>
          {LABEL_STATUS_MEJA[meja.status]}
        </span>
      )}
    </button>
  )
}

function BarisTotal({
  label,
  nilai,
  negatif = false,
  besar = false,
  catatan,
}: {
  label: string
  nilai: number
  negatif?: boolean
  besar?: boolean
  catatan?: string | null
}) {
  return (
    <div>
      <div
        className={`flex items-baseline justify-between gap-3 ${
          besar ? 'border-t border-line pt-3' : ''
        }`}
      >
        <span
          className={besar ? 'text-[13px] font-bold text-ink' : 'text-[12px] text-muted'}
        >
          {label}
        </span>
        <span
          className={`tabular-nums ${
            besar
              ? 'text-[24px] font-bold leading-none text-ink'
              : 'text-[12.5px] font-semibold text-ink'
          }`}
        >
          {negatif && nilai > 0 ? '−' : ''}
          {formatRupiah(nilai)}
        </span>
      </div>
      {catatan && (
        <p className="mt-0.5 text-right text-[11px] italic leading-tight text-muted">
          {catatan}
        </p>
      )}
    </div>
  )
}

function DetailMejaCard({
  meja,
  tagihan,
  tagihanLoading,
  tagihanError,
  onMuatUlang,
  onBayar,
  onDiskon,
  onKonfirmasi,
  onTutup,
  aksiBerjalan,
}: {
  meja?: Meja
  tagihan: TagihanDetail | null
  tagihanLoading: boolean
  tagihanError: string | null
  onMuatUlang: () => void
  onBayar: () => void
  onDiskon: () => void
  onKonfirmasi: () => void
  onTutup: () => void
  aksiBerjalan: boolean
}) {
  if (!meja) {
    return (
      <div className="rounded-lg border border-line bg-surface p-5 shadow-2">
        <div className="py-14 text-center">
          <p className="text-[13.5px] font-semibold text-ink">{teks.pilihMeja}</p>
          <p className="mt-1.5 text-[12px] text-muted">{teks.pilihMejaSub}</p>
        </div>
      </div>
    )
  }

  const tone = meja.aktif ? STATUS_MEJA_TONE[meja.status] : 'merah'
  const ditutup = tagihan?.status === 'ditutup'
  return (
    <div className="rounded-lg border border-line bg-surface p-5 shadow-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-accent-soft tabular-nums text-[16px] font-bold text-accent">
            {formatNomorMeja(meja.nomor)}
          </span>
          <div>
            <h2 className="text-[16px] font-bold leading-tight">
              {teks.mejaJudul} {formatNomorMeja(meja.nomor)}
            </h2>
            <p className="mt-0.5 text-[11.5px] text-muted">
              {LABEL_STATUS_MEJA[meja.status]}
            </p>
          </div>
        </div>
        <Pill tone={meja.aktif ? tone : 'merah'} dot>
          {meja.aktif ? LABEL_STATUS_MEJA[meja.status] : teks.nonaktif}
        </Pill>
      </div>
      <div className="my-5 h-px bg-line" />
      {meja.kunjungan_id ? (
        tagihan ? (
          <div className="rounded-md border border-line bg-paper px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted">
                  {teks.kunjunganAktif}
                </p>
                <p className="mt-0.5 tabular-nums text-[12px] text-muted">
                  {teks.kunjungan} {jamDibuat(tagihan.dibuat_pada)}
                </p>
              </div>
              <Pill tone={STATUS_TAGIHAN_TONE[tagihan.status]} dot>
                {LABEL_STATUS_TAGIHAN[tagihan.status]}
              </Pill>
            </div>

            <ul className="mt-4 space-y-2.5 border-t border-line pt-3">
              {tagihan.items.map((item) => (
                <li key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[12.5px] font-semibold leading-tight text-ink">
                      <span className="tabular-nums text-muted">{item.jumlah}× </span>
                      {item.nama}
                    </span>
                    <span className="shrink-0 tabular-nums text-[12px] font-semibold text-ink">
                      {formatRupiah(item.harga_satuan * item.jumlah)}
                    </span>
                  </div>
                  {item.addons.length > 0 && (
                    <ul className="mt-1 space-y-0.5 pl-4">
                      {item.addons.map((addon) => (
                        <li
                          key={addon.addon_id}
                          className="text-[11px] leading-tight text-muted"
                        >
                          ↳ {addon.nama}
                          {addon.harga > 0 ? ` · ${formatRupiah(addon.harga)}` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>

            <div className="mt-4 space-y-1.5 border-t border-line pt-3">
              <BarisTotal label={teks.subtotal} nilai={tagihan.subtotal} />
              <BarisTotal
                label={teks.diskon}
                nilai={tagihan.diskon}
                negatif
                catatan={tagihan.alasan_diskon}
              />
              <BarisTotal label={teks.pajak} nilai={tagihan.pajak} />
              <BarisTotal label={teks.service} nilai={tagihan.service} />
              <div className="pt-1">
                <BarisTotal label={teks.total} nilai={tagihan.total} besar />
              </div>
            </div>

            <div className="mt-4 space-y-2 border-t border-line pt-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={ditutup || aksiBerjalan}
                  onClick={onBayar}
                  className={TOMBOL_AKSI_PRIMER}
                >
                  {teks.bayar}
                </button>
                <button
                  type="button"
                  disabled={ditutup || aksiBerjalan}
                  onClick={onDiskon}
                  className={TOMBOL_SEKUNDER}
                >
                  {teks.diskon}
                </button>
              </div>
              {tagihan.status === 'perlu_dicek' && (
                <button
                  type="button"
                  disabled={aksiBerjalan}
                  onClick={onKonfirmasi}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-red/30 bg-red-soft text-[12.5px] font-semibold text-red transition-all duration-150 hover:border-red active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {teks.konfirmasi}
                </button>
              )}
              <button
                type="button"
                disabled={tagihan.status !== 'lunas' || aksiBerjalan}
                onClick={onTutup}
                className="inline-flex h-10 w-full items-center justify-center rounded-md border border-line bg-paper text-[12.5px] font-semibold text-muted transition-all duration-150 hover:border-accent hover:text-accent active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
              >
                {teks.tutupMeja}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-line bg-paper px-4 py-6 text-center text-[12px] text-muted">
            {tagihanError ? (
              <div role="alert">
                <p>{tagihanError}</p>
                <button
                  type="button"
                  onClick={onMuatUlang}
                  className="mt-2 font-semibold text-accent underline underline-offset-2"
                >
                  {teks.cobaLagi}
                </button>
              </div>
            ) : (
              <span className="inline-flex items-center gap-2">
                {tagihanLoading && <Spinner />}
                {teks.memuatTagihan}
              </span>
            )}
          </div>
        )
      ) : (
        <div className="rounded-md border border-dashed border-line bg-paper px-4 py-10 text-center">
          <p className="text-[13.5px] font-semibold text-ink">{teks.belumPesanan}</p>
          <p className="mt-1.5 text-[12px] text-muted">{teks.belumPesananSub}</p>
        </div>
      )}
    </div>
  )
}

function HariIniCard({ ringkasan }: { ringkasan: RingkasanHarian | null }) {
  return (
    <div className="mt-6 rounded-lg border border-line bg-surface p-5 shadow-1">
      <div className="flex items-center justify-between gap-3">
        <Label>{teks.hariIni}</Label>
        {ringkasan && (
          <span className="tabular-nums text-[11px] text-muted">
            {ringkasan.tanggal}
          </span>
        )}
      </div>
      <div className="mt-3 tabular-nums text-[26px] font-bold leading-none">
        {formatRupiah(ringkasan?.total_diterima ?? 0)}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted">
        <span>
          {ringkasan?.jumlah_transaksi ?? 0} {teks.transaksi}
        </span>
        <span>
          {ringkasan?.tagihan_terbuka ?? 0} {teks.tagihanTerbuka}
        </span>
        <span>
          {ringkasan?.perlu_dicek ?? 0} {teks.statusPerluDicek}
        </span>
      </div>
    </div>
  )
}

function SkeletonMeja() {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="h-[84px] rounded-md border border-line bg-paper-2" />
      ))}
    </div>
  )
}

function SkeletonMenu() {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="h-[72px] rounded-md border border-line bg-paper-2" />
      ))}
    </div>
  )
}

function AntreanCard({
  pesanan,
  working,
  onAksi,
}: {
  pesanan: PesananAntrean
  working: boolean
  onAksi: (pesanan: PesananAntrean) => void
}) {
  const baru = pesanan.status === 'baru'
  const tone: Tone = baru ? 'kuning' : 'biru'
  return (
    <div
      className={`rounded-md border border-line border-l-[3px] bg-surface p-4 shadow-1 ${
        baru ? 'border-l-amber' : 'border-l-blue'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-accent-soft tabular-nums text-[13px] font-bold text-accent">
            {formatNomorMeja(pesanan.meja_nomor)}
          </span>
          <div className="leading-tight">
            <p className="text-[12.5px] font-semibold text-ink">
              {teks.mejaJudul} {formatNomorMeja(pesanan.meja_nomor)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">{waktuRelatif(pesanan.dibuat_pada)}</p>
          </div>
        </div>
        <Pill tone={tone} dot>
          {labelStatusPesanan(pesanan.status)}
        </Pill>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {pesanan.items.map((item) => (
          <span
            key={item.id}
            className="rounded-full bg-paper-2 px-2.5 py-1 text-[11px] font-medium text-muted"
          >
            <span className="tabular-nums">{item.jumlah}×</span> {item.nama}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
        <span className="tabular-nums text-[15px] font-bold text-ink">
          {formatRupiah(pesanan.total)}
        </span>
        <button
          type="button"
          disabled={working}
          onClick={() => onAksi(pesanan)}
          className="inline-flex h-8 items-center gap-2 rounded-md bg-accent px-3.5 text-[12px] font-semibold text-white shadow-1 transition-all duration-150 hover:opacity-90 active:translate-y-px disabled:opacity-50"
        >
          {working && <Spinner />}
          {baru ? teks.terima : teks.sajikan}
        </button>
      </div>
    </div>
  )
}

function PesananBaruSection({
  antrean,
  loading,
  error,
  onRetry,
  onAksi,
  working,
}: {
  antrean: PesananAntrean[] | null
  loading: boolean
  error: string | null
  onRetry: () => void
  onAksi: (pesanan: PesananAntrean) => void
  working: number | null
}) {
  const menunggu = antrean?.filter((p) => p.status === 'baru').length ?? 0
  return (
    <section className="mb-6 rounded-lg border border-line bg-paper p-4 shadow-1">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[14px] font-bold text-ink">{teks.pesananBaru}</h2>
          <Pill tone={menunggu > 0 ? 'kuning' : 'netral'} dot>
            {menunggu} {teks.menunggu}
          </Pill>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-8 items-center gap-2 rounded-sm border border-line bg-surface px-3 text-[11.5px] font-semibold text-muted transition-colors duration-150 hover:border-accent hover:text-accent"
        >
          {loading && <Spinner />}
          {teks.segarkan}
        </button>
      </div>

      {error && <ErrorBanner pesan={error} onRetry={onRetry} />}

      {loading && antrean === null ? (
        <div className="space-y-2.5">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 rounded-md border border-line bg-paper-2" />
          ))}
        </div>
      ) : antrean && antrean.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {antrean.map((pesanan) => (
            <AntreanCard
              key={pesanan.id}
              pesanan={pesanan}
              working={working === pesanan.id}
              onAksi={onAksi}
            />
          ))}
        </div>
      ) : (
        !error && (
          <div className="rounded-md border border-dashed border-line bg-surface px-4 py-8 text-center">
            <p className="text-[13px] font-semibold text-ink">{teks.antreanKosong}</p>
            <p className="mt-1 text-[11.5px] text-muted">{teks.antreanKosongSub}</p>
          </div>
        )
      )}
    </section>
  )
}

function QrPage({ daftarMeja }: { daftarMeja: Meja[] | null }) {
  const [qr, setQr] = useState<{ id: number; nomor: number; data: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let aktif = true
    setLoading(true)
    setError(null)
    Promise.all(
      (daftarMeja ?? [])
        .filter((m) => m.aktif)
        .map(async (m) => ({
          id: m.id,
          nomor: m.nomor,
          data: await QRCode.toDataURL(
            `${window.location.origin}/m/${m.token}`,
            { width: 220, margin: 1 },
          ),
        })),
    )
      .then((hasil) => {
        if (aktif) setQr(hasil)
      })
      .catch(() => {
        if (aktif) setError(teks.qrGagal)
      })
      .finally(() => {
        if (aktif) setLoading(false)
      })
    return () => {
      aktif = false
    }
  }, [daftarMeja])

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[21px] font-bold leading-tight tracking-tight">
            {teks.qrJudul}
          </h1>
          <p className="mt-1 text-[13px] text-muted">{teks.qrSub}</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-3.5 text-[12px] font-semibold text-muted transition-colors duration-150 hover:border-accent hover:text-accent"
        >
          {teks.qrCetak}
        </button>
      </div>

      {error && <ErrorBanner pesan={error} />}

      {loading ? (
        <div className="flex items-center gap-2 text-[13px] text-muted">
          <Spinner />
          {teks.qrMemuat}
        </div>
      ) : qr.length === 0 ? (
        <div className="rounded-md border border-dashed border-line bg-surface px-6 py-14 text-center">
          <p className="text-[13.5px] font-semibold">{teks.qrKosong}</p>
        </div>
      ) : (
        <div className="qr-sheet grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {qr.map((item) => (
            <div
              key={item.id}
              className="qr-card rounded-lg border border-line bg-surface p-5 text-center shadow-1"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted">
                {teks.mejaJudul}
              </p>
              <p className="mt-1 tabular-nums text-[22px] font-bold leading-none text-ink">
                {formatNomorMeja(item.nomor)}
              </p>
              <img
                src={item.data}
                alt={`${teks.mejaJudul} ${formatNomorMeja(item.nomor)}`}
                className="mx-auto my-4 h-auto w-[160px]"
              />
              <p className="text-[11.5px] text-muted">{teks.qrPindai}</p>
              <button
                type="button"
                onClick={() => window.print()}
                className="no-print mt-3 h-8 w-full rounded-sm border border-line text-[11.5px] font-semibold text-muted transition-colors duration-150 hover:border-accent hover:text-accent"
              >
                {teks.qrCetak}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ToggleButton({
  label,
  active,
  warna,
  disabled,
  onClick,
}: {
  label: string
  active: boolean
  warna: 'kuning' | 'akcen'
  disabled?: boolean
  onClick: () => void
}) {
  const aktifClass =
    warna === 'kuning' ? 'bg-amber-soft text-amber' : 'bg-accent-soft text-accent'
  const titikClass = warna === 'kuning' ? 'bg-amber' : 'bg-accent'
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line px-3 text-[12px] font-semibold transition-all duration-150 ${
        active ? aktifClass : 'bg-paper-2 text-muted'
      } ${disabled ? 'opacity-60' : 'hover:border-accent hover:text-ink'}`}
    >
      <span
        className={`h-[6px] w-[6px] shrink-0 rounded-full ${active ? titikClass : 'bg-idle'}`}
        aria-hidden="true"
      />
      {label}
    </button>
  )
}

function ItemMenuCard({
  item,
  working,
  onToggle,
}: {
  item: MenuItem
  working: boolean
  onToggle: (item: MenuItem, field: FieldMenu) => void
}) {
  const foto = urlFoto(item.foto_path)
  const jumlahGrup = item.grup_addon?.length ?? 0
  return (
    <div
      className={`flex items-center gap-3.5 rounded-md border border-line bg-surface p-3.5 shadow-1 transition-opacity duration-150 ${
        item.aktif ? '' : 'opacity-60'
      } ${working ? 'opacity-70' : ''}`}
    >
      {foto && (
        <img
          src={foto}
          alt=""
          loading="lazy"
          className="h-14 w-14 shrink-0 rounded-[10px] border border-line object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-semibold text-ink">{item.nama}</span>
          {item.habis && (
            <Pill tone="kuning" dot>
              {teks.habis}
            </Pill>
          )}
          {!item.aktif && <Pill tone="netral">{teks.nonaktif}</Pill>}
        </div>
        <div className="mt-0.5 tabular-nums text-[13px] font-bold text-accent">
          {formatRupiah(item.harga)}
        </div>
        {jumlahGrup > 0 && (
          <div className="mt-1 text-[11px] text-muted">
            {jumlahGrup} {teks.grupAddon}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {working && <Spinner />}
        <ToggleButton
          label={teks.habis}
          active={item.habis}
          warna="kuning"
          disabled={working}
          onClick={() => onToggle(item, 'habis')}
        />
        <ToggleButton
          label={teks.aktif}
          active={item.aktif}
          warna="akcen"
          disabled={working}
          onClick={() => onToggle(item, 'aktif')}
        />
      </div>
    </div>
  )
}

function GrupAddonCard({ grup }: { grup: GrupAddon }) {
  return (
    <div className="rounded-md border border-line bg-surface p-4 shadow-1">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[13.5px] font-semibold text-ink">{grup.nama}</h3>
        <Pill tone={grup.wajib ? 'kuning' : 'netral'}>
          {grup.wajib ? teks.wajib : teks.opsional}
        </Pill>
      </div>
      <p className="mt-0.5 text-[11.5px] text-muted">
        {teks.min} {grup.min_pilih} · {teks.maks} {grup.max_pilih} {teks.pilihan}
      </p>
      <div className="mt-3 space-y-2 border-t border-line pt-3">
        {grup.addons.map((addon) => (
          <div
            key={addon.id}
            className="flex items-center justify-between gap-2 text-[12.5px]"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className={`h-[6px] w-[6px] shrink-0 rounded-full ${
                  addon.habis ? 'bg-amber' : addon.aktif ? 'bg-green' : 'bg-idle'
                }`}
                aria-hidden="true"
              />
              <span className="truncate text-ink">{addon.nama}</span>
              {addon.habis && <Pill tone="kuning">{teks.habis}</Pill>}
              {!addon.aktif && <Pill tone="netral">{teks.nonaktif}</Pill>}
            </span>
            <span className="shrink-0 tabular-nums font-semibold text-ink">
              {formatRupiah(addon.harga)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DialogShell({
  judul,
  sub,
  onTutup,
  children,
}: {
  judul: string
  sub?: string
  onTutup: () => void
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="dialog-judul"
      onClick={(e) => {
        if (e.target === dialogRef.current) onTutup()
      }}
      onCancel={(e) => {
        e.preventDefault()
        onTutup()
      }}
      className="m-auto w-[min(420px,calc(100%_-_24px))] rounded-lg border border-line bg-surface p-0 text-ink shadow-2"
    >
      <div className="border-b border-line px-5 py-4">
        <h2 id="dialog-judul" className="text-[16px] font-bold leading-tight">
          {judul}
        </h2>
        {sub && <p className="mt-1 text-[12px] text-muted">{sub}</p>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </dialog>
  )
}

function DialogBayar({
  tagihan,
  onTutup,
  onBayar,
}: {
  tagihan: TagihanDetail
  onTutup: () => void
  onBayar: (body: BayarRequest) => Promise<void>
}) {
  const [metode, setMetode] = useState<MetodeBayar>('tunai')
  const [nominal, setNominal] = useState(String(tagihan.total))
  const [perluDicek, setPerluDicek] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const angka = Number(nominal)
    if (!Number.isFinite(angka) || angka <= 0) {
      setError(teks.nominalWajib)
      return
    }
    setWorking(true)
    setError(null)
    try {
      await onBayar({
        metode,
        nominal: angka,
        ...(metode === 'qris_manual' ? { perlu_dicek: perluDicek } : {}),
      })
    } catch (err: unknown) {
      setError(pesanError(err, 'biasa'))
    } finally {
      setWorking(false)
    }
  }

  return (
    <DialogShell judul={teks.bayarJudul} sub={teks.bayarSub} onTutup={onTutup}>
      <form
        onSubmit={(e) => {
          void submit(e)
        }}
      >
        <div className="rounded-md bg-paper px-3.5 py-3">
          <BarisTotal label={teks.total} nilai={tagihan.total} besar />
        </div>

        <fieldset className="mt-4">
          <legend className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted">
            {teks.metodeBayar}
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(['tunai', 'qris_manual'] as const).map((m) => (
              <label
                key={m}
                className={`flex h-10 cursor-pointer items-center justify-center rounded-md border text-[12.5px] font-semibold transition-colors duration-150 ${
                  metode === m
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line bg-surface text-muted hover:border-accent'
                }`}
              >
                <input
                  type="radio"
                  name="metode-bayar"
                  className="sr-only"
                  checked={metode === m}
                  onChange={() => setMetode(m)}
                />
                {m === 'tunai' ? teks.metodeTunai : teks.metodeQris}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="mt-4 block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted">
            {teks.nominal}
          </span>
          <input
            type="number"
            min={0}
            step={1000}
            required
            value={nominal}
            onChange={(e) => setNominal(e.target.value)}
            className="mt-2 h-11 w-full rounded-sm border border-line bg-paper px-3.5 text-[14px] tabular-nums text-ink outline-none transition-colors duration-150 focus:border-accent focus:bg-surface"
          />
        </label>

        {metode === 'qris_manual' && (
          <label className="mt-4 flex items-start gap-2.5 rounded-md border border-line bg-paper px-3.5 py-3">
            <input
              type="checkbox"
              checked={perluDicek}
              onChange={(e) => setPerluDicek(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
            />
            <span>
              <span className="block text-[12.5px] font-semibold text-ink">
                {teks.perluDicek}
              </span>
              <span className="mt-0.5 block text-[11px] text-muted">
                {teks.perluDicekBantuan}
              </span>
            </span>
          </label>
        )}

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-red/30 bg-red-soft px-3.5 py-2.5 text-[12px] text-red"
          >
            {error}
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onTutup} className={TOMBOL_SEKUNDER}>
            {teks.batal}
          </button>
          <button type="submit" disabled={working} className={TOMBOL_PRIMER}>
            {working && <Spinner />}
            {teks.bayarSekarang}
          </button>
        </div>
      </form>
    </DialogShell>
  )
}

function DialogDiskon({
  tagihan,
  onTutup,
  onDiskon,
}: {
  tagihan: TagihanDetail
  onTutup: () => void
  onDiskon: (body: DiskonRequest) => Promise<void>
}) {
  const [bentuk, setBentuk] = useState<'nominal' | 'persen'>('nominal')
  const [nominal, setNominal] = useState('')
  const [persen, setPersen] = useState('')
  const [alasan, setAlasan] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const angka = bentuk === 'nominal' ? Number(nominal) : Number(persen)
    if (!Number.isFinite(angka) || angka <= 0) {
      setError(teks.nilaiDiskonWajib)
      return
    }
    if (alasan.trim() === '') {
      setError(teks.diskonWajib)
      return
    }
    if (pin.trim() === '') {
      setError(teks.pinWajib)
      return
    }
    setWorking(true)
    setError(null)
    try {
      await onDiskon({
        ...(bentuk === 'nominal' ? { diskon: angka } : { persen: angka }),
        alasan: alasan.trim(),
        pin: pin.trim(),
      })
    } catch (err: unknown) {
      setError(pesanError(err, 'biasa'))
    } finally {
      setWorking(false)
    }
  }

  const inputKelas =
    'mt-2 h-11 w-full rounded-sm border border-line bg-paper px-3.5 text-[14px] tabular-nums text-ink outline-none transition-colors duration-150 placeholder:text-idle focus:border-accent focus:bg-surface'

  return (
    <DialogShell judul={teks.diskonJudul} sub={teks.diskonSub} onTutup={onTutup}>
      <form
        onSubmit={(e) => {
          void submit(e)
        }}
      >
        <div className="rounded-md bg-paper px-3.5 py-3">
          <BarisTotal label={teks.total} nilai={tagihan.total} besar />
        </div>

        <fieldset className="mt-4">
          <legend className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted">
            {teks.bentukDiskon}
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(['nominal', 'persen'] as const).map((b) => (
              <label
                key={b}
                className={`flex h-10 cursor-pointer items-center justify-center rounded-md border text-[12.5px] font-semibold transition-colors duration-150 ${
                  bentuk === b
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line bg-surface text-muted hover:border-accent'
                }`}
              >
                <input
                  type="radio"
                  name="bentuk-diskon"
                  className="sr-only"
                  checked={bentuk === b}
                  onChange={() => setBentuk(b)}
                />
                {b === 'nominal' ? teks.diskonNominal : teks.diskonPersen}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="mt-4 block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted">
            {bentuk === 'nominal' ? teks.diskonNominal : teks.diskonPersen}
          </span>
          {bentuk === 'nominal' ? (
            <input
              type="number"
              min={0}
              max={tagihan.subtotal}
              required
              value={nominal}
              onChange={(e) => setNominal(e.target.value)}
              placeholder="0"
              className={inputKelas}
            />
          ) : (
            <input
              type="number"
              min={0}
              max={100}
              required
              value={persen}
              onChange={(e) => setPersen(e.target.value)}
              placeholder="0"
              className={inputKelas}
            />
          )}
        </label>

        <label className="mt-4 block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted">
            {teks.alasan}
          </span>
          <input
            type="text"
            required
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            placeholder={teks.alasanPlaceholder}
            className={inputKelas}
          />
        </label>

        <label className="mt-4 block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted">
            {teks.pinPemilik}
          </span>
          <input
            type="password"
            inputMode="numeric"
            required
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className={inputKelas}
          />
          <span className="mt-1.5 block text-[11px] text-muted">
            {teks.pinPemilikHint}
          </span>
        </label>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-red/30 bg-red-soft px-3.5 py-2.5 text-[12px] text-red"
          >
            {error}
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onTutup} className={TOMBOL_SEKUNDER}>
            {teks.batal}
          </button>
          <button type="submit" disabled={working} className={TOMBOL_PRIMER}>
            {working && <Spinner />}
            {teks.diskonSimpan}
          </button>
        </div>
      </form>
    </DialogShell>
  )
}

function DialogKonfirmasi({
  judul,
  sub,
  labelTombol,
  onTutup,
  onKonfirmasi,
}: {
  judul: string
  sub: string
  labelTombol: string
  onTutup: () => void
  onKonfirmasi: () => Promise<void>
}) {
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  async function jalankan() {
    setWorking(true)
    setError(null)
    try {
      await onKonfirmasi()
    } catch (err: unknown) {
      setError(pesanError(err, 'biasa'))
    } finally {
      setWorking(false)
    }
  }

  return (
    <DialogShell judul={judul} sub={sub} onTutup={onTutup}>
      {error && (
        <div
          role="alert"
          className="rounded-md border border-red/30 bg-red-soft px-3.5 py-2.5 text-[12px] text-red"
        >
          {error}
        </div>
      )}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" onClick={onTutup} className={TOMBOL_SEKUNDER}>
          {teks.batal}
        </button>
        <button
          type="button"
          disabled={working}
          onClick={() => void jalankan()}
          className={TOMBOL_PRIMER}
        >
          {working && <Spinner />}
          {labelTombol}
        </button>
      </div>
    </DialogShell>
  )
}

function labelMetode(metode: string): string {
  if (metode === 'tunai') return teks.metodeTunai
  if (metode === 'qris_manual' || metode === 'qris') return teks.metodeQris
  return metode
}

function MetrikRingkas({
  label,
  nilai,
  tone = 'netral',
}: {
  label: string
  nilai: string
  tone?: Tone
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4 shadow-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase leading-tight tracking-[0.06em] text-muted">
          {label}
        </span>
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${DOT_TONE[tone]}`}
          aria-hidden="true"
        />
      </div>
      <p className="mt-2 tabular-nums text-[22px] font-bold leading-none text-ink">
        {nilai}
      </p>
    </div>
  )
}

function RingkasanPage({
  ringkasan,
  error,
  loading,
  onSegarkan,
}: {
  ringkasan: RingkasanHarian | null
  error: string | null
  loading: boolean
  onSegarkan: () => void
}) {
  return (
    <div className="min-w-0">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[21px] font-bold leading-tight tracking-tight">
            {teks.ringkasanJudul}
          </h1>
          <p className="mt-1 text-[13px] text-muted">{teks.ringkasanSub}</p>
        </div>
        <button
          type="button"
          onClick={onSegarkan}
          disabled={loading}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-3.5 text-[12px] font-semibold text-muted transition-colors duration-150 hover:border-accent hover:text-accent disabled:opacity-60"
        >
          {loading && <Spinner />}
          {teks.segarkan}
        </button>
      </div>

      {error && <ErrorBanner pesan={error} onRetry={onSegarkan} />}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-4">
          {ringkasan ? (
            <>
              <div className="rounded-lg border border-line bg-surface p-6 shadow-2">
                <Label>
                  {teks.totalDiterima} · {ringkasan.tanggal}
                </Label>
                <p className="mt-3 tabular-nums text-[34px] font-bold leading-none text-ink">
                  {formatRupiah(ringkasan.total_diterima)}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <MetrikRingkas
                  label={teks.jumlahTransaksi}
                  nilai={String(ringkasan.jumlah_transaksi)}
                />
                <MetrikRingkas
                  label={teks.tagihanTerbuka}
                  nilai={String(ringkasan.tagihan_terbuka)}
                />
                <MetrikRingkas
                  label={teks.statusPerluDicek}
                  nilai={String(ringkasan.perlu_dicek)}
                  tone={ringkasan.perlu_dicek > 0 ? 'merah' : 'netral'}
                />
              </div>

              <section className="rounded-lg border border-line bg-surface p-5 shadow-1">
                <Label>{teks.perMetode}</Label>
                <div className="mt-3 overflow-hidden rounded-md border border-line">
                  <table className="w-full text-[12.5px]">
                    <thead className="bg-paper text-left text-[11px] uppercase tracking-[0.06em] text-muted">
                      <tr>
                        <th className="px-3 py-2 font-semibold">{teks.metode}</th>
                        <th className="px-3 py-2 text-right font-semibold">
                          {teks.jumlahTransaksi}
                        </th>
                        <th className="px-3 py-2 text-right font-semibold">
                          {teks.total}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ringkasan.per_metode.map((m) => (
                        <tr key={m.metode} className="border-t border-line">
                          <td className="px-3 py-2.5 font-semibold text-ink">
                            {labelMetode(m.metode)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-muted">
                            {m.jumlah}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-bold text-ink">
                            {formatRupiah(m.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {ringkasan.per_metode.length === 0 && (
                  <p className="mt-3 text-[12px] text-muted">
                    {teks.ringkasanKosong}
                  </p>
                )}
              </section>
            </>
          ) : loading ? (
            <div className="h-40 rounded-lg border border-line bg-paper-2" />
          ) : null}
        </section>

        <section className="rounded-lg border border-line bg-surface p-5 shadow-1">
          <Label>{teks.diskonDiberikan}</Label>
          {ringkasan && ringkasan.diskon.length > 0 ? (
            <ul className="mt-3 space-y-3">
              {ringkasan.diskon.map((d) => (
                <li
                  key={d.tagihan_id}
                  className="border-b border-line pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12.5px] font-semibold text-ink">
                      {teks.mejaJudul} {formatNomorMeja(d.meja_nomor)}
                    </span>
                    <span className="shrink-0 tabular-nums text-[12.5px] font-bold text-accent">
                      −{formatRupiah(d.nominal)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11.5px] italic text-muted">
                    {d.alasan}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[12px] text-muted">{teks.belumTransaksi}</p>
          )}
        </section>
      </div>
    </div>
  )
}

function PengaturanPage({
  data,
  error,
  onSimpan,
}: {
  data: PengaturanResponse | null
  error: string | null
  onSimpan: (body: UpdatePengaturanRequest) => Promise<void>
}) {
  const [pajak, setPajak] = useState('10')
  const [service, setService] = useState('0')
  const [mode, setMode] = useState<PengaturanResponse['mode_bayar']>('manual')
  const [errorForm, setErrorForm] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    if (!data) return
    setPajak(String(data.pajak_persen))
    setService(String(data.service_persen))
    setMode(data.mode_bayar)
    setSaved(false)
  }, [data])

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const nilaiPajak = Number(pajak)
    const nilaiService = Number(service)
    const tidakValid = (n: number) => !Number.isFinite(n) || n < 0 || n > 100
    if (tidakValid(nilaiPajak) || tidakValid(nilaiService)) {
      setErrorForm(teks.persenTidakValid)
      return
    }
    setWorking(true)
    setErrorForm(null)
    setSaved(false)
    try {
      await onSimpan({
        pajak_persen: nilaiPajak,
        service_persen: nilaiService,
        mode_bayar: mode,
      })
      setSaved(true)
    } catch (err: unknown) {
      setErrorForm(pesanError(err, 'biasa'))
    } finally {
      setWorking(false)
    }
  }

  const inputKelas =
    'mt-2 h-11 w-full rounded-sm border border-line bg-paper px-3.5 text-[14px] tabular-nums text-ink outline-none transition-colors duration-150 focus:border-accent focus:bg-surface'

  return (
    <div className="min-w-0 max-w-[640px]">
      <div className="mb-5">
        <h1 className="text-[21px] font-bold leading-tight tracking-tight">
          {teks.pengaturanJudul}
        </h1>
        <p className="mt-1 text-[13px] text-muted">{teks.pengaturanSub}</p>
      </div>

      {error && <ErrorBanner pesan={error} />}

      <form
        onSubmit={(e) => {
          void submit(e)
        }}
        className="rounded-lg border border-line bg-surface p-5 shadow-2"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted">
              {teks.pajakPersen}
            </span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              required
              value={pajak}
              onChange={(e) => {
                setPajak(e.target.value)
                setSaved(false)
              }}
              className={inputKelas}
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted">
              {teks.servicePersen}
            </span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              required
              value={service}
              onChange={(e) => {
                setService(e.target.value)
                setSaved(false)
              }}
              className={inputKelas}
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted">
            {teks.modeBayar}
          </span>
          <select
            value={mode}
            onChange={(e) => {
              setMode(e.target.value as PengaturanResponse['mode_bayar'])
              setSaved(false)
            }}
            className={inputKelas}
          >
            <option value="manual">{teks.modeManual}</option>
            <option value="otomatis">{teks.modeOtomatis}</option>
            <option value="keduanya">{teks.modeKeduanya}</option>
          </select>
        </label>

        <p className="mt-4 rounded-md border border-line bg-paper px-3.5 py-3 text-[11.5px] leading-relaxed text-muted">
          {teks.persenBantuan} {teks.modeOtomatisCatatan}
        </p>

        {errorForm && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-red/30 bg-red-soft px-3.5 py-2.5 text-[12px] text-red"
          >
            {errorForm}
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            type="submit"
            disabled={working || !data}
            className={`w-full sm:w-auto sm:min-w-[160px] ${TOMBOL_PRIMER}`}
          >
            {working && <Spinner />}
            {working ? teks.menyimpan : teks.simpan}
          </button>
          {saved && <Pill tone="hijau">{teks.tersimpan}</Pill>}
        </div>
      </form>
    </div>
  )
}

export default function App() {
  // Halaman pelanggan berdiri sendiri: tidak boleh melewati boot/login sama sekali.
  const rutePelanggan = window.location.pathname.match(/^\/m\/([a-f0-9]{24})\/?$/)
  if (rutePelanggan) return <Pelanggan token={rutePelanggan[1]} />

  const [booting, setBooting] = useState(true)
  const [sesi, setSesi] = useState<Sesi | null>(null)
  const [mode, setMode] = useState<Mode>('kasir')
  const [pin, setPin] = useState('')
  const [password, setPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [halaman, setHalaman] = useState<Halaman>('meja')
  const [meja, setMeja] = useState<Meja[] | null>(null)
  const [mejaLoading, setMejaLoading] = useState(false)
  const [mejaError, setMejaError] = useState<string | null>(null)
  const [pilihMejaId, setPilihMejaId] = useState<number | null>(null)
  const [menu, setMenu] = useState<MenuResponse | null>(null)
  const [menuLoading, setMenuLoading] = useState(false)
  const [menuError, setMenuError] = useState<string | null>(null)
  const [patching, setPatching] = useState<number | null>(null)
  const [healthOk, setHealthOk] = useState<boolean | null>(null)
  const [jam, setJam] = useState(() => formatJam(new Date()))
  const [antrean, setAntrean] = useState<PesananAntrean[] | null>(null)
  const [antreanError, setAntreanError] = useState<string | null>(null)
  const [aksiAntrean, setAksiAntrean] = useState<number | null>(null)

  // Milestone 3 — tagihan meja terpilih, ringkasan, dan pengaturan.
  const [tagihan, setTagihan] = useState<TagihanDetail | null>(null)
  const [tagihanLoading, setTagihanLoading] = useState(false)
  const [tagihanError, setTagihanError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogAksi>(null)
  const [aksiTagihan, setAksiTagihan] = useState(false)
  const [notifikasi, setNotifikasi] = useState<string | null>(null)
  const [ringkasan, setRingkasan] = useState<RingkasanHarian | null>(null)
  const [ringkasanLoading, setRingkasanLoading] = useState(false)
  const [ringkasanError, setRingkasanError] = useState<string | null>(null)
  const [pengaturan, setPengaturan] = useState<PengaturanResponse | null>(null)
  const [pengaturanError, setPengaturanError] = useState<string | null>(null)

  const sedangMasuk = useRef(false)
  const mejaTerpilih = meja?.find((m) => m.id === pilihMejaId)

  // 401 dari panggilan mana pun mengembalikan pengguna ke layar masuk.
  useEffect(
    () =>
      onUnauthorized(() => {
        setSesi(null)
        setMeja(null)
        setMenu(null)
        setTagihan(null)
        setDialog(null)
        setNotifikasi(null)
        setHalaman('meja')
        setLoginError(teks.sesiBerakhir)
      }),
    [],
  )

  // Pulihkan sesi dari token yang tersimpan.
  useEffect(() => {
    const token = getToken()
    if (!token) {
      setBooting(false)
      return
    }
    let aktif = true
    getMe()
      .then((res) => {
        if (aktif) setSesi({ token, pengguna: res.pengguna })
      })
      .catch((err: unknown) => {
        if (aktif && !(err instanceof ApiError && err.status === 401)) {
          setLoginError(teks.serverBelum)
        }
      })
      .finally(() => {
        if (aktif) setBooting(false)
      })
    return () => {
      aktif = false
    }
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setJam(formatJam(new Date())), 30_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!sesi) return
    let aktif = true
    getHealth()
      .then((res) => {
        if (aktif) setHealthOk(res.ok)
      })
      .catch(() => {
        if (aktif) setHealthOk(false)
      })
    return () => {
      aktif = false
    }
  }, [sesi])

  const muatMeja = useCallback(() => {
    setMejaLoading(true)
    setMejaError(null)
    getTables()
      .then((res) => {
        setMeja(res.meja)
        setPilihMejaId((sebelum) => {
          if (sebelum !== null) return sebelum
          return (
            res.meja.find((m) => m.aktif)?.id ?? res.meja[0]?.id ?? null
          )
        })
      })
      .catch((err: unknown) => setMejaError(pesanError(err, 'biasa')))
      .finally(() => setMejaLoading(false))
  }, [])

  const muatMenu = useCallback(() => {
    setMenuLoading(true)
    setMenuError(null)
    getMenu()
      .then(setMenu)
      .catch((err: unknown) => setMenuError(pesanError(err, 'biasa')))
      .finally(() => setMenuLoading(false))
  }, [])

  useEffect(() => {
    if (sesi) muatMeja()
  }, [sesi, muatMeja])

  useEffect(() => {
    if (sesi?.pengguna.peran === 'owner' && halaman === 'menu') muatMenu()
  }, [sesi, halaman, muatMenu])

  const muatAntrean = useCallback(() => {
    getAntrean()
      .then((res) => {
        setAntrean(res.pesanan)
        setAntreanError(null)
      })
      .catch((err: unknown) => setAntreanError(pesanError(err, 'biasa')))
  }, [])

  // Antrean diperbarui tiap 3 detik hanya saat papan meja dibuka.
  useEffect(() => {
    if (!sesi || halaman !== 'meja') return
    muatAntrean()
    const id = window.setInterval(muatAntrean, 3000)
    return () => window.clearInterval(id)
  }, [sesi, halaman, muatAntrean])

  const tagihanMejaRef = useRef<number | null>(null)
  const muatTagihan = useCallback((mejaId: number) => {
    tagihanMejaRef.current = mejaId
    setTagihanLoading(true)
    setTagihanError(null)
    getTagihanMeja(mejaId)
      .then((res) => {
        if (tagihanMejaRef.current === mejaId) setTagihan(res.tagihan)
      })
      .catch((err: unknown) => {
        if (tagihanMejaRef.current === mejaId)
          setTagihanError(pesanError(err, 'biasa'))
      })
      .finally(() => {
        if (tagihanMejaRef.current === mejaId) setTagihanLoading(false)
      })
  }, [])

  const muatRingkasan = useCallback(() => {
    setRingkasanLoading(true)
    getRingkasanHarian()
      .then((res) => {
        setRingkasan(res)
        setRingkasanError(null)
      })
      .catch((err: unknown) => setRingkasanError(pesanError(err, 'biasa')))
      .finally(() => setRingkasanLoading(false))
  }, [])

  const muatPengaturan = useCallback(() => {
    getPengaturan()
      .then((res) => {
        setPengaturan(res)
        setPengaturanError(null)
      })
      .catch((err: unknown) => setPengaturanError(pesanError(err, 'biasa')))
  }, [])

  // Tagihan meja terpilih diperbarui tiap 3 detik selama kunjungan berjalan.
  useEffect(() => {
    if (!sesi || halaman !== 'meja') return
    const mejaId = mejaTerpilih?.id
    if (!mejaId || !mejaTerpilih?.kunjungan_id) {
      tagihanMejaRef.current = null
      setTagihan(null)
      setTagihanError(null)
      return
    }
    setTagihan(null)
    muatTagihan(mejaId)
    const id = window.setInterval(() => muatTagihan(mejaId), 3000)
    return () => window.clearInterval(id)
  }, [sesi, halaman, mejaTerpilih?.id, mejaTerpilih?.kunjungan_id, muatTagihan])

  // Ringkasan harian dipakai kartu ringkas di papan meja dan halaman penuh.
  useEffect(() => {
    if (!sesi) return
    muatRingkasan()
    if (halaman !== 'ringkasan') return
    const id = window.setInterval(muatRingkasan, 3000)
    return () => window.clearInterval(id)
  }, [sesi, halaman, muatRingkasan])

  useEffect(() => {
    if (
      !sesi ||
      sesi.pengguna.peran !== 'owner' ||
      halaman !== 'pengaturan'
    )
      return
    muatPengaturan()
  }, [sesi, halaman, muatPengaturan])

  // Notifikasi sukses muncul sebentar lalu hilang sendiri.
  useEffect(() => {
    if (!notifikasi) return
    const id = window.setTimeout(() => setNotifikasi(null), 4000)
    return () => window.clearTimeout(id)
  }, [notifikasi])

  function segarkanSetelahAksi() {
    if (mejaTerpilih?.kunjungan_id) muatTagihan(mejaTerpilih.id)
    muatMeja()
    muatRingkasan()
  }

  async function aksiBayar(body: BayarRequest) {
    if (!tagihan) return
    await bayarTagihan(tagihan.id, body)
    setDialog(null)
    setNotifikasi(teks.bayarBerhasil)
    segarkanSetelahAksi()
  }

  async function aksiDiskon(body: DiskonRequest) {
    if (!tagihan) return
    await beriDiskon(tagihan.id, body)
    setDialog(null)
    setNotifikasi(teks.diskonBerhasil)
    segarkanSetelahAksi()
  }

  async function aksiKonfirmasi() {
    if (!tagihan) return
    setAksiTagihan(true)
    try {
      await konfirmasiPembayaran(tagihan.id)
      setDialog(null)
      setNotifikasi(teks.konfirmasiBerhasil)
      segarkanSetelahAksi()
    } finally {
      setAksiTagihan(false)
    }
  }

  async function aksiTutup() {
    if (!tagihan) return
    setAksiTagihan(true)
    try {
      await tutupKunjungan(tagihan.kunjungan_id)
      setDialog(null)
      tagihanMejaRef.current = null
      setTagihan(null)
      setNotifikasi(teks.tutupBerhasil)
      muatMeja()
      muatRingkasan()
    } finally {
      setAksiTagihan(false)
    }
  }

  async function simpanPengaturan(body: UpdatePengaturanRequest) {
    const res = await updatePengaturan(body)
    setPengaturan(res)
  }

  async function aksiPesanan(pesanan: PesananAntrean) {
    if (aksiAntrean !== null) return
    setAksiAntrean(pesanan.id)
    setAntreanError(null)
    try {
      if (pesanan.status === 'baru') await terimaPesanan(pesanan.id)
      else await sajikanPesanan(pesanan.id)
      setAntrean((sebelum) =>
        sebelum ? sebelum.filter((p) => p.id !== pesanan.id) : sebelum,
      )
      muatMeja()
      muatAntrean()
    } catch (err: unknown) {
      const pesan = pesanError(err, 'biasa')
      setAntreanError(pesan === teks.gagalUmum ? teks.gagalAksi : pesan)
    } finally {
      setAksiAntrean(null)
    }
  }

  async function masukDengan(body: LoginRequest) {
    if (sedangMasuk.current) return
    sedangMasuk.current = true
    setLoginLoading(true)
    setLoginError(null)
    try {
      const res = await login(body)
      setToken(res.token)
      setSesi({ token: res.token, pengguna: res.pengguna })
      setPin('')
      setPassword('')
      setHalaman('meja')
    } catch (err: unknown) {
      setLoginError(pesanError(err, 'login'))
    } finally {
      sedangMasuk.current = false
      setLoginLoading(false)
    }
  }

  function tekanAngka(angka: string) {
    const berikut = pin + angka
    if (berikut.length > 6) return
    setPin(berikut)
    setLoginError(null)
    if (berikut.length === 6) void masukDengan({ pin: berikut })
  }

  // Numpad juga bisa dipakai lewat keyboard (mesin kasir memakai keyboard).
  useEffect(() => {
    if (sesi || mode !== 'kasir') return
    function onKey(e: KeyboardEvent) {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        tekanAngka(e.key)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        setPin((sebelum) => sebelum.slice(0, -1))
      } else if (e.key === 'Enter' && pin.length === 6) {
        e.preventDefault()
        void masukDengan({ pin })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sesi, mode, pin])

  function submitOwner(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (password.length === 0) {
      setLoginError(teks.passwordKosong)
      return
    }
    void masukDengan({ password })
  }

  function keluar() {
    clearToken()
    setSesi(null)
    setMeja(null)
    setMenu(null)
    setTagihan(null)
    setDialog(null)
    setNotifikasi(null)
    setHalaman('meja')
    setLoginError(null)
    setPin('')
    setPassword('')
  }

  async function ubahItem(item: MenuItem, field: FieldMenu) {
    if (patching !== null) return
    const nilai = !item[field]
    const body: PatchMenuRequest =
      field === 'habis' ? { habis: nilai } : { aktif: nilai }
    setPatching(item.id)
    setMenuError(null)
    setMenu((sebelum) =>
      sebelum
        ? {
            ...sebelum,
            items: sebelum.items.map((i) => (i.id === item.id ? { ...i, ...body } : i)),
          }
        : sebelum,
    )
    try {
      const res = await patchMenu(item.id, body)
      setMenu((sebelum) =>
        sebelum
          ? {
              ...sebelum,
              items: sebelum.items.map((i) => (i.id === item.id ? res.item : i)),
            }
          : sebelum,
      )
    } catch (err: unknown) {
      setMenu((sebelum) =>
        sebelum
          ? {
              ...sebelum,
              items: sebelum.items.map((i) => (i.id === item.id ? item : i)),
            }
          : sebelum,
      )
      setMenuError(pesanError(err, 'biasa'))
    } finally {
      setPatching(null)
    }
  }

  if (booting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Logo size={48} />
        <div className="flex items-center gap-2 text-[13px] text-muted">
          <Spinner />
          <span>{teks.menyiapkan}</span>
        </div>
        <Footer />
      </div>
    )
  }

  if (!sesi) {
    return (
      <>
        <div className="grid min-h-screen place-items-center px-4 py-12">
          <div className="w-full max-w-[400px]">
            <div className="rounded-lg border border-line bg-surface p-7 shadow-2">
              <div className="flex flex-col items-center text-center">
                <Logo size={44} />
                <h1 className="mt-4 text-[21px] font-bold tracking-tight">
                  {teks.masukJudul}
                </h1>
                <p className="mt-1 text-[13px] text-muted">
                  {teks.namaOutlet} · {teks.masukSub}
                </p>
              </div>

              <div
                className="mt-6 grid grid-cols-2 gap-1 rounded-md bg-paper-2 p-1"
                role="tablist"
                aria-label={teks.masukJudul}
              >
                {(['kasir', 'owner'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => {
                      setMode(m)
                      setLoginError(null)
                      setPin('')
                      setPassword('')
                    }}
                    className={`h-9 rounded-sm text-[13px] font-semibold transition-all duration-150 ${
                      mode === m
                        ? 'bg-surface text-accent shadow-1'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    {m === 'kasir' ? teks.tabKasir : teks.tabPemilik}
                  </button>
                ))}
              </div>

              {loginError && (
                <div className="mt-4">
                  <ErrorBanner pesan={loginError} />
                </div>
              )}

              {mode === 'kasir' ? (
                <div className="mt-6">
                  <Label>{teks.labelPin}</Label>
                  <div
                    role="group"
                    aria-label={`${pin.length} / 6`}
                    className="mt-2 flex justify-center gap-2"
                  >
                    {Array.from({ length: 6 }, (_, i) => (
                      <span
                        key={i}
                        className={`grid h-11 w-9 place-items-center rounded-sm border text-[18px] font-bold transition-colors duration-150 ${
                          i < pin.length
                            ? 'border-accent bg-accent-soft text-accent'
                            : 'border-line bg-paper text-ink'
                        }`}
                      >
                        {i < pin.length ? '•' : ''}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
                      <NumKey key={n} onClick={() => tekanAngka(n)}>
                        {n}
                      </NumKey>
                    ))}
                    <KunciTeks onClick={() => setPin((sebelum) => sebelum.slice(0, -1))}>
                      {teks.tombolHapus}
                    </KunciTeks>
                    <NumKey onClick={() => tekanAngka('0')}>0</NumKey>
                    <KunciTeks
                      onClick={() => {
                        setPin('')
                        setLoginError(null)
                      }}
                    >
                      {teks.tombolUlangi}
                    </KunciTeks>
                  </div>
                  <button
                    type="button"
                    disabled={loginLoading || pin.length !== 6}
                    onClick={() => void masukDengan({ pin })}
                    className={`mt-4 ${TOMBOL_PRIMER}`}
                  >
                    {loginLoading && <Spinner />}
                    {teks.tombolMasuk}
                  </button>
                </div>
              ) : (
                <form onSubmit={submitOwner} className="mt-6">
                  <Label>{teks.labelPassword}</Label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setLoginError(null)
                    }}
                    placeholder={teks.placeholderPassword}
                    autoComplete="current-password"
                    className="mt-2 h-11 w-full rounded-sm border border-line bg-paper px-3.5 text-[14px] text-ink outline-none transition-colors duration-150 placeholder:text-idle focus:border-accent focus:bg-surface"
                  />
                  <button
                    type="submit"
                    disabled={loginLoading || password.length === 0}
                    className={`mt-4 ${TOMBOL_PRIMER}`}
                  >
                    {loginLoading && <Spinner />}
                    {teks.tombolMasuk}
                  </button>
                </form>
              )}

              <p className="mt-6 border-t border-line pt-4 text-center text-[11.5px] text-muted">
                {teks.demoPrefix} {teks.demoKasir}:{' '}
                <span className="font-semibold tabular-nums text-ink">{teks.demoPin}</span>
                {' · '}
                {teks.demoPemilik}:{' '}
                <span className="font-semibold text-ink">{teks.demoPassword}</span>
              </p>
            </div>
          </div>
        </div>
        <Footer />
      </>
    )
  }

  const owner = sesi.pengguna.peran === 'owner'
  const inisial = sesi.pengguna.nama.trim().charAt(0).toUpperCase() || 'K'
  const kategoriList = menu ? [...menu.kategori].sort((a, b) => a.urutan - b.urutan) : []
  const grupList = menu ? [...menu.grup_addon].sort((a, b) => a.urutan - b.urutan) : []

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line bg-surface px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Logo />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[14px] font-bold">{teks.merek}</div>
            <div className="truncate text-[11.5px] text-muted">
              {teks.namaOutlet} · {meja?.length ?? '—'} {teks.meja}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Pill tone={healthOk === false ? 'merah' : 'akcen'} dot>
            {healthOk === false ? teks.serverMatiPill : teks.lokal}
          </Pill>
          <span className="hidden tabular-nums text-[13px] text-muted md:inline">{jam}</span>
          <div className="hidden items-center gap-2 border-l border-line pl-3 sm:flex">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-accent-soft text-[12px] font-bold text-accent">
              {inisial}
            </span>
            <span className="leading-tight">
              <span className="block text-[13px] font-semibold">{sesi.pengguna.nama}</span>
              <span className="block text-[11px] text-muted">
                {owner ? teks.peranOwner : teks.peranKasir}
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={keluar}
            className="h-9 rounded-sm border border-line bg-surface px-3 text-[12.5px] font-semibold text-muted transition-colors duration-150 hover:border-accent hover:text-accent"
          >
            {teks.keluar}
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        <nav className="hidden w-[220px] shrink-0 flex-col border-r border-line bg-paper px-3 py-6 md:flex">
          <div className="px-3">
            <Label>{teks.navigasi}</Label>
          </div>
          <div className="mt-3 space-y-1">
            <NavItem
              aktif={halaman === 'meja'}
              label={teks.navMeja}
              onClick={() => setHalaman('meja')}
            />
            {owner && (
              <>
                <NavItem
                  aktif={halaman === 'menu'}
                  label={teks.navMenu}
                  onClick={() => setHalaman('menu')}
                />
                <NavItem
                  aktif={halaman === 'qr'}
                  label={teks.navQR}
                  onClick={() => setHalaman('qr')}
                />
              </>
            )}
            <NavItem
              aktif={halaman === 'ringkasan'}
              label={teks.navRingkasan}
              onClick={() => setHalaman('ringkasan')}
            />
            {owner && (
              <NavItem
                aktif={halaman === 'pengaturan'}
                label={teks.navPengaturan}
                onClick={() => setHalaman('pengaturan')}
              />
            )}
          </div>
          <div className="mt-auto rounded-md border border-line bg-surface p-3.5 shadow-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.09em] text-accent">
              {teks.milestone}
            </div>
            <p className="mt-1 text-[11.5px] text-muted">{teks.milestoneCatatan}</p>
          </div>
        </nav>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">
          <div className="mb-5 flex flex-wrap gap-2 md:hidden">
            <NavItem
              aktif={halaman === 'meja'}
              label={teks.navMeja}
              onClick={() => setHalaman('meja')}
            />
            {owner && (
              <>
                <NavItem
                  aktif={halaman === 'menu'}
                  label={teks.navMenu}
                  onClick={() => setHalaman('menu')}
                />
                <NavItem
                  aktif={halaman === 'qr'}
                  label={teks.navQR}
                  onClick={() => setHalaman('qr')}
                />
              </>
            )}
            <NavItem
              aktif={halaman === 'ringkasan'}
              label={teks.navRingkasan}
              onClick={() => setHalaman('ringkasan')}
            />
            {owner && (
              <NavItem
                aktif={halaman === 'pengaturan'}
                label={teks.navPengaturan}
                onClick={() => setHalaman('pengaturan')}
              />
            )}
          </div>

          {halaman === 'meja' ? (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
              <section className="min-w-0">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h1 className="text-[21px] font-bold leading-tight tracking-tight">
                      {teks.papanMeja}
                    </h1>
                    <p className="mt-1 text-[13px] text-muted">{teks.papanMejaSub}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill tone="netral">
                      {meja?.length ?? 0} {teks.meja}
                    </Pill>
                    <button
                      type="button"
                      onClick={muatMeja}
                      disabled={mejaLoading}
                      className="inline-flex h-8 items-center gap-2 rounded-sm border border-line bg-surface px-3 text-[12px] font-semibold text-muted transition-colors duration-150 hover:border-accent hover:text-accent disabled:opacity-60"
                    >
                      {mejaLoading && <Spinner />}
                      {teks.segarkan}
                    </button>
                  </div>
                </div>

                {mejaError && <ErrorBanner pesan={mejaError} onRetry={muatMeja} />}

                <PesananBaruSection
                  antrean={antrean}
                  loading={antrean === null}
                  error={antreanError}
                  onRetry={muatAntrean}
                  onAksi={(pesanan) => void aksiPesanan(pesanan)}
                  working={aksiAntrean}
                />

                {mejaLoading && !meja ? (
                  <SkeletonMeja />
                ) : meja && meja.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {meja.map((m) => (
                      <TableTile
                        key={m.id}
                        meja={m}
                        selected={m.id === pilihMejaId}
                        onSelect={setPilihMejaId}
                      />
                    ))}
                  </div>
                ) : (
                  !mejaError && (
                    <div className="rounded-md border border-dashed border-line bg-surface px-6 py-14 text-center">
                      <p className="text-[13.5px] font-semibold">{teks.pilihMeja}</p>
                      <p className="mt-1.5 text-[12px] text-muted">{teks.pilihMejaSub}</p>
                    </div>
                  )
                )}

                <HariIniCard ringkasan={ringkasan} />
              </section>

              <aside className="min-w-0 xl:sticky xl:top-24 xl:self-start">
                <DetailMejaCard
                  meja={mejaTerpilih}
                  tagihan={tagihan}
                  tagihanLoading={tagihanLoading}
                  tagihanError={tagihanError}
                  onMuatUlang={() => {
                    if (mejaTerpilih) muatTagihan(mejaTerpilih.id)
                  }}
                  onBayar={() => setDialog('bayar')}
                  onDiskon={() => setDialog('diskon')}
                  onKonfirmasi={() => setDialog('konfirmasi')}
                  onTutup={() => setDialog('tutup')}
                  aksiBerjalan={aksiTagihan}
                />
              </aside>
            </div>
          ) : halaman === 'ringkasan' ? (
            <RingkasanPage
              ringkasan={ringkasan}
              error={ringkasanError}
              loading={ringkasanLoading}
              onSegarkan={muatRingkasan}
            />
          ) : halaman === 'pengaturan' ? (
            <PengaturanPage
              data={pengaturan}
              error={pengaturanError}
              onSimpan={(body) => simpanPengaturan(body)}
            />
          ) : halaman === 'qr' ? (
            <QrPage daftarMeja={meja} />
          ) : (
            <div className="min-w-0">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 className="text-[21px] font-bold leading-tight tracking-tight">
                    {teks.kelolaMenu}
                  </h1>
                  <p className="mt-1 text-[13px] text-muted">{teks.kelolaMenuSub}</p>
                </div>
                <Pill tone="netral">
                  {menu?.items.length ?? 0} {teks.item}
                </Pill>
              </div>

              {menuError && <ErrorBanner pesan={menuError} onRetry={muatMenu} />}

              {menuLoading && !menu ? (
                <SkeletonMenu />
              ) : menu ? (
                menu.items.length === 0 ? (
                  <div className="rounded-md border border-dashed border-line bg-surface px-6 py-14 text-center">
                    <p className="text-[13.5px] font-semibold">{teks.menuKosong}</p>
                    <p className="mt-1.5 text-[12px] text-muted">{teks.menuKosongSub}</p>
                  </div>
                ) : (
                  <>
                    {kategoriList.map((kategori) => {
                      const items = menu.items
                        .filter((i) => i.kategori_id === kategori.id)
                        .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
                      if (items.length === 0) return null
                      return (
                        <section key={kategori.id} className="mb-8">
                          <div className="mb-3 flex items-center gap-3">
                            <Label>{kategori.nama}</Label>
                            <span className="h-px flex-1 bg-line" />
                            <span className="text-[11px] text-muted">
                              {items.length} {teks.item}
                            </span>
                          </div>
                          <div className="space-y-2.5">
                            {items.map((item) => (
                              <ItemMenuCard
                                key={item.id}
                                item={item}
                                working={patching === item.id}
                                onToggle={ubahItem}
                              />
                            ))}
                          </div>
                        </section>
                      )
                    })}

                    {grupList.length > 0 && (
                      <section className="mt-10">
                        <div className="mb-3 flex items-center gap-3">
                          <Label>{teks.grupAddon}</Label>
                          <span className="h-px flex-1 bg-line" />
                          <span className="text-[11px] text-muted">
                            {grupList.length} {teks.grup}
                          </span>
                        </div>
                        <div className="grid gap-3 lg:grid-cols-2">
                          {grupList.map((grup) => (
                            <GrupAddonCard key={grup.id} grup={grup} />
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )
              ) : null}
            </div>
          )}
        </main>
      </div>

      {dialog && tagihan && (
        <>
          {dialog === 'bayar' && (
            <DialogBayar
              tagihan={tagihan}
              onTutup={() => setDialog(null)}
              onBayar={(body) => aksiBayar(body)}
            />
          )}
          {dialog === 'diskon' && (
            <DialogDiskon
              tagihan={tagihan}
              onTutup={() => setDialog(null)}
              onDiskon={(body) => aksiDiskon(body)}
            />
          )}
          {dialog === 'konfirmasi' && (
            <DialogKonfirmasi
              judul={teks.konfirmasiJudul}
              sub={teks.konfirmasiSub}
              labelTombol={teks.konfirmasiYa}
              onTutup={() => setDialog(null)}
              onKonfirmasi={aksiKonfirmasi}
            />
          )}
          {dialog === 'tutup' && (
            <DialogKonfirmasi
              judul={teks.tutupJudul}
              sub={teks.tutupSub}
              labelTombol={teks.tutupYa}
              onTutup={() => setDialog(null)}
              onKonfirmasi={aksiTutup}
            />
          )}
        </>
      )}

      {notifikasi && (
        <div
          role="status"
          className="fixed bottom-12 left-1/2 z-50 -translate-x-1/2 rounded-full border border-line bg-surface px-4 py-2 text-[12px] font-semibold text-accent shadow-2 transition-opacity duration-150"
        >
          {notifikasi}
        </div>
      )}

      <Footer />
    </div>
  )
}
