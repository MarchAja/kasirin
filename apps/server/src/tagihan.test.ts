import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { createApp } from "./app.js";

let direktori: string;
let app: FastifyInstance;
let tokenMeja: string;
let tokenKasir: string;
let tokenOwner: string;

beforeEach(async () => {
  direktori = fs.mkdtempSync(path.join(os.tmpdir(), "kasirin-m3-"));
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
  fs.rmSync(direktori, { recursive: true, force: true });
});

const header = (token: string) => ({ authorization: `Bearer ${token}` });

async function pesanDanTerima(jumlah = 1) {
  const menuRes = await app.inject({ method: "GET", url: `/api/m/${tokenMeja}/menu` });
  const menu = menuRes.json() as {
    items: Array<{ id: number; nama: string }>;
    grup_addon: Array<{ nama: string; addons: Array<{ id: number; nama: string }> }>;
  };
  const nasi = menu.items.find((i) => i.nama === "Nasi Goreng")!;
  const pedas = menu.grup_addon
    .find((g) => g.nama === "Level pedas")!
    .addons.find((a) => a.nama === "Tidak pedas")!;
  await app.inject({
    method: "POST",
    url: `/api/m/${tokenMeja}/orders`,
    payload: {
      items: [{ menu_item_id: nasi.id, jumlah, pilihan_addon: [pedas.id] }],
    },
  });
  const antrean = await app.inject({
    method: "GET",
    url: "/api/orders/baru",
    headers: header(tokenKasir),
  });
  const id = (antrean.json().pesanan[0] as { id: number }).id;
  await app.inject({
    method: "POST",
    url: `/api/orders/${id}/accept`,
    headers: header(tokenKasir),
  });
}

async function tagihanAktif() {
  const res = await app.inject({
    method: "GET",
    url: "/api/tagihan/meja/1",
    headers: header(tokenKasir),
  });
  return res.json().tagihan as {
    id: number;
    kunjungan_id: number;
    subtotal: number;
    diskon: number;
    total: number;
    status: string;
  };
}

