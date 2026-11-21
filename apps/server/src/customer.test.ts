import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { createApp } from "./app.js";

let direktori: string;
let app: FastifyInstance;
let tokenMeja: string;

beforeEach(async () => {
  direktori = fs.mkdtempSync(path.join(os.tmpdir(), "kasirin-m2-"));
  app = await createApp({
    dbPath: path.join(direktori, "uji.db"),
    seed: true,
    serveFrontend: false,
  });
  const res = await app.inject({ method: "GET", url: "/api/tables" });
  tokenMeja = (res.json().meja[0] as { token: string }).token;
});

afterEach(async () => {
  await app.close();
  fs.rmSync(direktori, { recursive: true, force: true });
});

async function dataMenu() {
  const res = await app.inject({ method: "GET", url: `/api/m/${tokenMeja}/menu` });
  return res.json() as {
    items: Array<{ id: number; nama: string; harga: number; habis: boolean }>;
    grup_addon: Array<{
      id: number;
      nama: string;
      addons: Array<{
        id: number;
        nama: string;
        harga: number;
        habis: boolean;
        aktif: boolean;
      }>;
    }>;
  };
}

async function tokenKasir(): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { pin: "123456" },
  });
  return res.json().token as string;
}

function itemNasi(menu: Awaited<ReturnType<typeof dataMenu>>) {
  return menu.items.find((i) => i.nama === "Nasi Goreng")!;
}
function addon(
  menu: Awaited<ReturnType<typeof dataMenu>>,
  grup: string,
  nama: string,
) {
  return menu.grup_addon
    .find((g) => g.nama === grup)!
    .addons.find((a) => a.nama === nama)!;
}

