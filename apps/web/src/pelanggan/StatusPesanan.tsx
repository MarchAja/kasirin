import { useEffect, useState } from 'react'
import { getStatusMeja } from '../api'
import { formatJam, formatNomorMeja, formatRupiah } from '../format'
import { teks } from '../teks'
import type { StatusPesanan as Status, StatusResponse } from '../types'
import { pesanErrorPelanggan } from './Keranjang'

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

function jamDibuat(iso: string): string {
  const tanggal = new Date(iso)
  return Number.isNaN(tanggal.getTime()) ? '' : formatJam(tanggal)
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
          {status && (
            <span className="rounded-full bg-paper-2 px-3 py-1.5 text-[12px] font-semibold tabular-nums text-muted">
              {teks.mejaJudul} {formatNomorMeja(status.meja.nomor)}
            </span>
          )}
        </div>
        {status?.dibuka_pada && (
          <p className="mt-3 border-t border-line pt-3 text-[11.5px] text-muted">
            {teks.kunjunganAktif} · {teks.dibukaPada} {jamDibuat(status.dibuka_pada)}
          </p>
        )}
      </section>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold text-ink">{teks.pesananAnda}</h2>
        <button
          type="button"
          onClick={onTambahPesanan}
          className="h-9 rounded-full border border-accent bg-accent-soft px-3.5 text-[12px] font-semibold text-accent transition-all duration-150 hover:bg-accent hover:text-white"
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
