import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { createApp } from "./app.js";

let direktori: string;
let app: FastifyInstance;

beforeEach(async () => {
  direktori = fs.mkdtempSync(path.join(os.tmpdir(), "kasirin-test-"));
  app = await createApp({
    dbPath: path.join(direktori, "uji.db"),
    seed: true,
    serveFrontend: false,
  });
});

afterEach(async () => {
  await app.close();
  fs.rmSync(direktori, { recursive: true, force: true });
});

describe("Milestone 1 — integrasi API", () => {
  it("health check menjawab ok", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
    expect(res.json().versi).toBe("0.1.0");
  });

  it("kasir bisa masuk memakai PIN demo", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { pin: "123456" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.token).toBeTypeOf("string");
    expect(body.pengguna).toMatchObject({ nama: "Rina", peran: "kasir" });
  });

  it("pemilik bisa masuk memakai kata sandi demo", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { password: "owner123" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().pengguna).toMatchObject({ peran: "owner" });
  });

  it("PIN salah ditolak", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { pin: "000000" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("menolak permintaan tanpa token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(res.statusCode).toBe(401);
  });

  it("mengembalikan 12 meja dengan token unik", async () => {
    const res = await app.inject({ method: "GET", url: "/api/tables" });
    expect(res.statusCode).toBe(200);
    const { meja } = res.json();
    expect(meja).toHaveLength(12);
    expect(new Set(meja.map((m: { token: string }) => m.token)).size).toBe(12);
    expect(meja[0].aktif).toBe(true);
  });

  it("menu demo memuat kategori, addon, dan pilihan Tanpa tambahan sebagai konsep UI", async () => {
    const res = await app.inject({ method: "GET", url: "/api/menu" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.kategori).toHaveLength(3);
    expect(body.items).toHaveLength(12);
    expect(body.grup_addon).toHaveLength(2);

    const tambahan = body.grup_addon.find((g: { nama: string }) => g.nama === "Tambahan");
    expect(tambahan).toMatchObject({ min_pilih: 0, max_pilih: 3, wajib: false });
    expect(tambahan.addons.every((a: { harga: number }) => a.harga >= 0)).toBe(true);

    const pedas = body.grup_addon.find((g: { nama: string }) => g.nama === "Level pedas");
    expect(pedas).toMatchObject({ min_pilih: 1, max_pilih: 1, wajib: true });
  });

  it("kasir tidak bisa mengubah menu", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { pin: "123456" },
    });
    const token = login.json().token as string;
    const res = await app.inject({
      method: "PATCH",
      url: "/api/menu/1",
      headers: { authorization: `Bearer ${token}` },
      payload: { habis: true },
    });
    expect(res.statusCode).toBe(403);
  });

  it("pemilik bisa menandai menu habis", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { password: "owner123" },
    });
    const token = login.json().token as string;
    const res = await app.inject({
      method: "PATCH",
      url: "/api/menu/1",
      headers: { authorization: `Bearer ${token}` },
      payload: { habis: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().item.habis).toBe(true);

    const cek = await app.inject({ method: "GET", url: "/api/menu" });
    expect(cek.json().items[0].habis).toBe(true);
  });

  it("body tidak valid menghasilkan 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { pin: "123456", password: "owner123" },
    });
    expect(res.statusCode).toBe(400);
  });
});
