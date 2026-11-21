import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { dataMenu, type MenuDataItem } from "../domain/menu.js";
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
