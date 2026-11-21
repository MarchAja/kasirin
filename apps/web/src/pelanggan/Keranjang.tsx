import { useEffect, useRef, useState } from 'react'
import { ApiError, kirimPesanan } from '../api'
import { formatRupiah, urlFoto } from '../format'
import { teks } from '../teks'
import type { AddonSnapshot, KirimItem, MenuItem } from '../types'

/** Satu baris keranjang = satu kombinasi item + addon + catatan. */
export interface CartLine {
  id: number
  item: MenuItem
  addons: AddonSnapshot[]
  catatan: string
  jumlah: number
}

/** Harga satu unit = harga dasar + semua addon yang dipilih. */
export function hargaSatuan(line: CartLine): number {
  return line.item.harga + line.addons.reduce((jumlah, a) => jumlah + a.harga, 0)
}

export function totalKeranjang(lines: CartLine[]): number {
  return lines.reduce((jumlah, line) => jumlah + hargaSatuan(line) * line.jumlah, 0)
}

/** Pesan kesalahan ramah untuk layar pelanggan. */
export function pesanErrorPelanggan(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return teks.serverMati
    if (err.status === 404) return teks.qrTidakValid
  }
  return fallback
}

interface Props {
  token: string
  lines: CartLine[]
  onTutup: () => void
  onHapus: (id: number) => void
  onBerhasil: () => void
}

export function Keranjang({ token, lines, onTutup, onHapus, onBerhasil }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [mengirim, setMengirim] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  const total = totalKeranjang(lines)
  const jumlahItem = lines.reduce((n, l) => n + l.jumlah, 0)

  async function kirim() {
    if (mengirim || lines.length === 0) return
    setMengirim(true)
    setError(null)
    const items: KirimItem[] = lines.map((line) => {
      const catatan = line.catatan.trim()
      return {
        menu_item_id: line.item.id,
        jumlah: line.jumlah,
        ...(catatan ? { catatan } : {}),
        pilihan_addon: line.addons.map((a) => a.addon_id),
      }
    })
    try {
      await kirimPesanan(token, { items })
      onBerhasil()
    } catch (err: unknown) {
      setError(pesanErrorPelanggan(err, teks.gagalKirim))
    } finally {
      setMengirim(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="keranjang-judul"
      onClick={(e) => {
        if (e.target === dialogRef.current) onTutup()
      }}
      onCancel={(e) => {
        e.preventDefault()
        onTutup()
      }}
      className="pelanggan-dialog fixed inset-x-0 bottom-0 my-0 mx-auto max-h-[88vh] w-full max-w-[460px] rounded-t-lg border-0 bg-surface p-0 text-ink shadow-2"
    >
      <div className="sheet-scroll flex max-h-[88vh] flex-col overflow-hidden rounded-t-lg">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 id="keranjang-judul" className="text-[17px] font-bold leading-tight">
              {teks.keranjang}
            </h2>
            <p className="mt-0.5 text-[11.5px] text-muted">
              {jumlahItem} {teks.item}
            </p>
          </div>
          <button
            type="button"
            onClick={onTutup}
            aria-label={teks.tutup}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-paper-2 text-[18px] leading-none text-muted transition-colors duration-150 hover:bg-accent-soft hover:text-accent"
          >
            ×
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mx-5 mt-3 rounded-md border border-red/30 bg-red-soft px-3.5 py-2.5 text-[12.5px] text-red"
          >
            {error}
          </div>
        )}

        <div className="sheet-scroll min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {lines.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-[14px] font-semibold">{teks.keranjangKosong}</p>
              <p className="mt-1 text-[12px] text-muted">{teks.keranjangKosongSub}</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {lines.map((line) => {
                const foto = urlFoto(line.item.foto_path)
                return (
                  <li key={line.id} className="flex gap-3 py-3.5">
                    {foto && (
                      <img
                        src={foto}
                        alt=""
                        loading="lazy"
                        className="h-16 w-16 shrink-0 rounded-[10px] border border-line object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[14px] font-semibold leading-tight text-ink">
                          {line.item.nama}
                        </span>
                        <span className="shrink-0 tabular-nums text-[13.5px] font-bold text-accent">
                          {formatRupiah(hargaSatuan(line) * line.jumlah)}
                        </span>
                      </div>
                      {line.addons.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {line.addons.map((a) => (
                            <div
                              key={a.addon_id}
                              className="text-[11.5px] leading-tight text-muted"
                            >
                              ↳ {a.nama}
                              {a.harga > 0 ? ` · ${formatRupiah(a.harga)}` : ''}
                            </div>
                          ))}
                        </div>
                      )}
                      {line.catatan && (
                        <p className="mt-1 text-[11.5px] italic leading-tight text-muted">
                          “{line.catatan}”
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-3">
                        <span className="rounded-full bg-paper-2 px-2.5 py-0.5 text-[11.5px] font-semibold tabular-nums text-muted">
                          {line.jumlah}×
                        </span>
                        <button
                          type="button"
                          onClick={() => onHapus(line.id)}
                          className="text-[11.5px] font-semibold text-red transition-opacity duration-150 hover:opacity-70"
                        >
                          {teks.hapus}
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-line bg-surface px-5 pb-5 pt-3.5">
          <div className="mb-3 flex items-end justify-between">
            <span className="text-[12px] font-semibold text-muted">{teks.totalTagihan}</span>
            <span className="tabular-nums text-[20px] font-bold leading-none text-ink">
              {formatRupiah(total)}
            </span>
          </div>
          <button
            type="button"
            disabled={mengirim || lines.length === 0}
            onClick={() => void kirim()}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-accent text-[14px] font-semibold text-white shadow-2 transition-all duration-150 hover:bg-accent-2 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mengirim && <span className="spinner inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent" />}
            {mengirim ? teks.mengirim : teks.kirimPesanan}
          </button>
        </div>
      </div>
    </dialog>
  )
}
