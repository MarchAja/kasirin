import { useEffect, useRef, useState } from 'react'
import {
  ApiError,
  getInfoMeja,
  getMenuPelanggan,
  getStatusMeja,
} from '../api'
import { formatNomorMeja, formatRupiah, urlFoto } from '../format'
import { teks } from '../teks'
import type { InfoMejaResponse, MenuItem, MenuResponse } from '../types'
import { Keranjang, pesanErrorPelanggan, totalKeranjang } from './Keranjang'
import type { CartLine } from './Keranjang'
import { SheetAddon } from './SheetAddon'
import type { HasilPilih } from './SheetAddon'
import { StatusPesanan } from './StatusPesanan'
import './pelanggan.css'

type Tampilan = 'menu' | 'status'

const TOMBOL_PRIMER =
  'inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent text-[14px] font-semibold text-white shadow-2 transition-all duration-150 hover:bg-accent-2 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50'

function Logo() {
  return (
    <span
      aria-hidden="true"
      className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-accent text-[15px] font-bold text-white shadow-1"
    >
      K
    </span>
  )
}

function Spinner() {
  return (
    <span
      className="spinner inline-block h-4 w-4 shrink-0 rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    />
  )
}

function Watermark() {
  return (
    <div className="bg-paper-2/60 py-0.5 text-center text-[9px] font-semibold tracking-tight text-idle">
      {teks.watermark}
    </div>
  )
}

function LayarPesan({
  judul,
  sub,
  onRetry,
}: {
  judul: string
  sub: string
  onRetry?: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <Watermark />
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
        <Logo />
        <h1 className="mt-2 text-[19px] font-bold tracking-tight">{judul}</h1>
        <p className="max-w-[300px] text-[13px] text-muted">{sub}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className={`mt-4 max-w-[240px] ${TOMBOL_PRIMER}`}>
            {teks.cobaLagi}
          </button>
        )}
      </div>
    </div>
  )
}

