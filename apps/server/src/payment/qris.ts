import { catatAudit } from "../domain/audit.js";
import type { Db } from "../db/client.js";
import { HttpError } from "../http.js";
import { penyediaBayar, type HasilCek, type HasilBuat, type NamaProvider } from "./provider.js";

export interface QrisInfo {
  qr_data: string;
  provider: NamaProvider;
  provider_ref: string;
  expired_at: string | null;
  amount: number;
}

function sekarang(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

export function infoQris(db: Db, tagihanId: number): QrisInfo | null {
  const row = db
    .prepare(
      `SELECT provider, provider_ref, qr_data, expired_at, nominal
       FROM pembayaran
       WHERE tagihan_id = ? AND metode = 'qris_otomatis'
       ORDER BY id DESC LIMIT 1`,
    )
    .get(tagihanId) as {
    provider: string | null;
    provider_ref: string | null;
    qr_data: string | null;
    expired_at: string | null;
    nominal: number;
  } | undefined;
  if (!row) return null;
  return {
    qr_data: row.qr_data ?? "",
    provider: row.provider === "midtrans" ? "midtrans" : "mock",
    provider_ref: row.provider_ref ?? "",
    expired_at: row.expired_at,
    amount: row.nominal,
  };
}

export async function buatQris(
  db: Db,
  tagihanId: number,
  penggunaId: number | null,
): Promise<QrisInfo> {
  const outlet = db
    .prepare("SELECT mode_bayar FROM outlet WHERE id = 1")
    .get() as { mode_bayar: string } | undefined;
  if (outlet?.mode_bayar === "manual") {
    throw new HttpError(409, "Mode pembayaran otomatis sedang nonaktif.");
  }

  const tagihan = db
    .prepare("SELECT id, total, status FROM tagihan WHERE id = ?")
    .get(tagihanId) as
    | { id: number; total: number; status: string }
    | undefined;
  if (!tagihan) throw new HttpError(404, "Tagihan tidak ditemukan.");
  if (tagihan.status !== "buka") {
    throw new HttpError(409, "Tagihan tidak dalam keadaan bisa dibayar.");
  }

  const penyedia = penyediaBayar(db);
  const hasil: HasilBuat = await penyedia.buat(tagihan.id, tagihan.total);

  db.transaction(() => {
    db.prepare(
      `INSERT INTO pembayaran
         (tagihan_id, metode, nominal, status, provider, provider_ref,
          qr_data, expired_at, dibuat_pada)
       VALUES (?, 'qris_otomatis', ?, 'tertunda', ?, ?, ?, ?, ?)`,
    ).run(
      tagihan.id,
      tagihan.total,
      hasil.provider,
      hasil.provider_ref,
      hasil.qr_data,
      hasil.expired_at,
      sekarang(),
    );
    db.prepare("UPDATE tagihan SET status = 'tertunda' WHERE id = ?").run(tagihan.id);
    catatAudit(db, penggunaId, "qris_buat", "tagihan", tagihan.id, hasil.provider);
  })();

  return infoQris(db, tagihan.id)!;
}

export function terapkanHasilCek(
  db: Db,
  providerRef: string,
  hasil: HasilCek,
  penggunaId: number | null,
  aksi = "qris_cek",
): void {
  const pembayaran = db
    .prepare(
      `SELECT id, tagihan_id FROM pembayaran
       WHERE provider_ref = ? ORDER BY id DESC LIMIT 1`,
    )
    .get(providerRef) as { id: number; tagihan_id: number } | undefined;
  if (!pembayaran) throw new HttpError(404, "Pembayaran QRIS tidak ditemukan.");

  db.transaction(() => {
    if (hasil.status === "lunas") {
      db.prepare(
        "UPDATE pembayaran SET status = 'lunas', final_pada = ? WHERE id = ?",
      ).run(sekarang(), pembayaran.id);
      db.prepare("UPDATE tagihan SET status = 'lunas' WHERE id = ?").run(
        pembayaran.tagihan_id,
      );
    } else if (hasil.status === "batal" || hasil.status === "kedaluwarsa") {
      db.prepare("UPDATE pembayaran SET status = ? WHERE id = ?").run(
        hasil.status,
        pembayaran.id,
      );
      db.prepare(
        "UPDATE tagihan SET status = 'buka' WHERE id = ? AND status = 'tertunda'",
      ).run(pembayaran.tagihan_id);
    }
    catatAudit(
      db,
      penggunaId,
      aksi,
      "tagihan",
      pembayaran.tagihan_id,
      `${hasil.status} · ${hasil.keterangan}`,
    );
  })();
}

export function tandaiPerluDicek(db: Db, tagihanId: number): void {
  db.prepare("UPDATE tagihan SET status = 'perlu_dicek' WHERE id = ?").run(tagihanId);
}

export function batalkanQris(
  db: Db,
  tagihanId: number,
  penggunaId: number,
): void {
  const pembayaran = db
    .prepare(
      `SELECT id FROM pembayaran
       WHERE tagihan_id = ? AND metode = 'qris_otomatis' AND status = 'tertunda'
       ORDER BY id DESC LIMIT 1`,
    )
    .get(tagihanId) as { id: number } | undefined;
  if (!pembayaran) throw new HttpError(409, "Tidak ada QRIS tertunda.");

  db.transaction(() => {
    db.prepare("UPDATE pembayaran SET status = 'batal' WHERE id = ?").run(
      pembayaran.id,
    );
    db.prepare(
      "UPDATE tagihan SET status = 'buka' WHERE id = ? AND status = 'tertunda'",
    ).run(tagihanId);
    catatAudit(db, penggunaId, "qris_batal", "tagihan", tagihanId, null);
  })();
}
