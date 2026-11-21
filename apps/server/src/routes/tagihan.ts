import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { verifySecret } from "../auth.js";
import { catatAudit } from "../domain/audit.js";
import { sinkronisasiTagihan } from "../domain/pesanan.js";
import { detailTagihan, tagihanMeja } from "../domain/tagihan.js";
import type { Db } from "../db/client.js";
import { HttpError, requireAuth } from "../http.js";

const idParam = z.object({ id: z.coerce.number().int().positive() });
const mejaParam = z.object({ mejaId: z.coerce.number().int().positive() });

const bayarSchema = z.object({
  metode: z.enum(["tunai", "qris_manual"]),
  nominal: z.number().int().nonnegative().optional(),
  perlu_dicek: z.boolean().optional(),
});

const diskonSchema = z
  .object({
    diskon: z.number().int().nonnegative().optional(),
    persen: z.number().min(0).max(100).optional(),
    alasan: z.string().trim().min(3).max(200),
    pin: z.string().regex(/^\d{4,8}$/),
  })
  .refine((value) => value.diskon !== undefined || value.persen !== undefined, {
    message: "Isi nominal atau persentase diskon.",
  });

interface TagihanRow {
  id: number;
  kunjungan_id: number;
  subtotal: number;
  diskon: number;
  total: number;
  status: string;
}

function ambilTagihan(db: Db, id: number): TagihanRow | undefined {
  return db
    .prepare(
      "SELECT id, kunjungan_id, subtotal, diskon, total, status FROM tagihan WHERE id = ?",
    )
    .get(id) as TagihanRow | undefined;
}

export function registerTagihan(app: FastifyInstance, db: Db): void {
  app.get("/api/tagihan/meja/:mejaId", async (request) => {
    await requireAuth(request);
    const { mejaId } = mejaParam.parse(request.params);
    return { tagihan: tagihanMeja(db, mejaId) };
  });

  app.post("/api/tagihan/:id/bayar", async (request, reply) => {
    const sesi = await requireAuth(request);
    const { id } = idParam.parse(request.params);
    const input = bayarSchema.parse(request.body);
    const tagihan = ambilTagihan(db, id);
    if (!tagihan) throw new HttpError(404, "Tagihan tidak ditemukan.");
    if (tagihan.status !== "buka" && tagihan.status !== "tertunda") {
      throw new HttpError(409, "Tagihan ini sudah dibayar atau ditutup.");
    }

    const nominal = input.nominal ?? tagihan.total;
    if (nominal < tagihan.total) {
      throw new HttpError(400, "Nominal kurang dari total tagihan.");
    }

    const perluDicek = input.perlu_dicek === true;
    const statusPembayaran = perluDicek ? "tertunda" : "lunas";
    const statusTagihan = perluDicek ? "perlu_dicek" : "lunas";
    const waktu = new Date().toISOString().replace("T", " ").slice(0, 19);

    db.transaction(() => {
      db.prepare(
        `INSERT INTO pembayaran
           (tagihan_id, metode, nominal, status, dibuat_pada, final_pada)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        input.metode,
        nominal,
        statusPembayaran,
        waktu,
        perluDicek ? null : waktu,
      );
      db.prepare("UPDATE tagihan SET status = ? WHERE id = ?").run(
        statusTagihan,
        id,
      );
      catatAudit(
        db,
        sesi.sub,
        "bayar",
        "tagihan",
        id,
        `${input.metode} · ${nominal}${perluDicek ? " · perlu dicek" : ""}`,
      );
    })();

    return reply.code(201).send({ tagihan: detailTagihan(db, id) });
  });

  app.post("/api/tagihan/:id/diskon", async (request) => {
    const sesi = await requireAuth(request);
    const { id } = idParam.parse(request.params);
    const input = diskonSchema.parse(request.body);
    const tagihan = ambilTagihan(db, id);
    if (!tagihan) throw new HttpError(404, "Tagihan tidak ditemukan.");
    if (tagihan.status !== "buka") {
      throw new HttpError(409, "Diskon hanya bisa diberikan sebelum pembayaran.");
    }

    const owner = db
      .prepare("SELECT pin_hash FROM pengguna WHERE peran = 'owner' AND aktif = 1 LIMIT 1")
      .get() as { pin_hash: string | null } | undefined;
    if (!owner || !verifySecret(input.pin, owner.pin_hash)) {
      throw new HttpError(403, "PIN pemilik salah.");
    }

    const nominalDiskon =
      input.diskon !== undefined
        ? input.diskon
        : Math.round((tagihan.subtotal * (input.persen ?? 0)) / 100);
    if (nominalDiskon <= 0) throw new HttpError(400, "Nominal diskon harus lebih dari 0.");
    if (nominalDiskon > tagihan.subtotal) {
      throw new HttpError(400, "Diskon tidak boleh melebihi subtotal.");
    }

    db.transaction(() => {
      db.prepare(
        "UPDATE tagihan SET diskon = ?, alasan_diskon = ? WHERE id = ?",
      ).run(nominalDiskon, input.alasan, id);
      sinkronisasiTagihan(db, tagihan.kunjungan_id);
      catatAudit(
        db,
        sesi.sub,
        "diskon",
        "tagihan",
        id,
        `${nominalDiskon} · ${input.alasan}`,
      );
    })();

    return { tagihan: detailTagihan(db, id) };
  });

  app.post("/api/tagihan/:id/konfirmasi", async (request) => {
    const sesi = await requireAuth(request);
    const { id } = idParam.parse(request.params);
    const tagihan = ambilTagihan(db, id);
    if (!tagihan) throw new HttpError(404, "Tagihan tidak ditemukan.");
    if (tagihan.status !== "perlu_dicek") {
      throw new HttpError(409, "Tagihan ini tidak menunggu pengecekan.");
    }

    const waktu = new Date().toISOString().replace("T", " ").slice(0, 19);
    db.transaction(() => {
      db.prepare(
        `UPDATE pembayaran SET status = 'lunas', final_pada = ?
         WHERE tagihan_id = ? AND status = 'tertunda'`,
      ).run(waktu, id);
      db.prepare("UPDATE tagihan SET status = 'lunas' WHERE id = ?").run(id);
      catatAudit(db, sesi.sub, "konfirmasi_bayar", "tagihan", id, null);
    })();

    return { tagihan: detailTagihan(db, id) };
  });
}
