import { config, dataFile } from "../config.js";
import { openDb } from "./client.js";
import { migrate } from "./migrate.js";
import { seedDemo } from "./seed.js";

const perintah = process.argv[2];
const db = openDb(dataFile);

try {
  if (perintah === "migrate") {
    migrate(db);
    console.log(`Migrasi selesai. Data: ${config.dataDir}`);
  } else if (perintah === "seed") {
    migrate(db);
    const ditanam = seedDemo(db, { paksa: true });
    console.log(ditanam ? "Data demo berhasil ditanam ulang." : "Data demo gagal ditanam.");
  } else {
    console.error("Pakai: npm run db:migrate | npm run db:seed");
    process.exitCode = 1;
  }
} finally {
  db.close();
}
