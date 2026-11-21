import type { Db } from "../db/client.js";
import { rakitPesanan } from "./pesanan.js";

interface TagihanRow {
  id: number;
  kunjungan_id: number;
  meja_id: number;
  meja_nomor: number;
  subtotal: number;
  diskon: number;
  alasan_diskon: string | null;
  pajak: number;
  service: number;
  total: number;
  status: string;
  dibuat_pada: string;
}

export function detailTagihan(db: Db, id: number) {
  const tagihan = db
    .prepare(
      `SELECT t.*, k.meja_id, m.nomor AS meja_nomor
       FROM tagihan t
       JOIN kunjungan k ON k.id = t.kunjungan_id
       JOIN meja m ON m.id = k.meja_id
       WHERE t.id = ?`,
    )
    .get(id) as TagihanRow | undefined;
  if (!tagihan) return null;

  const pesanan = db
    .prepare(
      "SELECT id, status, dibuat_pada FROM pesanan WHERE kunjungan_id = ? ORDER BY id",
    )
    .all(tagihan.kunjungan_id) as Array<{
    id: number;
    status: "baru" | "diterima" | "disajikan" | "ditutup" | "dibatalkan";
    dibuat_pada: string;
  }>;

  const pembayaran = db
    .prepare(
      `SELECT id, metode, nominal, status, dibuat_pada, final_pada
       FROM pembayaran WHERE tagihan_id = ? ORDER BY id`,
    )
    .all(id) as Array<{
    id: number;
    metode: string;
    nominal: number;
    status: string;
    dibuat_pada: string;
    final_pada: string | null;
  }>;

  return {
    id: tagihan.id,
    kunjungan_id: tagihan.kunjungan_id,
    meja_id: tagihan.meja_id,
    meja_nomor: tagihan.meja_nomor,
    subtotal: tagihan.subtotal,
    diskon: tagihan.diskon,
    alasan_diskon: tagihan.alasan_diskon,
    pajak: tagihan.pajak,
    service: tagihan.service,
    total: tagihan.total,
    status: tagihan.status,
    dibuat_pada: tagihan.dibuat_pada,
    items: rakitPesanan(db, pesanan).flatMap((p) => p.items),
    pembayaran,
  };
}

export function tagihanMeja(db: Db, mejaId: number) {
  const tagihan = db
    .prepare(
      `SELECT t.id FROM tagihan t
       JOIN kunjungan k ON k.id = t.kunjungan_id
       WHERE k.meja_id = ? AND k.status = 'buka' ORDER BY t.id DESC LIMIT 1`,
    )
    .get(mejaId) as { id: number } | undefined;
  return tagihan ? detailTagihan(db, tagihan.id) : null;
}

export function ringkasanHarian(db: Db) {
  const perMetode = db
    .prepare(
      `SELECT metode, COUNT(*) AS jumlah, SUM(nominal) AS total
       FROM pembayaran
       WHERE status = 'lunas'
         AND date(final_pada, 'localtime') = date('now', 'localtime')
       GROUP BY metode ORDER BY metode`,
    )
    .all() as Array<{ metode: string; jumlah: number; total: number }>;

  const transaksi = db
    .prepare(
      `SELECT COUNT(DISTINCT tagihan_id) AS n
       FROM pembayaran
       WHERE status = 'lunas'
         AND date(final_pada, 'localtime') = date('now', 'localtime')`,
    )
    .get() as { n: number };

  const terbuka = db
    .prepare(
      "SELECT COUNT(*) AS n FROM tagihan WHERE status IN ('buka', 'tertunda')",
    )
    .get() as { n: number };

  const dicek = db
    .prepare("SELECT COUNT(*) AS n FROM tagihan WHERE status = 'perlu_dicek'")
    .get() as { n: number };

  const diskon = db
    .prepare(
      `SELECT t.id AS tagihan_id, m.nomor AS meja_nomor, t.diskon AS nominal,
              t.alasan_diskon AS alasan
       FROM tagihan t
       JOIN kunjungan k ON k.id = t.kunjungan_id
       JOIN meja m ON m.id = k.meja_id
       WHERE t.diskon > 0
         AND date(t.dibuat_pada, 'localtime') = date('now', 'localtime')
       ORDER BY t.id`,
    )
    .all() as Array<{
    tagihan_id: number;
    meja_nomor: number;
    nominal: number;
    alasan: string;
  }>;

  return {
    tanggal: (db.prepare("SELECT date('now','localtime') AS tanggal").get() as {
      tanggal: string;
    }).tanggal,
    total_diterima: perMetode.reduce((n, m) => n + m.total, 0),
    per_metode: perMetode,
    jumlah_transaksi: transaksi.n,
    tagihan_terbuka: terbuka.n,
    perlu_dicek: dicek.n,
    diskon,
  };
}
