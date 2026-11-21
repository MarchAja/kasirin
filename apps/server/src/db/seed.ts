import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { ROOT_DIR, config, uploadDir } from "../config.js";
import { hashSecret } from "../auth.js";
import type { Db } from "./client.js";

const KATEGORI = ["Makanan", "Minuman", "Camilan"] as const;

const GRUP = [
  { nama: "Tambahan", min: 0, max: 3, wajib: 0 },
  { nama: "Level pedas", min: 1, max: 1, wajib: 1 },
] as const;

const ADDON: Array<{ grup: string; nama: string; harga: number }> = [
  { grup: "Tambahan", nama: "Telur ceplok", harga: 5000 },
  { grup: "Tambahan", nama: "Keju", harga: 8000 },
  { grup: "Tambahan", nama: "Sosis", harga: 7000 },
  { grup: "Level pedas", nama: "Tidak pedas", harga: 0 },
  { grup: "Level pedas", nama: "Pedas sedang", harga: 0 },
  { grup: "Level pedas", nama: "Pedas maksimal", harga: 0 },
];

const MENU: Array<{
  kategori: string;
  nama: string;
  harga: number;
  foto?: string;
  habis?: boolean;
  grup: string[];
}> = [
  { kategori: "Makanan", nama: "Nasi Goreng", harga: 25000, foto: "nasi-goreng.jpg", grup: ["Tambahan", "Level pedas"] },
  { kategori: "Makanan", nama: "Ayam Bakar", harga: 28000, foto: "ayam-bakar.jpg", habis: true, grup: ["Level pedas"] },
  { kategori: "Makanan", nama: "Nasi Ayam", harga: 22000, grup: ["Level pedas"] },
  { kategori: "Makanan", nama: "Mie Goreng", harga: 24000, grup: ["Tambahan", "Level pedas"] },
  { kategori: "Makanan", nama: "Sate Ayam", harga: 30000, grup: ["Level pedas"] },
  { kategori: "Makanan", nama: "Nasi Soto", harga: 23000, grup: [] },
  { kategori: "Minuman", nama: "Es Teh", harga: 8000, foto: "es-teh.jpg", grup: [] },
  { kategori: "Minuman", nama: "Es Jeruk", harga: 9000, foto: "es-jeruk.jpg", grup: [] },
  { kategori: "Minuman", nama: "Teh Tawar", harga: 5000, grup: [] },
  { kategori: "Minuman", nama: "Kopi Susu", harga: 12000, grup: [] },
  { kategori: "Camilan", nama: "Pisang Goreng", harga: 15000, grup: [] },
  { kategori: "Camilan", nama: "Keripik Singkong", harga: 12000, grup: [] },
];

/** Menanam data contoh hanya jika outlet belum ada. Mengembalikan true jika ditanam. */
export function seedDemo(db: Db, opsi?: { paksa?: boolean }): boolean {
  const sudahAda = db.prepare("SELECT COUNT(*) AS n FROM outlet").get() as { n: number };
  if (sudahAda.n > 0 && !opsi?.paksa) return false;

  fs.mkdirSync(uploadDir, { recursive: true });
  const fotoSource = path.join(ROOT_DIR, "prototype", "img");
  for (const file of ["nasi-goreng.jpg", "ayam-bakar.jpg", "es-teh.jpg", "es-jeruk.jpg"]) {
    const src = path.join(fotoSource, file);
    const dst = path.join(uploadDir, file);
    if (fs.existsSync(src) && !fs.existsSync(dst)) fs.copyFileSync(src, dst);
  }

  const tanam = db.transaction(() => {
    if (opsi?.paksa) {
      db.exec(`
        DELETE FROM item_addon; DELETE FROM pesanan_item; DELETE FROM pesanan;
        DELETE FROM tagihan; DELETE FROM pembayaran; DELETE FROM kunjungan;
        DELETE FROM menu_addon; DELETE FROM menu_item; DELETE FROM addon;
        DELETE FROM addon_grup; DELETE FROM kategori; DELETE FROM meja;
        DELETE FROM pengguna; DELETE FROM audit_log; DELETE FROM pengaturan;
        DELETE FROM outlet;
      `);
    }

    db.prepare(
      `INSERT INTO outlet (id, nama, alamat, mode_bayar) VALUES (1, ?, ?, 'manual')`,
    ).run("Warung Bu Sri", "Jl. Mawar No. 12, Indonesia");

    db.prepare(
      `INSERT INTO pengguna (nama, peran, password_hash, pin_hash)
       VALUES ('Pemilik', 'owner', ?, ?)`,
    ).run(hashSecret(config.ownerPassword), hashSecret(config.ownerPin));
    db.prepare(
      `INSERT INTO pengguna (nama, peran, password_hash, pin_hash)
       VALUES ('Rina', 'kasir', NULL, ?)`,
    ).run(hashSecret(config.kasirPin));

    const idKategori = new Map<string, number>();
    const insertKategori = db.prepare("INSERT INTO kategori (nama, urutan) VALUES (?, ?)");
    KATEGORI.forEach((nama, i) => {
      const result = insertKategori.run(nama, i);
      idKategori.set(nama, Number(result.lastInsertRowid));
    });

    const idGrup = new Map<string, number>();
    const insertGrup = db.prepare(
      `INSERT INTO addon_grup (nama, min_pilih, max_pilih, wajib, urutan) VALUES (?, ?, ?, ?, ?)`,
    );
    GRUP.forEach((grup, i) => {
      const result = insertGrup.run(grup.nama, grup.min, grup.max, grup.wajib, i);
      idGrup.set(grup.nama, Number(result.lastInsertRowid));
    });

    const insertAddon = db.prepare(
      `INSERT INTO addon (grup_id, nama, harga, urutan) VALUES (?, ?, ?, ?)`,
    );
    const urutanAddon = new Map<string, number>();
    ADDON.forEach((item) => {
      const grupId = idGrup.get(item.grup);
      if (grupId === undefined) return;
      const urutan = urutanAddon.get(item.grup) ?? 0;
      insertAddon.run(grupId, item.nama, item.harga, urutan);
      urutanAddon.set(item.grup, urutan + 1);
    });

    const insertMenu = db.prepare(
      `INSERT INTO menu_item (kategori_id, nama, harga, foto_path, habis, urutan)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const insertMenuAddon = db.prepare(
      `INSERT INTO menu_addon (menu_item_id, grup_id, urutan) VALUES (?, ?, ?)`,
    );

    MENU.forEach((item, i) => {
      const kategoriId = idKategori.get(item.kategori);
      if (kategoriId === undefined) return;
      const result = insertMenu.run(
        kategoriId,
        item.nama,
        item.harga,
        item.foto ? `/uploads/${item.foto}` : null,
        item.habis ? 1 : 0,
        i,
      );
      const menuId = Number(result.lastInsertRowid);
      item.grup.forEach((namaGrup, urutan) => {
        const grupId = idGrup.get(namaGrup);
        if (grupId !== undefined) insertMenuAddon.run(menuId, grupId, urutan);
      });
    });

    const insertMeja = db.prepare("INSERT INTO meja (nomor, token) VALUES (?, ?)");
    for (let nomor = 1; nomor <= 12; nomor += 1) {
      insertMeja.run(nomor, randomBytes(12).toString("hex"));
    }

    db.prepare("INSERT INTO pengaturan (key, value) VALUES ('versi_demo', '1')").run();
  });

  tanam();
  return true;
}
