import type { FastifyInstance } from "fastify";
import { ringkasanHarian } from "../domain/tagihan.js";
import type { Db } from "../db/client.js";
import { requireAuth } from "../http.js";

export function registerRingkasan(app: FastifyInstance, db: Db): void {
  app.get("/api/ringkasan/hari-ini", async (request) => {
    await requireAuth(request);
    return ringkasanHarian(db);
  });
}
