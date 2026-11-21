import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import QRCode from 'qrcode'
import {
  ApiError,
  clearToken,
  getAntrean,
  getHealth,
  getMe,
  getMenu,
  getToken,
  getTables,
  login,
  onUnauthorized,
  patchMenu,
  sajikanPesanan,
  setToken,
  terimaPesanan,
} from './api'
import { formatJam, formatNomorMeja, formatRupiah, urlFoto } from './format'
import Pelanggan from './pelanggan/Pelanggan'
import { teks } from './teks'
import type {
  GrupAddon,
  LoginRequest,
  Meja,
  MenuItem,
  MenuResponse,
  PatchMenuRequest,
  Pengguna,
  PesananAntrean,
  StatusMeja,
  StatusPesanan,
} from './types'

type Tone = 'netral' | 'akcen' | 'hijau' | 'kuning' | 'biru' | 'merah'
type Mode = 'kasir' | 'owner'
type Halaman = 'meja' | 'menu' | 'qr'
type FieldMenu = 'habis' | 'aktif'

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

const TOMBOL_PRIMER =
  'inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent text-[14px] font-semibold text-white shadow-2 transition-all duration-150 hover:bg-accent-2 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50'

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

function DetailMejaCard({ meja }: { meja?: Meja }) {
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
        <div className="rounded-md border border-line bg-paper px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted">
              {teks.kunjunganAktif}
            </span>
            <Pill tone={tone} dot>
              {LABEL_STATUS_MEJA[meja.status]}
            </Pill>
          </div>
          <p className="mt-3 text-[12px] text-muted">{teks.tagihanBerjalan}</p>
          <p className="mt-1 tabular-nums text-[26px] font-bold leading-none text-ink">
            {formatRupiah(meja.total)}
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-line bg-paper px-4 py-10 text-center">
          <p className="text-[13.5px] font-semibold text-ink">{teks.belumPesanan}</p>
          <p className="mt-1.5 text-[12px] text-muted">{teks.belumPesananSub}</p>
        </div>
      )}
    </div>
  )
}

function HariIniCard() {
  const batang = [38, 52, 34, 64, 48, 76, 100]
  return (
    <div className="mt-6 rounded-lg border border-line bg-surface p-5 shadow-1">
      <div className="flex items-center justify-between">
        <Label>{teks.hariIni}</Label>
        <Pill tone="hijau">{teks.naik}</Pill>
      </div>
      <div className="mt-3 tabular-nums text-[26px] font-bold leading-none">
        {formatRupiah(0)}
      </div>
      <p className="mt-2 text-[12px] text-muted">{teks.belumTransaksi}</p>
      <div className="mt-5 flex h-10 items-end gap-1.5" aria-hidden="true">
        {batang.map((tinggi, i) => (
          <span
            key={i}
            className={`flex-1 rounded-sm ${i === batang.length - 1 ? 'bg-accent' : 'bg-accent-soft'}`}
            style={{ height: `${tinggi}%` }}
          />
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted">{teks.aktivitas}</p>
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
  const sedangMasuk = useRef(false)

  // 401 dari panggilan mana pun mengembalikan pengguna ke layar masuk.
  useEffect(
    () =>
      onUnauthorized(() => {
        setSesi(null)
        setMeja(null)
        setMenu(null)
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
  const mejaTerpilih = meja?.find((m) => m.id === pilihMejaId)
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
          </div>
          <div className="mt-auto rounded-md border border-line bg-surface p-3.5 shadow-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.09em] text-accent">
              {teks.milestone}
            </div>
            <p className="mt-1 text-[11.5px] text-muted">{teks.milestoneCatatan}</p>
          </div>
        </nav>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">
          <div className="mb-5 flex gap-2 md:hidden">
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

                <HariIniCard />
              </section>

              <aside className="min-w-0 xl:sticky xl:top-24 xl:self-start">
                <DetailMejaCard meja={mejaTerpilih} />
              </aside>
            </div>
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

      <Footer />
    </div>
  )
}
