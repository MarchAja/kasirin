import type { Db } from "./client.js";
import { MIGRATION_ID, SCHEMA_SQL } from "./schema.js";

export function migrate(db: Db): void {
  db.exec(SCHEMA_SQL);
  db.prepare("INSERT OR IGNORE INTO migrations (id) VALUES (?)").run(MIGRATION_ID);
}
