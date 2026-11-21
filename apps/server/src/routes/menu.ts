import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { dataMenu, type MenuDataItem } from "../domain/menu.js";
import { sinkronisasiTagihan } from "../domain/pesanan.js";
import type { Db } from "../db/client.js";
import { HttpError, requireOwner } from "../http.js";

const idParam = z.object({ id: z.coerce.number().int().positive() });
const patchSchema = z
  .object({
    habis: z.boolean().optional(),
    aktif: z.boolean().optional(),
  })
  .refine((value) => value.habis !== undefined || value.aktif !== undefined, {
    message: "Minimal satu field harus diisi.",
  });

const patchOutletSchema = z.object({
  pajak_persen: z.number().min(0).max(100).optional(),
  service_persen: z.number().min(0).max(100).optional(),
  mode_bayar: z.enum(["manual", "otomatis", "keduanya"]).optional(),
});

function ambilMenu(db: Db, id: number): MenuDataItem | undefined {
  return dataMenu(db).items.find((item) => item.id === id);
}

export function registerMenu(app: FastifyInstance, db: Db): void {
  app.get("/api/menu", async () => dataMenu(db));

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

    return { item: ambilMenu(db, id)! };
  });

  app.get("/api/outlet", async () => dataOutlet(db));

  app.patch("/api/outlet", async (request) => {
    await requireOwner(request);
    const input = patchOutletSchema.parse(request.body);
    const kolom: string[] = [];
    const nilai: Array<number | string> = [];
    if (input.pajak_persen !== undefined) {
      kolom.push("pajak_persen = ?");
      nilai.push(input.pajak_persen);
    }
    if (input.service_persen !== undefined) {
      kolom.push("service_persen = ?");
      nilai.push(input.service_persen);
    }
    if (input.mode_bayar !== undefined) {
      kolom.push("mode_bayar = ?");
      nilai.push(input.mode_bayar);
    }
    if (kolom.length === 0) throw new HttpError(400, "Tidak ada perubahan.");

    db.transaction(() => {
      db.prepare(`UPDATE outlet SET ${kolom.join(", ")} WHERE id = 1`).run(...nilai);
      const terbuka = db
        .prepare(
          `SELECT t.kunjungan_id FROM tagihan t
           JOIN kunjungan k ON k.id = t.kunjungan_id
           WHERE t.status = 'buka' AND k.status = 'buka'`,
        )
        .all() as Array<{ kunjungan_id: number }>;
      for (const row of terbuka) sinkronisasiTagihan(db, row.kunjungan_id);
    })();

    return dataOutlet(db);
  });
}

function dataOutlet(db: Db) {
  const outlet = db
    .prepare(
      `SELECT nama, alamat, pajak_persen, service_persen, mode_bayar
       FROM outlet WHERE id = 1`,
    )
    .get() as
    | {
        nama: string;
        alamat: string | null;
        pajak_persen: number;
        service_persen: number;
        mode_bayar: string;
      }
    | undefined;
  if (!outlet) throw new HttpError(404, "Outlet belum diatur.");
  return outlet;
}