describe("Milestone 3 — pembayaran dan penutupan", () => {
  it("tagihan dibuka saat pesanan diterima", async () => {
    await pesanDanTerima(2);
    const tagihan = await tagihanAktif();
    expect(tagihan.status).toBe("buka");
    expect(tagihan.subtotal).toBe(50000);
    expect(tagihan.total).toBe(50000);
  });

  it("body JSON kosong menghasilkan 400, bukan 500", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/orders/1/accept",
      headers: { ...header(tokenKasir), "content-type": "application/json" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("tagihan meja tanpa kunjungan bernilai null", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/tagihan/meja/2",
      headers: header(tokenKasir),
    });
    expect(res.json().tagihan).toBeNull();
  });

  it("pajak dan service dihitung dari pengaturan outlet", async () => {
    await pesanDanTerima(1);
    const ubah = await app.inject({
      method: "PATCH",
      url: "/api/outlet",
      headers: header(tokenOwner),
      payload: { pajak_persen: 10, service_persen: 5 },
    });
    expect(ubah.statusCode).toBe(200);

    const tagihan = await tagihanAktif();
    expect(tagihan.subtotal).toBe(25000);
    expect(tagihan.total).toBe(28750); // 25.000 + 2.500 + 1.250
  });

  it("kasir tidak bisa mengubah pengaturan outlet", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/outlet",
      headers: header(tokenKasir),
      payload: { pajak_persen: 10 },
    });
    expect(res.statusCode).toBe(403);
  });

  it("diskon menolak PIN pemilik yang salah", async () => {
    await pesanDanTerima(1);
    const tagihan = await tagihanAktif();
    const res = await app.inject({
      method: "POST",
      url: `/api/tagihan/${tagihan.id}/diskon`,
      headers: header(tokenKasir),
      payload: { diskon: 5000, alasan: "pelanggan tetap", pin: "000000" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toContain("PIN");
  });

  it("diskon dengan PIN benar tersimpan beserta alasannya", async () => {
    await pesanDanTerima(2);
    const tagihan = await tagihanAktif();
    const res = await app.inject({
      method: "POST",
      url: `/api/tagihan/${tagihan.id}/diskon`,
      headers: header(tokenKasir),
      payload: {
        persen: 10,
        alasan: "promo hari ini",
        pin: "246810",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().tagihan).toMatchObject({
      diskon: 5000,
      alasan_diskon: "promo hari ini",
      total: 45000,
    });
  });

  it("diskon melebihi subtotal ditolak", async () => {
    await pesanDanTerima(1);
    const tagihan = await tagihanAktif();
    const res = await app.inject({
      method: "POST",
      url: `/api/tagihan/${tagihan.id}/diskon`,
      headers: header(tokenKasir),
      payload: { diskon: 30000, alasan: "terlalu besar", pin: "246810" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("pembayaran tunai menolak nominal kurang", async () => {
    await pesanDanTerima(1);
    const tagihan = await tagihanAktif();
    const res = await app.inject({
      method: "POST",
      url: `/api/tagihan/${tagihan.id}/bayar`,
      headers: header(tokenKasir),
      payload: { metode: "tunai", nominal: 10000 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("pembayaran tunai melunasikan tagihan dan tercatat di ringkasan", async () => {
    await pesanDanTerima(2);
    const tagihan = await tagihanAktif();
    const bayar = await app.inject({
      method: "POST",
      url: `/api/tagihan/${tagihan.id}/bayar`,
      headers: header(tokenKasir),
      payload: { metode: "tunai", nominal: 50000 },
    });
    expect(bayar.statusCode).toBe(201);
    expect(bayar.json().tagihan.status).toBe("lunas");
    expect(bayar.json().tagihan.pembayaran).toHaveLength(1);
    expect(bayar.json().tagihan.pembayaran[0]).toMatchObject({
      metode: "tunai",
      nominal: 50000,
      status: "lunas",
    });

    const ringkasan = await app.inject({
      method: "GET",
      url: "/api/ringkasan/hari-ini",
      headers: header(tokenKasir),
    });
    expect(ringkasan.json().total_diterima).toBe(50000);
    expect(ringkasan.json().jumlah_transaksi).toBe(1);
    expect(ringkasan.json().per_metode[0]).toMatchObject({
      metode: "tunai",
      total: 50000,
    });
  });

  it("QRIS manual bisa ditandai perlu dicek lalu dikonfirmasi", async () => {
    await pesanDanTerima(1);
    const tagihan = await tagihanAktif();
    const bayar = await app.inject({
      method: "POST",
      url: `/api/tagihan/${tagihan.id}/bayar`,
      headers: header(tokenKasir),
      payload: { metode: "qris_manual", perlu_dicek: true },
    });
    expect(bayar.json().tagihan.status).toBe("perlu_dicek");

    const ringkasan = await app.inject({
      method: "GET",
      url: "/api/ringkasan/hari-ini",
      headers: header(tokenKasir),
    });
    expect(ringkasan.json().perlu_dicek).toBe(1);
    expect(ringkasan.json().total_diterima).toBe(0);

    const konfirmasi = await app.inject({
      method: "POST",
      url: `/api/tagihan/${tagihan.id}/konfirmasi`,
      headers: header(tokenKasir),
    });
    expect(konfirmasi.json().tagihan.status).toBe("lunas");

    const ringkasan2 = await app.inject({
      method: "GET",
      url: "/api/ringkasan/hari-ini",
      headers: header(tokenKasir),
    });
    expect(ringkasan2.json().total_diterima).toBe(25000);
    expect(ringkasan2.json().perlu_dicek).toBe(0);
  });

  it("meja belum bisa ditutup sebelum lunas", async () => {
    await pesanDanTerima(1);
    const tagihan = await tagihanAktif();
    const res = await app.inject({
      method: "POST",
      url: `/api/kunjungan/${tagihan.kunjungan_id}/tutup`,
      headers: header(tokenKasir),
    });
    expect(res.statusCode).toBe(409);
  });

  it("menutup meja setelah lunas membuat kunjungan baru di pesanan berikutnya", async () => {
    await pesanDanTerima(1);
    let tagihan = await tagihanAktif();
    await app.inject({
      method: "POST",
      url: `/api/tagihan/${tagihan.id}/bayar`,
      headers: header(tokenKasir),
      payload: { metode: "tunai" },
    });
    const tutup = await app.inject({
      method: "POST",
      url: `/api/kunjungan/${tagihan.kunjungan_id}/tutup`,
      headers: header(tokenKasir),
    });
    expect(tutup.statusCode).toBe(200);
    expect(tutup.json().tagihan.status).toBe("ditutup");
    expect(tutup.json().meja.status).toBe("kosong");
    expect(tutup.json().meja.kunjungan_id).toBeNull();

    const status = await app.inject({
      method: "GET",
      url: `/api/m/${tokenMeja}/status`,
    });
    expect(status.json().ada_kunjungan).toBe(false);

    await pesanDanTerima(1);
    tagihan = await tagihanAktif();
    expect(tagihan.status).toBe("buka");
    expect(tagihan.kunjungan_id).not.toBe(1);
    expect(tagihan.total).toBe(25000);
  });
});
