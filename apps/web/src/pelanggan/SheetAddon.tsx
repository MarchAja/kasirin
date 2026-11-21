import { useEffect, useMemo, useRef, useState } from 'react'
import { formatRupiah, urlFoto } from '../format'
import { teks } from '../teks'
import type { AddonSnapshot, GrupAddon, MenuItem } from '../types'

/** Hasil pilihan addon yang dikirim ke keranjang. */
export interface HasilPilih {
  item: MenuItem
  addons: AddonSnapshot[]
  catatan: string
  jumlah: number
}

interface Props {
  item: MenuItem
  grupList: GrupAddon[]
  unggulan?: boolean
  onTutup: () => void
  onTambah: (hasil: HasilPilih) => void
}

function labelGrup(grup: GrupAddon): string {
  const akhiran =
    grup.max_pilih === 1
      ? teks.grupPilihSatu
      : grup.wajib
        ? teks.grupWajib
        : teks.grupOpsional
  return `${grup.nama} ${akhiran}`
}

export function SheetAddon({ item, grupList, unggulan = false, onTutup, onTambah }: Props) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const [pilihan, setPilihan] = useState<Record<number, number[]>>(() =>
    Object.fromEntries(grupList.map((grup) => [grup.id, []])),
  )
  const [catatan, setCatatan] = useState('')
  const [jumlah, setJumlah] = useState(1)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  const valid = grupList.every(
    (grup) => (pilihan[grup.id] ?? []).length >= grup.min_pilih,
  )

  const addons = useMemo<AddonSnapshot[]>(() => {
    const hasil: AddonSnapshot[] = []
    for (const grup of grupList) {
      for (const id of pilihan[grup.id] ?? []) {
        const addon = grup.addons.find((a) => a.id === id)
        if (addon) {
          hasil.push({
            addon_id: addon.id,
            nama: addon.nama,
            harga: addon.harga,
            grup: grup.nama,
          })
        }
      }
    }
    return hasil
  }, [grupList, pilihan])

  const hargaSatuan = item.harga + addons.reduce((n, a) => n + a.harga, 0)
  const hargaTotal = hargaSatuan * jumlah
  const foto = urlFoto(item.foto_path)

  function pilihTunggal(grup: GrupAddon, addonId: number | null) {
    setPilihan((sebelum) => ({
      ...sebelum,
      [grup.id]: addonId === null ? [] : [addonId],
    }))
  }

  function pilihGanda(grup: GrupAddon, addonId: number) {
    setPilihan((sebelum) => {
      const ada = sebelum[grup.id] ?? []
      if (ada.includes(addonId)) {
        return { ...sebelum, [grup.id]: ada.filter((id) => id !== addonId) }
      }
      if (ada.length >= grup.max_pilih) return sebelum
      return { ...sebelum, [grup.id]: [...ada, addonId] }
    })
  }

  function tambah() {
    if (!valid) return
    onTambah({ item, addons, catatan: catatan.trim(), jumlah })
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="addon-judul"
      onClick={(e) => {
        if (e.target === dialogRef.current) onTutup()
      }}
      onCancel={(e) => {
        e.preventDefault()
        onTutup()
      }}
      className="pelanggan-dialog fixed inset-x-0 bottom-0 my-0 mx-auto max-h-[92vh] w-full max-w-[460px] rounded-t-lg border-0 bg-surface p-0 text-ink shadow-2"
    >
      <div className="sheet-scroll flex max-h-[92vh] flex-col overflow-hidden rounded-t-lg">
        <div className="flex items-start gap-3.5 border-b border-line px-5 pb-4 pt-5">
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
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id="addon-judul" className="text-[16px] font-bold leading-tight text-ink">
              {item.nama}
            </h2>
            {unggulan && (
              <span className="mt-1 inline-flex rounded-full bg-amber-soft px-2.5 py-0.5 text-[10.5px] font-semibold text-amber">
                {teks.palingLaris}
              </span>
            )}
          </div>
          <span className="shrink-0 pt-1 tabular-nums text-[15px] font-bold text-accent">
            {formatRupiah(item.harga)}
          </span>
          <button
            type="button"
            onClick={onTutup}
            aria-label={teks.tutup}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-paper-2 text-[17px] leading-none text-muted transition-colors duration-150 hover:bg-accent-soft hover:text-accent"
          >
            ×
          </button>
        </div>

        <div className="sheet-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {grupList.map((grup) => {
            const dipilih = pilihan[grup.id] ?? []
            const radio = grup.max_pilih === 1
            return (
              <section key={grup.id}>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted">
                    {labelGrup(grup)}
                  </h3>
                  {grup.wajib && (
                    <span className="rounded-full bg-amber-soft px-2 py-0.5 text-[10px] font-semibold text-amber">
                      {teks.wajib}
                    </span>
                  )}
                </div>
                <div className="space-y-2" role={radio ? 'radiogroup' : 'group'}>
                  {!grup.wajib && (
                    <OptionRow
                      name={`grup-${grup.id}`}
                      radio={radio}
                      selected={dipilih.length === 0}
                      label={teks.tanpaTambahan}
                      harga={0}
                      onSelect={() => pilihTunggal(grup, null)}
                    />
                  )}
                  {grup.addons.map((addon) => {
                    const aktif = !addon.habis && addon.aktif
                    const terpilih = dipilih.includes(addon.id)
                    return (
                      <OptionRow
                        key={addon.id}
                        name={`grup-${grup.id}`}
                        radio={radio}
                        selected={terpilih}
                        disabled={!aktif}
                        label={addon.nama}
                        harga={addon.harga}
                        habis={addon.habis}
                        onSelect={() =>
                          radio
                            ? pilihTunggal(grup, addon.id)
                            : pilihGanda(grup, addon.id)
                        }
                      />
                    )
                  })}
                </div>
              </section>
            )
          })}

          <div className="border-t border-line pt-4">
            <label htmlFor="catatan-pelanggan" className="sr-only">
              {teks.catatanPlaceholder}
            </label>
            <textarea
              id="catatan-pelanggan"
              value={catatan}
              maxLength={200}
              rows={2}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder={teks.catatanPlaceholder}
              className="w-full resize-none rounded-md border border-line bg-paper px-3.5 py-3 text-[13px] leading-relaxed text-ink outline-none transition-colors duration-150 placeholder:text-idle focus:border-accent focus:bg-surface"
            />
          </div>

          <div className="flex items-center justify-between border-t border-line pt-4">
            <span className="text-[13px] font-semibold text-ink">{teks.jumlah}</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label={teks.kurangiJumlah}
                disabled={jumlah <= 1}
                onClick={() => setJumlah((n) => Math.max(1, n - 1))}
                className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-[18px] leading-none text-ink transition-colors duration-150 hover:border-accent hover:text-accent disabled:opacity-40"
              >
                −
              </button>
              <span className="w-6 text-center text-[15px] font-bold tabular-nums text-ink">
                {jumlah}
              </span>
              <button
                type="button"
                aria-label={teks.tambahJumlah}
                disabled={jumlah >= 20}
                onClick={() => setJumlah((n) => Math.min(20, n + 1))}
                className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-[18px] leading-none text-ink transition-colors duration-150 hover:border-accent hover:text-accent disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-line bg-surface px-5 pb-5 pt-3.5">
          <button
            type="button"
            disabled={!valid}
            onClick={tambah}
            className="inline-flex h-12 w-full items-center justify-center rounded-md bg-accent px-4 text-[14px] font-semibold text-white shadow-2 transition-all duration-150 hover:bg-accent-2 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
          >
            {teks.tambah} · {formatRupiah(hargaTotal)}
          </button>
        </div>
      </div>
    </dialog>
  )
}