export default function Pelanggan({ token }: { token: string }) {
  const [info, setInfo] = useState<InfoMejaResponse | null>(null)
  const [menu, setMenu] = useState<MenuResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tidakValid, setTidakValid] = useState(false)
  const [retry, setRetry] = useState(0)
  const [tampilan, setTampilan] = useState<Tampilan>('menu')
  const [cari, setCari] = useState('')
  const [kategoriAktif, setKategoriAktif] = useState<number | null>(null)
  const [keranjang, setKeranjang] = useState<CartLine[]>([])
  const [itemAddon, setItemAddon] = useState<MenuItem | null>(null)
  const [keranjangBuka, setKeranjangBuka] = useState(false)
  const idBaris = useRef(0)

  useEffect(() => {
    let aktif = true
    setLoading(true)
    setError(null)
    Promise.all([
      getInfoMeja(token),
      getMenuPelanggan(token),
      getStatusMeja(token),
    ])
      .then(([infoRes, menuRes, statusRes]) => {
        if (!aktif) return
        setInfo(infoRes)
        setMenu(menuRes)
        // QR dibuka ulang saat kunjungan masih berjalan → langsung ke status.
        if (statusRes.ada_kunjungan) setTampilan('status')
      })
      .catch((err: unknown) => {
        if (!aktif) return
        if (err instanceof ApiError && err.status === 404) {
          setTidakValid(true)
        } else {
          setError(pesanErrorPelanggan(err, teks.gagalMuatPelanggan))
        }
      })
      .finally(() => {
        if (aktif) setLoading(false)
      })
    return () => {
      aktif = false
    }
  }, [token, retry])

  if (tidakValid) {
    return (
      <LayarPesan
        judul={teks.qrTidakValid}
        sub={teks.qrTidakValidSub}
      />
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-paper">
        <Watermark />
        <div className="mx-auto w-full max-w-[460px] flex-1 border-x border-line bg-paper px-4 py-5">
          <div className="h-10 w-2/3 rounded-md bg-paper-2" />
          <div className="mt-5 h-11 rounded-full border border-line bg-surface" />
          <div className="mt-7 h-5 w-1/2 rounded bg-paper-2" />
          <div className="mt-3 flex gap-3 overflow-hidden">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 w-[140px] shrink-0 rounded-lg bg-paper-2" />
            ))}
          </div>
          <div className="mt-8 space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[100px] rounded-md border border-line bg-surface" />
            ))}
          </div>
          <div className="mt-8 flex justify-center text-[12px] text-muted">
            <Spinner />
            <span className="ml-2">{teks.menyiapkan}</span>
          </div>
        </div>
      </div>
    )
  }

  if (error || !info || !menu) {
    return (
      <LayarPesan
        judul={teks.gagalMuatPelanggan}
        sub={error ?? teks.gagalMuatPelanggan}
        onRetry={() => setRetry((n) => n + 1)}
      />
    )
  }

  const kategoriList = [...menu.kategori].sort((a, b) => a.urutan - b.urutan)
  const grupMap = new Map(menu.grup_addon.map((g) => [g.id, g]))
  const tersedia = menu.items.filter((i) => i.aktif && !i.habis)
  const favorit = tersedia.slice(0, 3)
  const unggulanId = favorit[0]?.id

  const query = cari.trim().toLowerCase()
  const daftarItem = menu.items
    .filter((i) => i.aktif)
    .filter((i) => (kategoriAktif === null || i.kategori_id === kategoriAktif))
    .filter(
      (i) =>
        query === '' ||
        i.nama.toLowerCase().includes(query) ||
        (menu.kategori.find((k) => k.id === i.kategori_id)?.nama ?? '')
          .toLowerCase()
          .includes(query),
    )
    .sort((a, b) => Number(a.habis) - Number(b.habis) || a.nama.localeCompare(b.nama, 'id'))

  const jumlahItem = keranjang.reduce((n, l) => n + l.jumlah, 0)
  const total = totalKeranjang(keranjang)
  const thumbnail = keranjang.slice(0, 4).map((l) => urlFoto(l.item.foto_path)).filter((f): f is string => f !== null)

  function tambahLangsung(item: MenuItem) {
    idBaris.current += 1
    setKeranjang((sebelum) => [
      ...sebelum,
      { id: idBaris.current, item, addons: [], catatan: '', jumlah: 1 },
    ])
  }

  function bukaItem(item: MenuItem) {
    if (!item.aktif || item.habis) return
    if ((item.grup_addon ?? []).length === 0) {
      tambahLangsung(item)
      return
    }
    setItemAddon(item)
  }

  function tambahDariSheet(hasil: HasilPilih) {
    idBaris.current += 1
    setKeranjang((sebelum) => [...sebelum, { id: idBaris.current, ...hasil }])
    setItemAddon(null)
  }

  function selesaiKirim() {
    setKeranjangBuka(false)
    setKeranjang([])
    setTampilan('status')
  }

  const grupItemAddon = itemAddon
    ? [...itemAddon.grup_addon]
        .map((id) => grupMap.get(id))
        .filter((g): g is NonNullable<typeof g> => Boolean(g))
        .sort((a, b) => a.urutan - b.urutan)
    : []

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <Watermark />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[460px] flex-col border-x border-line bg-paper pb-24">
        <header className="sticky top-0 z-20 border-b border-line bg-surface px-4 pb-3 pt-4">
          <div className="flex items-start gap-3">
            <Logo />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-[18px] font-bold leading-tight tracking-tight">
                  {info.outlet.nama}
                </h1>
                <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-green-soft px-2.5 text-[11px] font-semibold text-green">
                  <span className="h-[7px] w-[7px] rounded-full bg-green" aria-hidden="true" />
                  {teks.buka}
                </span>
              </div>
              <p className="mt-1 text-[12px] text-muted">
                {teks.mejaJudul} {formatNomorMeja(info.meja.nomor)} · {teks.makanDiTempat}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setKeranjangBuka(true)}
              disabled={jumlahItem === 0}
              aria-label={teks.keranjang}
              className="relative grid h-10 w-10 shrink-0 place-items-center rounded-md border border-line bg-surface text-[17px] transition-colors duration-150 hover:border-accent hover:text-accent disabled:opacity-40"
            >
              🛍
              {jumlahItem > 0 && (
                <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold tabular-nums text-white">
                  {jumlahItem}
                </span>
              )}
            </button>
          </div>

          {tampilan === 'menu' && (
            <div className="mt-4 flex h-11 items-center gap-2.5 rounded-full border border-line bg-surface px-4 shadow-1">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-muted"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m16.5 16.5 4 4" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder={teks.pelangganCari}
                aria-label={teks.pelangganCari}
                className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-idle"
              />
            </div>
          )}
        </header>

        <main className="flex-1 px-4 pt-5">
          {tampilan === 'status' ? (
            <StatusPesanan
              token={token}
              onTambahPesanan={() => setTampilan('menu')}
            />
          ) : (
            <>
              {favorit.length > 0 && query === '' && kategoriAktif === null && (
                <section className="mb-6">
                  <div className="mb-3 flex items-baseline justify-between gap-2">
                    <h2 className="text-[15px] font-bold text-ink">{teks.favoritHariIni}</h2>
                    <span className="text-[11px] text-muted">
                      {favorit.length} {teks.pilihanCount}
                    </span>
                  </div>
                  <div className="rail-favorit -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
                    {favorit.map((item) => {
                      const foto = urlFoto(item.foto_path)
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => bukaItem(item)}
                          className="relative h-[132px] w-[148px] shrink-0 overflow-hidden rounded-lg border border-line bg-paper-2 text-left shadow-1 transition-transform duration-150 hover:-translate-y-px"
                        >
                          {foto && (
                            <img
                              src={foto}
                              alt=""
                              loading="lazy"
                              className="absolute inset-0 h-full w-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          )}
                          <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" aria-hidden="true" />
                          {item.id === unggulanId && (
                            <span className="absolute left-2 top-2 rounded-full bg-amber-soft px-2 py-0.5 text-[9.5px] font-semibold text-amber">
                              {teks.palingLaris}
                            </span>
                          )}
                          <span className="absolute bottom-2 left-2 right-2">
                            <span className="block truncate text-[12.5px] font-bold leading-tight text-white">
                              {item.nama}
                            </span>
                            <span className="mt-0.5 block tabular-nums text-[11.5px] font-semibold text-white/90">
                              {formatRupiah(item.harga)}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )}

              <div className="rail-favorit -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1">
                <button
                  type="button"
                  onClick={() => setKategoriAktif(null)}
                  aria-pressed={kategoriAktif === null}
                  className={`h-9 shrink-0 rounded-full border px-4 text-[12.5px] font-semibold transition-all duration-150 ${
                    kategoriAktif === null
                      ? 'border-accent bg-accent text-white'
                      : 'border-line bg-surface text-muted hover:border-accent hover:text-ink'
                  }`}
                >
                  {teks.semua}
                </button>
                {kategoriList.map((kategori) => (
                  <button
                    key={kategori.id}
                    type="button"
                    onClick={() => setKategoriAktif(kategori.id)}
                    aria-pressed={kategoriAktif === kategori.id}
                    className={`h-9 shrink-0 rounded-full border px-4 text-[12.5px] font-semibold transition-all duration-150 ${
                      kategoriAktif === kategori.id
                        ? 'border-accent bg-accent text-white'
                        : 'border-line bg-surface text-muted hover:border-accent hover:text-ink'
                    }`}
                  >
                    {kategori.nama}
                  </button>
                ))}
              </div>

              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="text-[15px] font-bold text-ink">
                  {query ? teks.cariKosong : teks.semuaMenu}
                </h2>
                <span className="text-[11px] text-muted">
                  {daftarItem.length} {teks.item}
                </span>
              </div>

              {daftarItem.length === 0 ? (
                <div className="rounded-md border border-dashed border-line bg-surface px-5 py-12 text-center">
                  <p className="text-[13.5px] font-semibold">
                    {query ? teks.cariKosong : teks.menuPelangganKosong}
                  </p>
                  <p className="mt-1 text-[12px] text-muted">
                    {query ? teks.cariKosongSub : teks.menuPelangganKosongSub}
                  </p>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {daftarItem.map((item) => {
                    const foto = urlFoto(item.foto_path)
                    const punyaAddon = (item.grup_addon ?? []).length > 0
                    const kategori = menu.kategori.find((k) => k.id === item.kategori_id)
                    return (
                      <li
                        key={item.id}
                        className={`flex items-center gap-3 rounded-md border border-line bg-surface p-3 shadow-1 transition-all duration-150 ${
                          item.habis ? 'opacity-55' : 'hover:-translate-y-px hover:shadow-2'
                        }`}
                      >
                        {foto && (
                          <img
                            src={foto}
                            alt=""
                            loading="lazy"
                            className="h-[74px] w-[74px] shrink-0 rounded-[10px] border border-line object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-[14px] font-semibold leading-tight text-ink">
                              {item.nama}
                            </h3>
                            {item.habis && (
                              <span className="rounded-full bg-amber-soft px-2 py-0.5 text-[10px] font-semibold text-amber">
                                {teks.habis}
                              </span>
                            )}
                          </div>
                          {kategori && (
                            <p className="mt-1 truncate text-[11.5px] text-muted">
                              {kategori.nama}
                            </p>
                          )}
                          <p className="mt-1.5 tabular-nums text-[14px] font-bold text-accent">
                            {formatRupiah(item.harga)}
                          </p>
                        </div>
                        {item.habis ? (
                          <span className="shrink-0 rounded-full bg-paper-2 px-3 py-2 text-[11.5px] font-semibold text-muted">
                            {teks.habis}
                          </span>
                        ) : punyaAddon ? (
                          <button
                            type="button"
                            onClick={() => bukaItem(item)}
                            className="h-9 shrink-0 rounded-full bg-accent-soft px-4 text-[12px] font-semibold text-accent transition-all duration-150 hover:bg-accent hover:text-white"
                          >
                            {teks.pilih}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => bukaItem(item)}
                            aria-label={`${teks.tambah} ${item.nama}`}
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-[20px] font-semibold leading-none text-accent transition-all duration-150 hover:bg-accent hover:text-white"
                          >
                            +
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )}
        </main>

        {tampilan === 'menu' && jumlahItem > 0 && (
          <div className="fixed bottom-3 left-1/2 z-30 w-[calc(100%-24px)] max-w-[436px] -translate-x-1/2">
            <div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-2.5 shadow-2">
              <div className="flex min-w-0 shrink-0 items-center pl-1">
                {thumbnail.map((foto, i) => (
                  <img
                    key={`${foto}-${i}`}
                    src={foto}
                    alt=""
                    className={`-ml-2 h-9 w-9 rounded-full border-2 border-surface object-cover first:ml-0`}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                ))}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-[11px] text-muted">
                  {jumlahItem} {teks.item}
                </p>
                <p className="tabular-nums text-[15px] font-bold text-ink">
                  {formatRupiah(total)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setKeranjangBuka(true)}
                className="h-11 shrink-0 rounded-md bg-accent px-5 text-[13px] font-semibold text-white shadow-1 transition-all duration-150 hover:bg-accent-2 active:translate-y-px"
              >
                {teks.keranjang}
              </button>
            </div>
          </div>
        )}
      </div>

      {itemAddon && (
        <SheetAddon
          key={itemAddon.id}
          item={itemAddon}
          grupList={grupItemAddon}
          unggulan={itemAddon.id === unggulanId}
          onTutup={() => setItemAddon(null)}
          onTambah={tambahDariSheet}
        />
      )}

      {keranjangBuka && (
        <Keranjang
          token={token}
          lines={keranjang}
          onTutup={() => setKeranjangBuka(false)}
          onHapus={(id) =>
            setKeranjang((sebelum) => sebelum.filter((line) => line.id !== id))
          }
          onBerhasil={selesaiKirim}
        />
      )}
    </div>
  )
}
