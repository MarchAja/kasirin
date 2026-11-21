import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { dataMenu } from "../domain/menu.js";
import {
  hitungSubtotal,
  rakitPesanan,
  sinkronisasiTagihan,
  type PesananData,
} from "../domain/pesanan.js";
import type { OutletPublik } from "../domain/types.js";
import type { Db } from "../db/client.js";
import { HttpError } from "../http.js";

const TOKEN_RE = /^[a-f0-9]{24}$/;

interface MejaRow { id: number; nomor: number; token: string; aktif: number }
interface KunjunganRow { id: number; dibuka_pada: string }
interface MenuRow { id: number; nama: string; harga: number; aktif: number; habis: number }
interface GrupRow {
  id: number;
  nama: string;
  min_pilih: number;
  max_pilih: number;
  wajib: number;
}
interface AddonPilihan {
  id: number;
  nama: string;
  harga: number;
  grup_id: number;
  grup_nama: string;
}
interface ItemTervalidasi {
  menu: MenuRow;
  addons: AddonPilihan[];
  jumlah: number;
  catatan: string | null;
  unit: number;
}

const kirimSchema = z.object({
  items: z
    .array(
      z.object({
        menu_item_id: z.number().int().positive(),
        jumlah: z.number().int().min(1).max(20),
        catatan: z.string().trim().max(200).optional(),
        pilihan_addon: z.array(z.number().int().positive()).max(12).default([]),
      }),
    )
    .min(1)
    .max(30),
});

function mejaDariToken(db: Db, token: string): MejaRow {
  if (!TOKEN_RE.test(token)) throw new HttpError(404, "QR meja tidak valid.");
  const meja = db
    .prepare("SELECT id, nomor, token, aktif FROM meja WHERE token = ? AND aktif = 1")
    .get(token) as MejaRow | undefined;
  if (!meja) throw new HttpError(404, "QR meja tidak valid.");
  return meja;
}

function dataOutlet(db: Db): OutletPublik {
  const outlet = db
    .prepare("SELECT nama, alamat, mode_bayar FROM outlet WHERE id = 1")
    .get() as OutletPublik | undefined;
  if (!outlet) throw new HttpError(404, "Outlet belum diatur.");
  return outlet;
}

function kunjunganTerbuka(db: Db, mejaId: number): KunjunganRow | undefined {
  return db
    .prepare(
      `SELECT id, dibuka_pada FROM kunjungan
       WHERE meja_id = ? AND status = 'buka' ORDER BY id DESC LIMIT 1`,
    )
    .get(mejaId) as KunjunganRow | undefined;
}

function tampilMeja(meja: MejaRow) {
  return { id: meja.id, nomor: meja.nomor, token: meja.token, aktif: Boolean(meja.aktif) };
}

function validasiItem(db: Db, mentah: z.infer<typeof kirimSchema>["items"][number]): ItemTervalidasi {
  const menu = db
    .prepare("SELECT id, nama, harga, aktif, habis FROM menu_item WHERE id = ?")
    .get(mentah.menu_item_id) as MenuRow | undefined;
  if (!menu || !menu.aktif || menu.habis) {
    throw new HttpError(400, "Menu tidak tersedia.");
  }

  const grupDiizinkan = new Set(
    (
      db
        .prepare("SELECT grup_id FROM menu_addon WHERE menu_item_id = ?")
        .all(menu.id) as Array<{ grup_id: number }>
    ).map((row) => row.grup_id),
  );

  const grupRows = db
    .prepare(
      `SELECT g.id, g.nama, g.min_pilih, g.max_pilih, g.wajib
       FROM addon_grup g JOIN menu_addon ma ON ma.grup_id = g.id
       WHERE ma.menu_item_id = ?`,
    )
    .all(menu.id) as GrupRow[];

  const addonStmt = db.prepare(
    `SELECT a.id, a.nama, a.harga, a.aktif, a.habis, a.grup_id, g.nama AS grup_nama
     FROM addon a JOIN addon_grup g ON g.id = a.grup_id WHERE a.id = ?`,
  );

  const addons: AddonPilihan[] = [];
  const sudah = new Set<number>();
  const jumlahPerGrup = new Map<number, number>();

  for (const addonId of new Set(mentah.pilihan_addon)) {
    const addon = addonStmt.get(addonId) as
      | (AddonPilihan & { aktif: number; habis: number })
      | undefined;
    if (!addon) throw new HttpError(400, "Addon tidak ditemukan.");
    if (!addon.aktif || addon.habis) {
      throw new HttpError(400, `Addon ${addon.nama} tidak tersedia.`);
    }
    if (!grupDiizinkan.has(addon.grup_id)) {
      throw new HttpError(400, `Addon ${addon.nama} tidak cocok dengan menu ini.`);
    }
    if (sudah.has(addonId)) continue;
    sudah.add(addonId);
    addons.push({
      id: addon.id,
      nama: addon.nama,
      harga: addon.harga,
      grup_id: addon.grup_id,
      grup_nama: addon.grup_nama,
    });
    jumlahPerGrup.set(addon.grup_id, (jumlahPerGrup.get(addon.grup_id) ?? 0) + 1);
  }

  for (const grup of grupRows) {
    const jumlah = jumlahPerGrup.get(grup.id) ?? 0;
    if (jumlah > grup.max_pilih) {
      throw new HttpError(400, `Grup ${grup.nama} maksimal ${grup.max_pilih} pilihan.`);
    }
    if (grup.wajib && jumlah < grup.min_pilih) {
      throw new HttpError(400, `Grup ${grup.nama} wajib dipilih.`);
    }
  }

  return {
    menu,
    addons,
    jumlah: mentah.jumlah,
    catatan: mentah.catatan ?? null,
    unit: menu.harga + addons.reduce((total, a) => total + a.harga, 0),
  };
}

