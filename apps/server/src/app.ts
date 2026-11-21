import fs from "node:fs";
import path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { ZodError } from "zod";
import { jadwalkanCadangan } from "./backup/index.js";
import { config, dataFile, uploadDir, webDistDir } from "./config.js";
import { openDb } from "./db/client.js";
import { migrate } from "./db/migrate.js";
import { seedDemo } from "./db/seed.js";
import { HttpError } from "./http.js";
import { registerAuth } from "./routes/auth.js";
import { registerCadangan } from "./routes/cadangan.js";
import { registerCustomer } from "./routes/customer.js";
import { registerKunjungan } from "./routes/kunjungan.js";
import { registerMenu } from "./routes/menu.js";
import { registerOrders } from "./routes/orders.js";
import { registerQris } from "./routes/qris.js";
import { registerRingkasan } from "./routes/ringkasan.js";
import { registerTagihan } from "./routes/tagihan.js";
import { registerTables } from "./routes/tables.js";

export interface AppOptions {
  dbPath?: string;
  seed?: boolean;
  logger?: boolean;
  serveFrontend?: boolean;
  backup?: boolean;
}

export async function createApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const db = openDb(options.dbPath ?? dataFile);
  migrate(db);
  if (options.seed ?? config.demo) seedDemo(db);

  const app = Fastify({ logger: options.logger ?? false });

  await app.register(cors, { origin: true, credentials: true });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: "Data tidak valid.", detail: error.issues });
    }
    const status = (error as { statusCode?: unknown }).statusCode;
    if (typeof status === "number" && status >= 400 && status < 500) {
      return reply.code(status).send({ error: (error as Error).message });
    }
    app.log.error(error);
    return reply.code(500).send({ error: "Terjadi kesalahan pada server." });
  });

  app.get("/api/health", async () => ({
    ok: true,
    versi: config.versi,
    waktu: new Date().toISOString(),
  }));

  registerAuth(app, db);
  registerTables(app, db);
  registerMenu(app, db);
  registerCustomer(app, db);
  registerOrders(app, db);
  registerTagihan(app, db);
  registerKunjungan(app, db);
  registerRingkasan(app, db);
  registerQris(app, db);
  registerCadangan(app, db);

  const hentikanCadangan = options.backup ? jadwalkanCadangan(db) : () => {};

  if (fs.existsSync(uploadDir)) {
    await app.register(fastifyStatic, {
      root: uploadDir,
      prefix: "/uploads/",
      decorateReply: false,
    });
  }

  if (
    (options.serveFrontend ?? true) &&
    fs.existsSync(path.join(webDistDir, "index.html"))
  ) {
    await app.register(fastifyStatic, {
      root: webDistDir,
      prefix: "/",
    });
    app.setNotFoundHandler((_request, reply) => reply.sendFile("index.html"));
  }

  app.addHook("onClose", async () => {
    hentikanCadangan();
    db.close();
  });

  return app;
}