function OptionRow({
  name,
  radio,
  selected,
  disabled = false,
  label,
  harga,
  habis = false,
  onSelect,
}: {
  name: string
  radio: boolean
  selected: boolean
  disabled?: boolean
  label: string
  harga: number
  habis?: boolean
  onSelect: () => void
}) {
  return (
    <label
      className={`flex min-h-11 items-center gap-3 rounded-md border px-3.5 py-2.5 transition-all duration-150 ${
        selected ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
      } ${disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer hover:border-accent'}`}
    >
      <input
        type={radio ? 'radio' : 'checkbox'}
        name={name}
        checked={selected}
        disabled={disabled}
        onChange={onSelect}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={`grid h-[18px] w-[18px] shrink-0 place-items-center ${
          radio ? 'rounded-full' : 'rounded-[5px]'
        } border ${selected ? 'border-accent bg-accent' : 'border-idle bg-surface'}`}
      >
        {selected && (
          <span
            className={
              radio
                ? 'h-1.5 w-1.5 rounded-full bg-white'
                : 'text-[11px] font-bold leading-none text-white'
            }
          >
            {radio ? '' : '✓'}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
        {label}
      </span>
      {habis && (
        <span className="shrink-0 rounded-full bg-amber-soft px-2 py-0.5 text-[10px] font-semibold text-amber">
          {teks.habis}
        </span>
      )}
      <span className="shrink-0 tabular-nums text-[12.5px] font-semibold text-muted">
        +{formatRupiah(harga)}
      </span>
    </label>
  )
}
