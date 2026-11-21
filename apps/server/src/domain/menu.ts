import type { Db } from "../db/client.js";

export interface KategoriData { id: number; nama: string; urutan: number }
export interface MenuDataItem {
  id: number;
  kategori_id: number;
  nama: string;
  harga: number;
  foto_path: string | null;
  habis: boolean;
  aktif: boolean;
  grup_addon: number[];
}
export interface AddonData {
  id: number;
  grup_id: number;
  nama: string;
  harga: number;
  habis: boolean;
  aktif: boolean;
  urutan: number;
}
export interface GrupAddonData {
  id: number;
  nama: string;
  min_pilih: number;
  max_pilih: number;
  wajib: boolean;
  urutan: number;
  addons: AddonData[];
}
export interface MenuData {
  kategori: KategoriData[];
  items: MenuDataItem[];
  grup_addon: GrupAddonData[];
}

/** Satu sumber data menu, dipakai panel kasir/pemilik dan halaman pelanggan. */
export function dataMenu(db: Db): MenuData {
  const kategori = db
    .prepare("SELECT id, nama, urutan FROM kategori ORDER BY urutan, id")
    .all() as KategoriData[];
  const menuRows = db
    .prepare(
      `SELECT id, kategori_id, nama, harga, foto_path, habis, aktif
       FROM menu_item ORDER BY urutan, id`,
    )
    .all() as Array<Omit<MenuDataItem, "grup_addon">>;
  const addonRows = db
    .prepare(
      `SELECT id, grup_id, nama, harga, habis, aktif, urutan
       FROM addon ORDER BY urutan, id`,
    )
    .all() as AddonData[];
  const grupRows = db
    .prepare(
      `SELECT id, nama, min_pilih, max_pilih, wajib, urutan
       FROM addon_grup ORDER BY urutan, id`,
    )
    .all() as Omit<GrupAddonData, "addons">[];
  const relasi = db
    .prepare("SELECT menu_item_id, grup_id, urutan FROM menu_addon ORDER BY urutan")
    .all() as Array<{ menu_item_id: number; grup_id: number; urutan: number }>;

  return {
    kategori,
    items: menuRows.map((row) => ({
      ...row,
      habis: Boolean(row.habis),
      aktif: Boolean(row.aktif),
      grup_addon: relasi
        .filter((r) => r.menu_item_id === row.id)
        .map((r) => r.grup_id),
    })),
    grup_addon: grupRows.map((grup) => ({
      ...grup,
      wajib: Boolean(grup.wajib),
      addons: addonRows
        .filter((a) => a.grup_id === grup.id)
        .map((a) => ({
          ...a,
          habis: Boolean(a.habis),
          aktif: Boolean(a.aktif),
        })),
    })),
  };
}
