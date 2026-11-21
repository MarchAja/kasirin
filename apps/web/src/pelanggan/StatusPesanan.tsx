import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import {
  buatQrisPelanggan,
  getStatusMeja,
  infoQrisPelanggan,
} from '../api'
import { formatJam, formatNomorMeja, formatRupiah } from '../format'
import { teks } from '../teks'
import type {
  QrisInfo,
  StatusPesanan as Status,
  StatusResponse,
} from '../types'
import { pesanErrorPelanggan } from './Keranjang'

const TOMBOL_PRIMER =
  'inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent text-[14px] font-semibold text-white shadow-2 transition-all duration-150 hover:bg-accent-2 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50'

function Spinner() {
  return (
    <span
      className="spinner inline-block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    />
  )
}

type Tone = 'netral' | 'akcen' | 'kuning' | 'biru' | 'hijau' | 'merah'

const PIL_TONE: Record<Tone, string> = {
  netral: 'bg-paper-2 text-muted',
  akcen: 'bg-accent-soft text-accent',
  kuning: 'bg-amber-soft text-amber',
  biru: 'bg-blue-soft text-blue',
  hijau: 'bg-green-soft text-green',
  merah: 'bg-red-soft text-red',
}

const DOT_TONE: Record<Tone, string> = {
  netral: 'bg-idle',
  akcen: 'bg-accent',
  kuning: 'bg-amber',
  biru: 'bg-blue',
  hijau: 'bg-green',
  merah: 'bg-red',
}

const STATUS_TONE: Record<Status, Tone> = {
  baru: 'kuning',
  diterima: 'biru',
  disajikan: 'hijau',
  ditutup: 'netral',
  dibatalkan: 'merah',
}

