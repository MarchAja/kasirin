import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { createApp } from "./app.js";
import { config } from "./config.js";

let direktori: string;
let app: FastifyInstance;
let tokenMeja: string;
let tokenKasir: string;
let tokenOwner: string;
let backupAsli: string;

beforeEach(async () => {
  direktori = fs.mkdtempSync(path.join(os.tmpdir(), "kasirin-m4-"));
  backupAsli = config.backupDir;
  (config as { backupDir: string }).backupDir = path.join(direktori, "backups");

  app = await createApp({
    dbPath: path.join(direktori, "uji.db"),
    seed: true,
    serveFrontend: false,
  });
  const tabel = await app.inject({ method: "GET", url: "/api/tables" });
  tokenMeja = (tabel.json().meja[0] as { token: string }).token;

  const masuk = async (body: object) => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: body,
    });
    return res.json().token as string;
  };
  tokenKasir = await masuk({ pin: "123456" });
  tokenOwner = await masuk({ password: "owner123" });
});

afterEach(async () => {
  await app.close();
  (config as { backupDir: string }).backupDir = backupAsli;
  fs.rmSync(direktori, { recursive: true, force: true });
});

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

async function kirimPesanan() {
  const menuRes = await app.inject({ method: "GET", url: `/api/m/${tokenMeja}/menu` });
  const menu = menuRes.json() as {
    items: Array<{ id: number; nama: string }>;
    grup_addon: Array<{ nama: string; addons: Array<{ id: number; nama: string }> }>;
  };
  const nasi = menu.items.find((i) => i.nama === "Nasi Goreng")!;
  const pedas = menu.grup_addon
    .find((g) => g.nama === "Level pedas")!
    .addons.find((a) => a.nama === "Tidak pedas")!;
  return app.inject({
    method: "POST",
    url: `/api/m/${tokenMeja}/orders`,
    payload: {
      items: [{ menu_item_id: nasi.id, jumlah: 1, pilihan_addon: [pedas.id] }],
    },
  });
}

async function terimaPesanan() {
  const antrean = await app.inject({
    method: "GET",
    url: "/api/orders/baru",
    headers: auth(tokenKasir),
  });
  const pesanan = (antrean.json().pesanan[0] as { id: number } | undefined)?.id;
  if (pesanan === undefined) throw new Error("Tidak ada pesanan untuk diterima.");
  return app.inject({
    method: "POST",
    url: `/api/orders/${pesanan}/accept`,
    headers: auth(tokenKasir),
  });
}

