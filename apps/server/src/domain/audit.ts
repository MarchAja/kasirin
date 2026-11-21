import type { Db } from "../db/client.js";

export function catatAudit(
  db: Db,
  penggunaId: number | null,
  aksi: string,
  entitas: string,
  entitasId: number | null,
  detail: string | null = null,
): void {
  db.prepare(
    `INSERT INTO audit_log (pengguna_id, aksi, entitas, entitas_id, detail)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(penggunaId, aksi, entitas, entitasId, detail);
}