export function registerCustomer(app: FastifyInstance, db: Db): void {
  app.get("/api/m/:token", async (request) => {
    const { token } = request.params as { token: string };
    const meja = mejaDariToken(db, token);
    return {
      meja: tampilMeja(meja),
      outlet: dataOutlet(db),
      kunjungan_terbuka: Boolean(kunjunganTerbuka(db, meja.id)),
    };
  });

  app.get("/api/m/:token/menu", async (request) => {
    const { token } = request.params as { token: string };
    mejaDariToken(db, token);
    return dataMenu(db);
  });

  app.get("/api/m/:token/status", async (request) => {
    const { token } = request.params as { token: string };
    const meja = mejaDariToken(db, token);
    const outlet = dataOutlet(db);
    const kunjungan = kunjunganTerbuka(db, meja.id);

    if (!kunjungan) {
      return {
        meja: tampilMeja(meja),
        outlet,
        ada_kunjungan: false,
        kunjungan_id: null,
        dibuka_pada: null,
        pesanan: [],
        tagihan: null,
      };
    }

    const baris = db
      .prepare(
        `SELECT id, status, dibuat_pada FROM pesanan
         WHERE kunjungan_id = ? ORDER BY id`,
      )
      .all(kunjungan.id) as Array<{
      id: number;
      status: PesananData["status"];
      dibuat_pada: string;
    }>;

    sinkronisasiTagihan(db, kunjungan.id);
    const tagihan = db
      .prepare(
        `SELECT subtotal, diskon, pajak, service, total, status
         FROM tagihan WHERE kunjungan_id = ?`,
      )
      .get(kunjungan.id) as
      | {
          subtotal: number;
          diskon: number;
          pajak: number;
          service: number;
          total: number;
          status: string;
        }
      | undefined;

    return {
      meja: tampilMeja(meja),
      outlet,
      ada_kunjungan: true,
      kunjungan_id: kunjungan.id,
      dibuka_pada: kunjungan.dibuka_pada,
      pesanan: rakitPesanan(db, baris),
      tagihan: tagihan ?? {
        subtotal: hitungSubtotal(db, kunjungan.id),
        diskon: 0,
        pajak: 0,
        service: 0,
        total: hitungSubtotal(db, kunjungan.id),
        status: "buka",
      },
    };
  });

  app.post("/api/m/:token/orders", async (request, reply) => {
    const { token } = request.params as { token: string };
    const meja = mejaDariToken(db, token);
    const input = kirimSchema.parse(request.body);
    const tervalidasi = input.items.map((item) => validasiItem(db, item));

    const hasil = db.transaction(() => {
      let kunjungan = kunjunganTerbuka(db, meja.id);
      if (!kunjungan) {
        const dibuat = db
          .prepare("INSERT INTO kunjungan (meja_id) VALUES (?)")
          .run(meja.id);
        kunjungan = {
          id: Number(dibuat.lastInsertRowid),
          dibuka_pada:
            (db.prepare("SELECT dibuka_pada FROM kunjungan WHERE id = ?").get(
              dibuat.lastInsertRowid,
            ) as { dibuka_pada: string })?.dibuka_pada ?? "",
        };
      }

      const dibuatPesanan = db
        .prepare("INSERT INTO pesanan (kunjungan_id) VALUES (?)")
        .run(kunjungan.id);
      const pesananId = Number(dibuatPesanan.lastInsertRowid);

      const simpanItem = db.prepare(
        `INSERT INTO pesanan_item
           (pesanan_id, menu_item_id, nama_snapshot, harga_snapshot, jumlah, catatan)
         VALUES (?, ?, ?, ?, ?, ?)`,
      );
      const simpanAddon = db.prepare(
        `INSERT INTO item_addon
           (pesanan_item_id, addon_id, nama_snapshot, harga_snapshot, grup_snapshot)
         VALUES (?, ?, ?, ?, ?)`,
      );

      for (const item of tervalidasi) {
        const hasilItem = simpanItem.run(
          pesananId,
          item.menu.id,
          item.menu.nama,
          item.menu.harga,
          item.jumlah,
          item.catatan,
        );
        const itemId = Number(hasilItem.lastInsertRowid);
        for (const addon of item.addons) {
          simpanAddon.run(
            itemId,
            addon.id,
            addon.nama,
            addon.harga,
            addon.grup_nama,
          );
        }
      }

      sinkronisasiTagihan(db, kunjungan.id);
      return { pesananId, kunjunganId: kunjungan.id };
    })();

    const pesanan = rakitPesanan(db, [
      {
        id: hasil.pesananId,
        status: "baru",
        dibuat_pada:
          (db
            .prepare("SELECT dibuat_pada FROM pesanan WHERE id = ?")
            .get(hasil.pesananId) as { dibuat_pada: string })?.dibuat_pada ?? "",
      },
    ])[0]!;

    return reply.code(201).send({ pesanan, kunjungan_id: hasil.kunjunganId });
  });
}
