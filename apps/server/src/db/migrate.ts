import { config } from "../config.js";
import { hashSecret } from "../auth.js";
import type { Db } from "./client.js";
import { MIGRATION_ID, SCHEMA_SQL } from "./schema.js";

const MIGRASI: Array<{ id: string; sql: string }> = [
  { id: MIGRATION_ID, sql: SCHEMA_SQL },
  { id: "002_m3", sql: "ALTER TABLE tagihan ADD COLUMN alasan_diskon TEXT;" },
  {
    id: "003_m4",
    sql: `ALTER TABLE pembayaran ADD COLUMN provider TEXT NOT NULL DEFAULT 'manual';
          ALTER TABLE pembayaran ADD COLUMN qr_data TEXT;
          ALTER TABLE pembayaran ADD COLUMN expired_at TEXT;`,
  },
];

function pastikanPinPemilik(db: Db): void {
  const owner = db
    .prepare("SELECT id, pin_hash FROM pengguna WHERE peran = 'owner' LIMIT 1")
    .get() as { id: number; pin_hash: string | null } | undefined;
  if (owner && !owner.pin_hash) {
    db.prepare("UPDATE pengguna SET pin_hash = ? WHERE id = ?").run(
      hashSecret(config.ownerPin),
      owner.id,
    );
  }
}

export function migrate(db: Db): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS migrations (
       id TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`,
  );

  for (const migrasi of MIGRASI) {
    const sudah = db
      .prepare("SELECT 1 FROM migrations WHERE id = ?")
      .get(migrasi.id);
    if (sudah) continue;
    db.transaction(() => {
      db.exec(migrasi.sql);
      db.prepare("INSERT INTO migrations (id) VALUES (?)").run(migrasi.id);
    })();
  }
  pastikanPinPemilik(db);
}
