import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { catatAudit } from "../domain/audit.js";
import { detailTagihan } from "../domain/tagihan.js";
import type { Db } from "../db/client.js";
import { HttpError, requireAuth } from "../http.js";

const idParam = z.object({ id: z.coerce.number().int().positive() });

interface KunjunganRow {
  id: number;
  meja_id: number;
  status: string;
}
interface TagihanRow { id: number; status: string }

export function registerKunjungan(app: FastifyInstance, db: Db): void {
  app.post("/api/kunjungan/:id/tutup", async (request) => {
    const sesi = await requireAuth(request);
    const { id } = idParam.parse(request.params);
    const kunjungan = db
      .prepare("SELECT id, meja_id, status FROM kunjungan WHERE id = ?")
      .get(id) as KunjunganRow | undefined;
    if (!kunjungan) throw new HttpError(404, "Kunjungan tidak ditemukan.");
    if (kunjungan.status !== "buka") {
      throw new HttpError(409, "Kunjungan sudah ditutup.");
    }

    const tagihan = db
      .prepare("SELECT id, status FROM tagihan WHERE kunjungan_id = ?")
      .get(id) as TagihanRow | undefined;
    if (!tagihan) throw new HttpError(409, "Belum ada tagihan untuk kunjungan ini.");
    if (tagihan.status !== "lunas") {
      throw new HttpError(409, "Tagihan belum lunas. Meja belum bisa ditutup.");
    }

    const waktu = new Date().toISOString().replace("T", " ").slice(0, 19);
    db.transaction(() => {
      db.prepare("UPDATE tagihan SET status = 'ditutup' WHERE id = ?").run(tagihan.id);
      db.prepare(
        "UPDATE kunjungan SET status = 'ditutup', ditutup_pada = ? WHERE id = ?",
      ).run(waktu, id);
      catatAudit(db, sesi.sub, "tutup_meja", "kunjungan", id, null);
    })();

    const meja = db
      .prepare("SELECT id, nomor, token, aktif FROM meja WHERE id = ?")
      .get(kunjungan.meja_id) as {
      id: number;
      nomor: number;
      token: string;
      aktif: number;
    };

    return {
      meja: {
        id: meja.id,
        nomor: meja.nomor,
        token: meja.token,
        aktif: Boolean(meja.aktif),
        status: "kosong",
        total: 0,
        kunjungan_id: null,
      },
      tagihan: detailTagihan(db, tagihan.id),
    };
  });
}
