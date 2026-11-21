import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../db/client.js";
import { HttpError, requireOwner } from "../http.js";

interface KategoriRow { id: number; nama: string; urutan: number }
interface MenuRow {
  id: number;
  kategori_id: number;
  nama: string;
  harga: number;
  foto_path: string | null;
  habis: number;
  aktif: number;
}
interface AddonRow {
  id: number;
  grup_id: number;
  nama: string;
  harga: number;
  habis: number;
  aktif: number;
  urutan: number;
}
interface GrupRow {
  id: number;
  nama: string;
  min_pilih: number;
  max_pilih: number;
  wajib: number;
  urutan: number;
}
interface RelRow { menu_item_id: number; grup_id: number; urutan: number }

const idParam = z.object({ id: z.coerce.number().int().positive() });
const patchSchema = z
  .object({
    habis: z.boolean().optional(),
    aktif: z.boolean().optional(),
  })
  .refine((value) => value.habis !== undefined || value.aktif !== undefined, {
    message: "Minimal satu field harus diisi.",
  });

function ambilMenu(db: Db, id: number): MenuRow | undefined {
  return db
    .prepare(
      `SELECT id, kategori_id, nama, harga, foto_path, habis, aktif
       FROM menu_item WHERE id = ?`,
    )
    .get(id) as MenuRow | undefined;
}

function tampilMenu(row: MenuRow, grupIds: number[]) {
  return {
    id: row.id,
    kategori_id: row.kategori_id,
    nama: row.nama,
    harga: row.harga,
    foto_path: row.foto_path,
    habis: Boolean(row.habis),
    aktif: Boolean(row.aktif),
    grup_addon: grupIds,
  };
}

export function registerMenu(app: FastifyInstance, db: Db): void {
  app.get("/api/menu", async () => {
    const kategori = db
      .prepare("SELECT id, nama, urutan FROM kategori ORDER BY urutan, id")
      .all() as KategoriRow[];
    const menuRows = db
      .prepare(
        `SELECT id, kategori_id, nama, harga, foto_path, habis, aktif
         FROM menu_item ORDER BY urutan, id`,
      )
      .all() as MenuRow[];
    const addonRows = db
      .prepare(
        `SELECT id, grup_id, nama, harga, habis, aktif, urutan
         FROM addon ORDER BY urutan, id`,
      )
      .all() as AddonRow[];
    const grupRows = db
      .prepare(
        `SELECT id, nama, min_pilih, max_pilih, wajib, urutan
         FROM addon_grup ORDER BY urutan, id`,
      )
      .all() as GrupRow[];
    const relasi = db
      .prepare("SELECT menu_item_id, grup_id, urutan FROM menu_addon ORDER BY urutan")
      .all() as RelRow[];

    return {
      kategori,
      items: menuRows.map((row) =>
        tampilMenu(
          row,
          relasi.filter((r) => r.menu_item_id === row.id).map((r) => r.grup_id),
        ),
      ),
      grup_addon: grupRows.map((grup) => ({
        id: grup.id,
        nama: grup.nama,
        min_pilih: grup.min_pilih,
        max_pilih: grup.max_pilih,
        wajib: Boolean(grup.wajib),
        urutan: grup.urutan,
        addons: addonRows
          .filter((a) => a.grup_id === grup.id)
          .map((a) => ({
            id: a.id,
            grup_id: a.grup_id,
            nama: a.nama,
            harga: a.harga,
            habis: Boolean(a.habis),
            aktif: Boolean(a.aktif),
            urutan: a.urutan,
          })),
      })),
    };
  });

  app.patch("/api/menu/:id", async (request) => {
    await requireOwner(request);
    const { id } = idParam.parse(request.params);
    const input = patchSchema.parse(request.body);
    const existing = ambilMenu(db, id);
    if (!existing) throw new HttpError(404, "Menu tidak ditemukan.");

    const kolom: string[] = [];
    const nilai: Array<number> = [];
    if (input.habis !== undefined) {
      kolom.push("habis = ?");
      nilai.push(input.habis ? 1 : 0);
    }
    if (input.aktif !== undefined) {
      kolom.push("aktif = ?");
      nilai.push(input.aktif ? 1 : 0);
    }
    db.prepare(`UPDATE menu_item SET ${kolom.join(", ")} WHERE id = ?`).run(
      ...nilai,
      id,
    );

    const grupIds = (
      db
        .prepare("SELECT grup_id FROM menu_addon WHERE menu_item_id = ?")
        .all(id) as Array<{ grup_id: number }>
    ).map((r) => r.grup_id);
    return { item: tampilMenu(ambilMenu(db, id)!, grupIds) };
  });

  app.get("/api/outlet", async () => {
    const outlet = db
      .prepare(
        `SELECT id, nama, alamat, pajak_persen, service_persen, mode_bayar
         FROM outlet WHERE id = 1`,
      )
      .get() as Record<string, unknown> | undefined;
    if (!outlet) throw new HttpError(404, "Outlet belum diatur.");
    return outlet;
  });
}
