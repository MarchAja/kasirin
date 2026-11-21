import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pastikanTagihan, rakitPesanan } from "../domain/pesanan.js";
import type { Db } from "../db/client.js";
import { HttpError, requireAuth } from "../http.js";

const idParam = z.object({ id: z.coerce.number().int().positive() });

interface AntreanRow {
  id: number;
  status: "baru" | "diterima";
  dibuat_pada: string;
  meja_id: number;
  meja_nomor: number;
}
interface PesananRow {
  id: number;
  status: "baru" | "diterima" | "disajikan" | "ditutup" | "dibatalkan";
  dibuat_pada: string;
  kunjungan_id: number;
}

function totalItemPesanan(items: Array<{ harga_satuan: number; jumlah: number; addons: Array<{ harga: number }> }>): number {
  return items.reduce(
    (total, item) =>
      total +
      (item.harga_satuan + item.addons.reduce((n, a) => n + a.harga, 0)) *
        item.jumlah,
    0,
  );
}

function ambilPesanan(db: Db, id: number): PesananRow | undefined {
  return db
    .prepare("SELECT id, status, dibuat_pada, kunjungan_id FROM pesanan WHERE id = ?")
    .get(id) as PesananRow | undefined;
}

export function registerOrders(app: FastifyInstance, db: Db): void {
  app.get("/api/orders/baru", async (request) => {
    await requireAuth(request);
    const rows = db
      .prepare(
        `SELECT p.id, p.status, p.dibuat_pada, k.meja_id, m.nomor AS meja_nomor
         FROM pesanan p
         JOIN kunjungan k ON k.id = p.kunjungan_id
         JOIN meja m ON m.id = k.meja_id
         WHERE p.status IN ('baru', 'diterima') AND k.status = 'buka'
         ORDER BY p.id`,
      )
      .all() as AntreanRow[];
    const pesanan = rakitPesanan(db, rows);
    return {
      pesanan: pesanan.map((p, i) => ({
        ...p,
        meja_id: rows[i]!.meja_id,
        meja_nomor: rows[i]!.meja_nomor,
        total: totalItemPesanan(p.items),
      })),
    };
  });

  app.post("/api/orders/:id/accept", async (request) => {
    const sesi = await requireAuth(request);
    const { id } = idParam.parse(request.params);
    const pesanan = ambilPesanan(db, id);
    if (!pesanan) throw new HttpError(404, "Pesanan tidak ditemukan.");
    if (pesanan.status === "dibatalkan" || pesanan.status === "ditutup") {
      throw new HttpError(409, "Pesanan sudah tidak aktif.");
    }

    if (pesanan.status === "baru") {
      db.transaction(() => {
        db.prepare(
          "UPDATE pesanan SET status = 'diterima', diterima_oleh = ? WHERE id = ?",
        ).run(sesi.sub, id);
        db.prepare(
          "UPDATE pesanan_item SET status = 'diterima' WHERE pesanan_id = ? AND status = 'baru'",
        ).run(id);
        // Tagihan dibuka saat staf menerima pesanan pertama (SPEC §5.1).
        pastikanTagihan(db, pesanan.kunjungan_id);
      })();
    }

    return { pesanan: rakitPesanan(db, [ambilPesanan(db, id)!])[0] };
  });

  app.post("/api/orders/:id/serve", async (request) => {
    await requireAuth(request);
    const { id } = idParam.parse(request.params);
    const pesanan = ambilPesanan(db, id);
    if (!pesanan) throw new HttpError(404, "Pesanan tidak ditemukan.");
    if (pesanan.status !== "diterima") {
      throw new HttpError(409, "Hanya pesanan diterima yang bisa disajikan.");
    }

    db.transaction(() => {
      db.prepare("UPDATE pesanan SET status = 'disajikan' WHERE id = ?").run(id);
      db.prepare(
        "UPDATE pesanan_item SET status = 'disajikan' WHERE pesanan_id = ? AND status = 'diterima'",
      ).run(id);
    })();

    return { pesanan: rakitPesanan(db, [ambilPesanan(db, id)!])[0] };
  });
}
