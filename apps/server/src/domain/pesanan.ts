import type { Db } from "../db/client.js";
import type { StatusPesanan } from "./types.js";

export interface AddonSnapshotData {
  addon_id: number;
  nama: string;
  harga: number;
  grup: string;
}
export interface ItemPesananData {
  id: number;
  nama: string;
  harga_satuan: number;
  jumlah: number;
  catatan: string | null;
  addons: AddonSnapshotData[];
  status: StatusPesanan;
}
export interface PesananData {
  id: number;
  status: StatusPesanan;
  dibuat_pada: string;
  items: ItemPesananData[];
}

interface PesananRow { id: number; status: StatusPesanan; dibuat_pada: string }
interface ItemRow {
  id: number;
  nama_snapshot: string;
  harga_snapshot: number;
  jumlah: number;
  catatan: string | null;
  status: StatusPesanan;
}
interface AddonRow {
  addon_id: number;
  nama_snapshot: string;
  harga_snapshot: number;
  grup_snapshot: string;
}

/** Merakit pesanan (+ item + snapshot addon) dari baris basis data. */
export function rakitPesanan(db: Db, rows: PesananRow[]): PesananData[] {
  const itemStmt = db.prepare(
    `SELECT id, nama_snapshot, harga_snapshot, jumlah, catatan, status
     FROM pesanan_item WHERE pesanan_id = ? ORDER BY id`,
  );
  const addonStmt = db.prepare(
    `SELECT addon_id, nama_snapshot, harga_snapshot, grup_snapshot
     FROM item_addon WHERE pesanan_item_id = ? ORDER BY id`,
  );

  return rows.map((pesanan) => {
    const items = itemStmt.all(pesanan.id) as ItemRow[];
    return {
      id: pesanan.id,
      status: pesanan.status,
      dibuat_pada: pesanan.dibuat_pada,
      items: items.map((item) => ({
        id: item.id,
        nama: item.nama_snapshot,
        harga_satuan: item.harga_snapshot,
        jumlah: item.jumlah,
        catatan: item.catatan,
        status: item.status,
        addons: (addonStmt.all(item.id) as AddonRow[]).map((addon) => ({
          addon_id: addon.addon_id,
          nama: addon.nama_snapshot,
          harga: addon.harga_snapshot,
          grup: addon.grup_snapshot,
        })),
      })),
    };
  });
}

/** Subtotal seluruh item aktif dalam satu kunjungan (addon sudah termasuk). */
export function hitungSubtotal(db: Db, kunjunganId: number): number {
  const rows = db
    .prepare(
      `SELECT pi.harga_snapshot, pi.jumlah,
              COALESCE((
                SELECT SUM(ia.harga_snapshot)
                FROM item_addon ia WHERE ia.pesanan_item_id = pi.id
              ), 0) AS tambahan
       FROM pesanan_item pi
       JOIN pesanan p ON p.id = pi.pesanan_id
       WHERE p.kunjungan_id = ?
         AND p.status != 'dibatalkan'
         AND pi.status != 'dibatalkan'`,
    )
    .all(kunjunganId) as Array<{
    harga_snapshot: number;
    jumlah: number;
    tambahan: number;
  }>;
  return rows.reduce(
    (total, row) => total + (row.harga_snapshot + row.tambahan) * row.jumlah,
    0,
  );
}

/** Menyesuaikan subtotal/total tagihan setelah ada pesanan baru. */
export function sinkronisasiTagihan(db: Db, kunjunganId: number): void {
  const tagihan = db
    .prepare("SELECT id, diskon, pajak, service FROM tagihan WHERE kunjungan_id = ?")
    .get(kunjunganId) as
    | { id: number; diskon: number; pajak: number; service: number }
    | undefined;
  if (!tagihan) return;

  const subtotal = hitungSubtotal(db, kunjunganId);
  const total = Math.max(
    0,
    subtotal - tagihan.diskon + tagihan.pajak + tagihan.service,
  );
  db.prepare("UPDATE tagihan SET subtotal = ?, total = ? WHERE id = ?").run(
    subtotal,
    total,
    tagihan.id,
  );
}

export function pastikanTagihan(db: Db, kunjunganId: number): number {
  const ada = db
    .prepare("SELECT id FROM tagihan WHERE kunjungan_id = ?")
    .get(kunjunganId) as { id: number } | undefined;
  if (ada) {
    sinkronisasiTagihan(db, kunjunganId);
    return ada.id;
  }
  const hasil = db
    .prepare("INSERT INTO tagihan (kunjungan_id, subtotal, total) VALUES (?, 0, 0)")
    .run(kunjunganId);
  sinkronisasiTagihan(db, kunjunganId);
  return Number(hasil.lastInsertRowid);
}