describe("Milestone 4 — QRIS otomatis", () => {
  it("menolak QRIS tanpa autentikasi kasir", async () => {
    const res = await app.inject({ method: "POST", url: "/api/tagihan/1/qris" });
    expect(res.statusCode).toBe(401);
  });

  it("membuat QRIS mock dan mengunci tagihan", async () => {
    await kirimPesanan();
    await terimaPesanan();
    const buat = await app.inject({
      method: "POST",
      url: "/api/tagihan/1/qris",
      headers: auth(tokenKasir),
    });
    expect(buat.statusCode).toBe(200);
    expect(buat.json().qris).toMatchObject({
      provider: "mock",
      amount: 25000,
    });
    expect(buat.json().qris.provider_ref).toContain("mock-1-");
    expect(buat.json().tagihan.status).toBe("tertunda");

    const locked = await kirimPesanan();
    expect(locked.statusCode).toBe(409);
    expect(locked.json().error).toContain("terkunci");
  });

  it("pelanggan bisa meminta QRIS dari HP", async () => {
    await kirimPesanan();
    await terimaPesanan();
    const info0 = await app.inject({
      method: "GET",
      url: `/api/m/${tokenMeja}/qris`,
    });
    expect(info0.json().qris).toBeNull();

    const buat = await app.inject({
      method: "POST",
      url: `/api/m/${tokenMeja}/qris`,
    });
    expect(buat.statusCode).toBe(200);
    expect(buat.json().qris.provider).toBe("mock");

    const info = await app.inject({
      method: "GET",
      url: `/api/m/${tokenMeja}/qris`,
    });
    expect(info.json().qris.provider_ref).toBe(
      buat.json().qris.provider_ref,
    );
  });

  it("mode manual melarang QRIS otomatis", async () => {
    await app.inject({
      method: "PATCH",
      url: "/api/outlet",
      headers: auth(tokenOwner),
      payload: { mode_bayar: "manual" },
    });
    await kirimPesanan();
    await terimaPesanan();
    const res = await app.inject({
      method: "POST",
      url: "/api/tagihan/1/qris",
      headers: auth(tokenKasir),
    });
    expect(res.statusCode).toBe(409);
  });

  it("cek status setelah simulasi bayar melunasi tagihan", async () => {
    await kirimPesanan();
    await terimaPesanan();
    const buat = await app.inject({
      method: "POST",
      url: "/api/tagihan/1/qris",
      headers: auth(tokenKasir),
    });
    const ref = buat.json().qris.provider_ref as string;

    const simulasi = await app.inject({
      method: "POST",
      url: `/api/qris/mock/bayar/${ref}`,
      headers: auth(tokenKasir),
    });
    expect(simulasi.statusCode).toBe(200);

    const cek = await app.inject({
      method: "POST",
      url: "/api/tagihan/1/cek-status",
      headers: auth(tokenKasir),
    });
    expect(cek.statusCode).toBe(200);
    expect(cek.json().status).toBe("lunas");
    expect(cek.json().tagihan.status).toBe("lunas");
    expect(cek.json().tagihan.pembayaran[0]).toMatchObject({
      metode: "qris_otomatis",
      status: "lunas",
    });

    const ringkasan = await app.inject({
      method: "GET",
      url: "/api/ringkasan/hari-ini",
      headers: auth(tokenKasir),
    });
    expect(ringkasan.json().per_metode[0].metode).toBe("qris_otomatis");
    expect(ringkasan.json().total_diterima).toBe(25000);
  });

  it("batal QRIS membuka kunci dan QRIS baru memakai total terbaru", async () => {
    await kirimPesanan();
    await terimaPesanan();
    const pertama = await app.inject({
      method: "POST",
      url: "/api/tagihan/1/qris",
      headers: auth(tokenKasir),
    });
    const nominalPertama = pertama.json().qris.amount as number;

    const batal = await app.inject({
      method: "POST",
      url: "/api/tagihan/1/qris/batal",
      headers: auth(tokenKasir),
    });
    expect(batal.json().tagihan.status).toBe("buka");
    expect((await kirimPesanan()).statusCode).toBe(201);

    const kedua = await app.inject({
      method: "POST",
      url: "/api/tagihan/1/qris",
      headers: auth(tokenKasir),
    });
    expect(kedua.json().qris.amount).toBe(nominalPertama * 2);
  });

  it("status pelanggan menyertakan mode bayar dan info QRIS", async () => {
    await kirimPesanan();
    await terimaPesanan();
    const status = await app.inject({
      method: "GET",
      url: `/api/m/${tokenMeja}/status`,
    });
    expect(status.json().mode_bayar).toBe("keduanya");
    expect(status.json().qris).toBeNull();
    expect(status.json().tagihan.status).toBe("buka");
  });
});

describe("Milestone 4 — cadangan", () => {
  it("kasir tidak bisa mengakses cadangan", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/cadangan",
      headers: auth(tokenKasir),
    });
    expect(res.statusCode).toBe(403);
  });

  it("pemilik bisa membuat, melihat, mengunduh, dan mengekspor cadangan", async () => {
    const dibuat = await app.inject({
      method: "POST",
      url: "/api/cadangan/buat",
      headers: auth(tokenOwner),
    });
    expect(dibuat.statusCode).toBe(200);
    expect(dibuat.json().cadangan).toHaveLength(1);
    const nama = dibuat.json().cadangan[0].nama as string;
    expect(nama).toMatch(/^kasirin-.*\.db$/);

    const daftar = await app.inject({
      method: "GET",
      url: "/api/cadangan",
      headers: auth(tokenOwner),
    });
    expect(daftar.json().cadangan[0].nama).toBe(nama);

    const unduh = await app.inject({
      method: "GET",
      url: `/api/cadangan/${nama}/unduh`,
      headers: auth(tokenOwner),
    });
    expect(unduh.statusCode).toBe(200);
    expect(unduh.headers["content-type"]).toContain("octet-stream");

    const tujuan = path.join(direktori, "ekspor");
    const ekspor = await app.inject({
      method: "POST",
      url: "/api/cadangan/ekspor",
      headers: auth(tokenOwner),
      payload: { path: tujuan },
    });
    expect(ekspor.statusCode).toBe(200);
    expect(
      fs.readdirSync(tujuan).some((file) => file.endsWith(".db")),
    ).toBe(true);
  });

  it("nama cadangan berjalan ditolak", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/cadangan/../../etc/passwd/unduh",
      headers: auth(tokenOwner),
    });
    expect([400, 404]).toContain(res.statusCode);
  });
});