function labelStatus(status: Status): string {
  switch (status) {
    case 'baru':
      return teks.menungguKasir
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

/** Status tagihan yang perlu diketahui pelanggan setelah pesanan disajikan. */
function infoTagihan(
  status: string | null,
): { tone: Tone; label: string; catatan: string | null } | null {
  switch (status) {
    case 'lunas':
      return {
        tone: 'hijau',
        label: teks.statusLunas,
        catatan: teks.statusLunasCatatan,
      }
    case 'perlu_dicek':
      return { tone: 'kuning', label: teks.statusMenungguCek, catatan: null }
    case 'ditutup':
      return { tone: 'netral', label: teks.statusSelesai, catatan: null }
    default:
      return null
  }
}

function jamDibuat(iso: string): string {
  const tanggal = new Date(iso)
  return Number.isNaN(tanggal.getTime()) ? '' : formatJam(tanggal)
}

function sudahKedaluwarsa(iso: string | null): boolean {
  if (!iso) return false
  const waktu = new Date(iso).getTime()
  return !Number.isNaN(waktu) && waktu <= Date.now()
}

interface Props {
  token: string
  onTambahPesanan: () => void
}

export function StatusPesanan({ token, onTambahPesanan }: Props) {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)

  // Milestone 4 — QRIS otomatis yang dibuat pelanggan dari HP sendiri.
  const [qris, setQris] = useState<QrisInfo | null>(null)
  const [qrData, setQrData] = useState<string | null>(null)
  const [qrisLoading, setQrisLoading] = useState(false)
  const [qrisError, setQrisError] = useState<string | null>(null)

  // Polling 3 detik — seluruh pesanan selama satu kunjungan jadi satu tagihan.
  useEffect(() => {
    let aktif = true
    async function muat() {
      try {
        const res = await getStatusMeja(token)
        if (aktif) {
          setStatus(res)
          setError(null)
        }
      } catch (err: unknown) {
        if (aktif) setError(pesanErrorPelanggan(err, teks.gagalMuatStatus))
      } finally {
        if (aktif) setLoading(false)
      }
    }
    void muat()
    const id = window.setInterval(() => void muat(), 3000)
    return () => {
      aktif = false
      window.clearInterval(id)
    }
  }, [token, retry])

  const totalDariItem =
    status?.pesanan.reduce(
      (total, pesanan) =>
        total +
        pesanan.items.reduce(
          (n, item) => n + item.harga_satuan * item.jumlah,
          0,
        ),
      0,
    ) ?? 0
  const total = status?.tagihan?.total ?? totalDariItem
  const statusTagihan = status?.tagihan?.status ?? null
  const infoTagihanStatus = infoTagihan(statusTagihan)
  const modeBayar =
    status?.mode_bayar ?? status?.outlet.mode_bayar ?? 'manual'
  const bisaQris = modeBayar === 'otomatis' || modeBayar === 'keduanya'
  const tertunda = statusTagihan === 'tertunda'
  const bisaBayarQris = bisaQris && statusTagihan === 'buka'
  const qrisKedaluwarsa = sudahKedaluwarsa(qris?.expired_at ?? null)
  const adaQris = qris !== null

  // qr_data bisa berupa URL (Midtrans) atau teks biasa (simulasi); keduanya
  // diubah menjadi data URL QR agar tetap bisa dipindai dari layar HP.
  useEffect(() => {
    let aktif = true
    setQrData(null)
    if (!qris?.qr_data) return
    QRCode.toDataURL(qris.qr_data, { width: 220, margin: 1 })
      .then((url) => {
        if (aktif) setQrData(url)
      })
      .catch(() => {
        if (aktif) setQrData(null)
      })
    return () => {
      aktif = false
    }
  }, [qris])

  // Polling QRIS 3 detik berjalan paralel dengan polling status pesanan.
  useEffect(() => {
    if (!adaQris || !bisaQris) return
    if (statusTagihan !== 'buka' && statusTagihan !== 'tertunda') return
    let aktif = true
    async function muat() {
      try {
        const res = await infoQrisPelanggan(token)
        if (aktif) setQris(res.qris)
      } catch {
        // Polling status tetap berjalan walau info QRIS gagal sesekali.
      }
    }
    void muat()
    const id = window.setInterval(() => void muat(), 3000)
    return () => {
      aktif = false
      window.clearInterval(id)
    }
  }, [token, adaQris, bisaQris, statusTagihan])

  async function mintaQris() {
    setQrisLoading(true)
    setQrisError(null)
    try {
      const res = await buatQrisPelanggan(token)
      setQris(res.qris)
      if (res.tagihan) {
        setStatus((sebelum) =>
          sebelum ? { ...sebelum, tagihan: res.tagihan } : sebelum,
        )
      }
    } catch (err: unknown) {
      setQrisError(pesanErrorPelanggan(err, teks.qrisPelangganGagal))
    } finally {
      setQrisLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && status === null && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-red/30 bg-red-soft px-3.5 py-3 text-[12.5px] text-red"
        >
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              setRetry((n) => n + 1)
            }}
            className="font-semibold underline underline-offset-2"
          >
            {teks.cobaLagi}
          </button>
        </div>
      )}

      <section className="rounded-lg border border-line bg-surface p-5 shadow-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted">
              {teks.totalTagihan}
            </p>
            <p className="mt-2 tabular-nums text-[26px] font-bold leading-none text-ink">
              {formatRupiah(total)}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {status && (
              <span className="rounded-full bg-paper-2 px-3 py-1.5 text-[12px] font-semibold tabular-nums text-muted">
                {teks.mejaJudul} {formatNomorMeja(status.meja.nomor)}
              </span>
            )}
            {infoTagihanStatus && (
              <span
                className={`inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11.5px] font-semibold ${PIL_TONE[infoTagihanStatus.tone]}`}
              >
                <span
                  className={`h-[7px] w-[7px] rounded-full ${DOT_TONE[infoTagihanStatus.tone]}`}
                  aria-hidden="true"
                />
                {infoTagihanStatus.label}
              </span>
            )}
          </div>
        </div>
        {status?.dibuka_pada && (
          <p className="mt-3 border-t border-line pt-3 text-[11.5px] text-muted">
            {teks.kunjunganAktif} · {teks.dibukaPada} {jamDibuat(status.dibuka_pada)}
          </p>
        )}
        {infoTagihanStatus?.catatan && (
          <p className="mt-1 text-[11.5px] text-muted">
            {infoTagihanStatus.catatan}
          </p>
        )}
      </section>

      {bisaBayarQris && (
        <section className="rounded-lg border border-line bg-surface p-5 shadow-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted">
            {teks.bayarDariHp}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">
            {teks.bayarDariHpSub}
          </p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
            {teks.bayarDiKasir} · {teks.bayarDiKasirSub}
          </p>
          {qrisError && (
            <div
              role="alert"
              className="mt-3 rounded-md border border-red/30 bg-red-soft px-3 py-2 text-[12px] text-red"
            >
              {qrisError}
              <button
                type="button"
                onClick={() => void mintaQris()}
                className="ml-2 font-semibold underline underline-offset-2"
              >
                {teks.cobaLagi}
              </button>
            </div>
          )}
          {!qris ? (
            <button
              type="button"
              disabled={qrisLoading}
              onClick={() => void mintaQris()}
              className={`mt-4 ${TOMBOL_PRIMER}`}
            >
              {qrisLoading && <Spinner />}
              {qrisLoading ? teks.qrisMemuat : teks.bayarDariHp}
            </button>
          ) : (
            <div className="mt-4 flex flex-col items-center">
              {qrData ? (
                <img
                  src={qrData}
                  alt={teks.bayarDariHp}
                  className="h-auto w-[180px] rounded-md border border-line"
                />
              ) : (
                <div className="grid h-[180px] w-[180px] place-items-center rounded-md border border-dashed border-line bg-paper-2 text-[11px] text-muted">
                  {teks.qrisMemuat}
                </div>
              )}
              <dl className="mt-3 w-full space-y-1 border-t border-line pt-3 text-[12.5px]">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted">{teks.total}</dt>
                  <dd className="tabular-nums font-bold text-ink">
                    {formatRupiah(qris.amount)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted">{teks.qrisKedaluwarsa}</dt>
                  <dd className="tabular-nums text-ink">
                    {qris.expired_at ? jamDibuat(qris.expired_at) : '—'}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted">{teks.metodeBayar}</dt>
                  <dd className="text-ink">
                    {qris.provider === 'mock'
                      ? teks.providerSimulasi
                      : teks.providerMidtrans}
                  </dd>
                </div>
              </dl>
              {qrisKedaluwarsa ? (
                <div className="mt-3 w-full rounded-md border border-amber/30 bg-amber-soft px-3 py-2.5">
                  <p className="text-[12px] font-semibold text-amber">
                    {teks.qrisPelangganKedaluwarsa}
                  </p>
                  <button
                    type="button"
                    disabled={qrisLoading}
                    onClick={() => void mintaQris()}
                    className="mt-2 h-8 w-full rounded-sm border border-amber/40 bg-surface px-3 text-[11.5px] font-semibold text-amber transition-colors duration-150 hover:border-amber disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {teks.qrisBuatBaru}
                  </button>
                </div>
              ) : (
                <p className="mt-3 flex items-center gap-2 text-[11.5px] text-muted">
                  <Spinner />
                  {teks.qrisPelangganMenunggu}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {tertunda && (
        <div
          role="status"
          className="rounded-md border border-amber/30 bg-amber-soft px-3.5 py-3"
        >
          <p className="text-[12.5px] font-semibold text-amber">
            {teks.tagihanTerkunci}
          </p>
          <p className="mt-0.5 text-[11.5px] text-amber">
            {teks.tagihanTerkunciSub}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold text-ink">{teks.pesananAnda}</h2>
        <button
          type="button"
          disabled={tertunda}
          onClick={onTambahPesanan}
          className="h-9 rounded-full border border-accent bg-accent-soft px-3.5 text-[12px] font-semibold text-accent transition-all duration-150 hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          + {teks.tambahPesanan}
        </button>
      </div>

      {loading && status === null ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-28 rounded-lg border border-line bg-paper-2" />
          ))}
          <p className="text-center text-[12px] text-muted">{teks.memuatStatus}</p>
        </div>
      ) : status && status.pesanan.length > 0 ? (
        <ul className="space-y-3">
          {status.pesanan.map((pesanan) => {
            const tone = STATUS_TONE[pesanan.status]
            return (
              <li
                key={pesanan.id}
                className="rounded-lg border border-line bg-surface p-4 shadow-1"
              >
                <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
                  <span
                    className={`inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11.5px] font-semibold ${PIL_TONE[tone]}`}
                  >
                    <span className={`h-[7px] w-[7px] rounded-full ${DOT_TONE[tone]}`} aria-hidden="true" />
                    {labelStatus(pesanan.status)}
                  </span>
                  <span className="text-[11px] tabular-nums text-muted">
                    {jamDibuat(pesanan.dibuat_pada)}
                  </span>
                </div>
                <ul className="mt-3 space-y-3">
                  {pesanan.items.map((item) => (
                    <li key={item.id}>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-[13.5px] font-semibold leading-tight text-ink">
                          <span className="tabular-nums text-muted">{item.jumlah}× </span>
                          {item.nama}
                        </span>
                        <span className="shrink-0 tabular-nums text-[13px] font-bold text-accent">
                          {formatRupiah(item.harga_satuan * item.jumlah)}
                        </span>
                      </div>
                      {item.addons.length > 0 && (
                        <ul className="mt-1 space-y-0.5 pl-5">
                          {item.addons.map((addon) => (
                            <li
                              key={addon.addon_id}
                              className="text-[11.5px] leading-tight text-muted"
                            >
                              ↳ {addon.nama}
                              {addon.harga > 0 ? ` · ${formatRupiah(addon.harga)}` : ''}
                            </li>
                          ))}
                        </ul>
                      )}
                      {item.catatan && (
                        <p className="mt-1 pl-5 text-[11.5px] italic leading-tight text-muted">
                          “{item.catatan}”
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="rounded-md border border-dashed border-line bg-surface px-5 py-12 text-center">
          <p className="text-[13.5px] font-semibold">{teks.statusKosongPesanan}</p>
          <p className="mt-1 text-[12px] text-muted">{teks.statusKosongSub}</p>
        </div>
      )}
    </div>
  )
}
