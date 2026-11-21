import type { FastifyInstance } from "fastify";
import { hitungSubtotal } from "../domain/pesanan.js";
import type { StatusMeja } from "../domain/types.js";
import type { Db } from "../db/client.js";

interface MejaRow {
  id: number;
  nomor: number;
  token: string;
  aktif: number;
}

function statusMeja(db: Db, kunjunganId: number): StatusMeja {
  const statuses = db
    .prepare("SELECT status FROM pesanan WHERE kunjungan_id = ?")
    .all(kunjunganId) as Array<{ status: string }>;
  if (statuses.some((row) => row.status === "baru")) return "baru";
  if (statuses.some((row) => row.status === "diterima")) return "diterima";
  if (statuses.some((row) => row.status === "disajikan")) return "disajikan";
  return "kosong";
}

export function registerTables(app: FastifyInstance, db: Db): void {
  app.get("/api/tables", async () => {
    const rows = db
      .prepare("SELECT id, nomor, token, aktif FROM meja ORDER BY nomor")
      .all() as MejaRow[];

    return {
      meja: rows.map((row) => {
        const kunjungan = db
          .prepare(
            `SELECT id FROM kunjungan
             WHERE meja_id = ? AND status = 'buka' ORDER BY id DESC LIMIT 1`,
          )
          .get(row.id) as { id: number } | undefined;

        return {
          id: row.id,
          nomor: row.nomor,
          token: row.token,
          aktif: Boolean(row.aktif),
          status: kunjungan ? statusMeja(db, kunjungan.id) : ("kosong" as StatusMeja),
          total: kunjungan ? hitungSubtotal(db, kunjungan.id) : 0,
          kunjungan_id: kunjungan?.id ?? null,
        };
      }),
    };
  });
}
