import path from "node:path";
import fs from "node:fs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config, uploadDir } from "../config.js";
import { daftarCadangan, buatCadangan } from "../backup/index.js";
import type { Db } from "../db/client.js";
import { HttpError, requireOwner } from "../http.js";

const eksporSchema = z.object({ path: z.string().trim().min(1).max(500) });
const NAMA_RE = /^kasirin-\d{4}-\d{2}-\d{2}.*\.db$/;

function hasil() {
  return { cadangan: daftarCadangan(), folder: config.backupDir };
}

export function registerCadangan(app: FastifyInstance, db: Db): void {
  app.get("/api/cadangan", async (request) => {
    await requireOwner(request);
    return hasil();
  });

  app.post("/api/cadangan/buat", async (request) => {
    await requireOwner(request);
    await buatCadangan(db);
    return hasil();
  });

  app.get("/api/cadangan/:nama/unduh", async (request, reply) => {
    await requireOwner(request);
    const { nama } = request.params as { nama: string };
    if (!NAMA_RE.test(nama)) throw new HttpError(400, "Nama cadangan tidak valid.");
    const file = path.join(config.backupDir, nama);
    if (!fs.existsSync(file)) throw new HttpError(404, "Cadangan tidak ditemukan.");
    return reply
      .header("Content-Disposition", `attachment; filename="${nama}"`)
      .type("application/octet-stream")
      .send(fs.readFileSync(file));
  });

  app.post("/api/cadangan/ekspor", async (request) => {
    await requireOwner(request);
    const { path: tujuan } = eksporSchema.parse(request.body);
    await buatCadangan(db);
    const terbaru = daftarCadangan()[0];
    if (!terbaru) throw new HttpError(500, "Cadangan gagal dibuat.");

    const folder = path.resolve(tujuan);
    fs.mkdirSync(folder, { recursive: true });
    const tujuanDb = path.join(folder, terbaru.nama);
    fs.copyFileSync(path.join(config.backupDir, terbaru.nama), tujuanDb);

    if (fs.existsSync(uploadDir)) {
      fs.cpSync(uploadDir, path.join(folder, "uploads"), {
        recursive: true,
        force: true,
      });
    }

    return { ok: true, path: folder };
  });
}
