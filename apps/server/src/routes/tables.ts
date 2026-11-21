import type { FastifyInstance } from "fastify";
import type { Db } from "../db/client.js";

interface MejaRow {
  id: number;
  nomor: number;
  token: string;
  aktif: number;
}

export function registerTables(app: FastifyInstance, db: Db): void {
  app.get("/api/tables", async () => {
    const rows = db
      .prepare("SELECT id, nomor, token, aktif FROM meja ORDER BY nomor")
      .all() as MejaRow[];
    return {
      meja: rows.map((row) => ({
        id: row.id,
        nomor: row.nomor,
        token: row.token,
        aktif: Boolean(row.aktif),
      })),
    };
  });
}