describe("Milestone 2 — alur pelanggan", () => {
  it("token meja salah ditolak", async () => {
    const res = await app.inject({ method: "GET", url: "/api/m/salah/status" });
    expect(res.statusCode).toBe(404);
  });

  it("info meja dan menu bisa diakses tanpa login", async () => {
    const info = await app.inject({ method: "GET", url: `/api/m/${tokenMeja}` });
    expect(info.statusCode).toBe(200);
    expect(info.json().kunjungan_terbuka).toBe(false);
    expect(info.json().outlet.nama).toBe("Warung Bu Sri");

    const menu = await dataMenu();
    expect(menu.items).toHaveLength(12);
    expect(menu.items[0].habis).toBe(false);
    expect(menu.grup_addon).toHaveLength(2);
    const tambahan = menu.grup_addon.find((g) => g.nama === "Tambahan")!;
    expect(tambahan.addons[0].habis).toBe(false);
    expect(tambahan.addons[0].aktif).toBe(true);
  });

  it("mengirim pesanan membuka kunjungan dan menyalin snapshot addon", async () => {
    const menu = await dataMenu();
    const nasi = itemNasi(menu);
    const esTeh = menu.items.find((i) => i.nama === "Es Teh")!;
    const tidakPedas = addon(menu, "Level pedas", "Tidak pedas");
    const telur = addon(menu, "Tambahan", "Telur ceplok");

    const res = await app.inject({
      method: "POST",
      url: `/api/m/${tokenMeja}/orders`,
      payload: {
        items: [
          {
            menu_item_id: nasi.id,
            jumlah: 2,
            catatan: "tanpa bawang",
            pilihan_addon: [tidakPedas.id, telur.id],
          },
          { menu_item_id: esTeh.id, jumlah: 1, pilihan_addon: [] },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.pesanan.status).toBe("baru");
    expect(body.pesanan.items[0].addons).toHaveLength(2);
    expect(body.pesanan.items[0].addons[0]).toMatchObject({
      nama: "Tidak pedas",
      grup: "Level pedas",
    });

    const status = await app.inject({
      method: "GET",
      url: `/api/m/${tokenMeja}/status`,
    });
    const isi = status.json();
    expect(isi.ada_kunjungan).toBe(true);
    expect(isi.pesanan).toHaveLength(1);
    // (25.000 + 5.000) × 2 + 8.000 = 68.000
    expect(isi.tagihan.total).toBe(68000);

    const info = await app.inject({ method: "GET", url: `/api/m/${tokenMeja}` });
    expect(info.json().kunjungan_terbuka).toBe(true);
  });

  it("grup wajib harus dipilih", async () => {
    const menu = await dataMenu();
    const res = await app.inject({
      method: "POST",
      url: `/api/m/${tokenMeja}/orders`,
      payload: {
        items: [{ menu_item_id: itemNasi(menu).id, jumlah: 1, pilihan_addon: [] }],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("wajib");
  });

  it("addon dari grup lain ditolak", async () => {
    const menu = await dataMenu();
    const esTeh = menu.items.find((i) => i.nama === "Es Teh")!;
    const tidakPedas = addon(menu, "Level pedas", "Tidak pedas");
    const res = await app.inject({
      method: "POST",
      url: `/api/m/${tokenMeja}/orders`,
      payload: {
        items: [
          {
            menu_item_id: esTeh.id,
            jumlah: 1,
            pilihan_addon: [tidakPedas.id],
          },
        ],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("tidak cocok");
  });

  it("menu habis tidak bisa dipesan", async () => {
    const menu = await dataMenu();
    const ayam = menu.items.find((i) => i.nama === "Ayam Bakar")!;
    const pedas = addon(menu, "Level pedas", "Tidak pedas");
    const res = await app.inject({
      method: "POST",
      url: `/api/m/${tokenMeja}/orders`,
      payload: {
        items: [
          {
            menu_item_id: ayam.id,
            jumlah: 1,
            pilihan_addon: [pedas.id],
          },
        ],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("pesanan tambahan masuk ke kunjungan dan tagihan yang sama", async () => {
    const menu = await dataMenu();
    const nasi = itemNasi(menu);
    const pedas = addon(menu, "Level pedas", "Tidak pedas");
    const pertama = await app.inject({
      method: "POST",
      url: `/api/m/${tokenMeja}/orders`,
      payload: {
        items: [{ menu_item_id: nasi.id, jumlah: 1, pilihan_addon: [pedas.id] }],
      },
    });
    const kunjunganPertama = pertama.json().kunjungan_id as number;

    const kedua = await app.inject({
      method: "POST",
      url: `/api/m/${tokenMeja}/orders`,
      payload: {
        items: [{ menu_item_id: nasi.id, jumlah: 1, pilihan_addon: [pedas.id] }],
      },
    });
    expect(kedua.json().kunjungan_id).toBe(kunjunganPertama);

    const status = await app.inject({
      method: "GET",
      url: `/api/m/${tokenMeja}/status`,
    });
    expect(status.json().pesanan).toHaveLength(2);
    expect(status.json().tagihan.total).toBe(50000);
  });

  it("kasir menerima dan menyajikan pesanan; tagihan dibuka saat terima", async () => {
    const menu = await dataMenu();
    const nasi = itemNasi(menu);
    const pedas = addon(menu, "Level pedas", "Tidak pedas");
    await app.inject({
      method: "POST",
      url: `/api/m/${tokenMeja}/orders`,
      payload: {
        items: [{ menu_item_id: nasi.id, jumlah: 1, pilihan_addon: [pedas.id] }],
      },
    });

    const token = await tokenKasir();
    const antrean = await app.inject({
      method: "GET",
      url: "/api/orders/baru",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(antrean.statusCode).toBe(200);
    expect(antrean.json().pesanan).toHaveLength(1);
    expect(antrean.json().pesanan[0]).toMatchObject({
      meja_nomor: 1,
      status: "baru",
      total: 25000,
    });

    const id = antrean.json().pesanan[0].id as number;
    const terima = await app.inject({
      method: "POST",
      url: `/api/orders/${id}/accept`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(terima.statusCode).toBe(200);
    expect(terima.json().pesanan.status).toBe("diterima");

    const status = await app.inject({
      method: "GET",
      url: `/api/m/${tokenMeja}/status`,
    });
    expect(status.json().tagihan.status).toBe("buka");
    expect(status.json().tagihan.total).toBe(25000);

    const sajikan = await app.inject({
      method: "POST",
      url: `/api/orders/${id}/serve`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(sajikan.json().pesanan.status).toBe("disajikan");

    const meja = await app.inject({ method: "GET", url: "/api/tables" });
    expect(meja.json().meja[0]).toMatchObject({
      status: "disajikan",
      total: 25000,
    });
  });

  it("antrean kasir butuh autentikasi", async () => {
    const res = await app.inject({ method: "GET", url: "/api/orders/baru" });
    expect(res.statusCode).toBe(401);
  });
});
