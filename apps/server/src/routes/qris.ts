import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { catatAudit } from "../domain/audit.js";
import { detailTagihan } from "../domain/tagihan.js";
import type { Db } from "../db/client.js";
import { HttpError, requireAuth } from "../http.js";
import {
  batalkanQris,
  buatQris,
  infoQris,
  tandaiPerluDicek,
  terapkanHasilCek,
} from "../payment/qris.js";
import { penyediaBayar, type HasilCek } from "../payment/provider.js";
import { kunjunganTerbuka, mejaDariToken } from "./customer.js";

const idParam = z.object({ id: z.coerce.number().int().positive() });

function TagihanRow(db: Db, id: number) {
  return db
    .prepare("SELECT id, kunjungan_id, status FROM tagihan WHERE id = ?")
    .get(id) as { id: number; kunjungan_id: number; status: string } | undefined;
}

function tagihanKunjungan(db: Db, kunjunganId: number) {
  return db
    .prepare(
      "SELECT id, status FROM tagihan WHERE kunjungan_id = ? ORDER BY id DESC LIMIT 1",
    )
    .get(kunjunganId) as { id: number; status: string } | undefined;
}

function hasilDariWebhook(payload: Record<string, unknown>): HasilCek {
  switch (String(payload.transaction_status ?? "")) {
    case "settlement":
    case "capture":
      return { status: "lunas", keterangan: "Pembayaran berhasil (webhook)." };
    case "expire":
      return { status: "kedaluwarsa", keterangan: "QRIS kedaluwarsa (webhook)." };
    case "cancel":
    case "deny":
      return { status: "batal", keterangan: "Pembayaran batal (webhook)." };
    default:
      return { status: "tertunda", keterangan: "Menunggu pembayaran." };
  }
}

export function registerQris(app: FastifyInstance, db: Db): void {
  app.post("/api/tagihan/:id/qris", async (request) => {
    const sesi = await requireAuth(request);
    const { id } = idParam.parse(request.params);
    const qris = await buatQris(db, id, sesi.sub);
    return { tagihan: detailTagihan(db, id), qris };
  });

  app.post("/api/m/:token/qris", async (request) => {
    const { token } = request.params as { token: string };
    const meja = mejaDariToken(db, token);
    const kunjungan = kunjunganTerbuka(db, meja.id);
    if (!kunjungan) throw new HttpError(409, "Belum ada pesanan pada meja ini.");
    const tagihan = tagihanKunjungan(db, kunjungan.id);
    if (!tagihan) throw new HttpError(409, "Belum ada tagihan pada meja ini.");

    const qris = await buatQris(db, tagihan.id, null);
    return { tagihan: detailTagihan(db, tagihan.id), qris };
  });

  app.get("/api/m/:token/qris", async (request) => {
    const { token } = request.params as { token: string };
    const meja = mejaDariToken(db, token);
    const kunjungan = kunjunganTerbuka(db, meja.id);
    if (!kunjungan) return { tagihan: null, qris: null };
    const tagihan = tagihanKunjungan(db, kunjungan.id);
    if (!tagihan) return { tagihan: null, qris: null };
    return {
      tagihan: detailTagihan(db, tagihan.id),
      qris: infoQris(db, tagihan.id),
    };
  });

  app.post("/api/tagihan/:id/cek-status", async (request) => {
    const sesi = await requireAuth(request);
    const { id } = idParam.parse(request.params);
    const tagihan = TagihanRow(db, id);
    if (!tagihan) throw new HttpError(404, "Tagihan tidak ditemukan.");
    if (tagihan.status !== "tertunda" && tagihan.status !== "perlu_dicek") {
      throw new HttpError(409, "Tagihan ini tidak menunggu pembayaran QRIS.");
    }

    const qris = infoQris(db, id);
    if (!qris) throw new HttpError(409, "QRIS tidak ditemukan.");

    try {
      const hasil = await penyediaBayar(db).cek(qris.provider_ref);
      terapkanHasilCek(db, qris.provider_ref, hasil, sesi.sub);
      return {
        tagihan: detailTagihan(db, id),
        status: hasil.status,
        pesan: hasil.keterangan,
      };
    } catch {
      tandaiPerluDicek(db, id);
      return {
        tagihan: detailTagihan(db, id),
        status: "perlu_dicek",
        pesan:
          "Gagal menghubungi penyedia pembayaran. Tagihan ditandai perlu dicek; cek lagi saat koneksi kembali.",
      };
    }
  });

  app.post("/api/tagihan/:id/qris/batal", async (request) => {
    const sesi = await requireAuth(request);
    const { id } = idParam.parse(request.params);
    batalkanQris(db, id, sesi.sub);
    return { tagihan: detailTagihan(db, id) };
  });

  app.post("/api/qris/mock/bayar/:ref", async (request) => {
    await requireAuth(request);
    const { ref } = request.params as { ref: string };
    if (penyediaBayar(db).nama !== "mock") {
      throw new HttpError(403, "Mode simulasi tidak aktif.");
    }
    const pembayaran = db
      .prepare(
        "SELECT id FROM pembayaran WHERE provider_ref = ? AND status = 'tertunda'",
      )
      .get(ref) as { id: number } | undefined;
    if (!pembayaran) throw new HttpError(404, "QRIS tertunda tidak ditemukan.");
    db.prepare(
      "UPDATE pembayaran SET status = 'lunas', final_pada = datetime('now') WHERE id = ?",
    ).run(pembayaran.id);
    return { ok: true };
  });

  app.post("/api/webhook/midtrans", async (request) => {
    const payload = request.body as Record<string, unknown>;
    const penyedia = penyediaBayar(db);
    if (penyedia.nama !== "midtrans" || !penyedia.verifikasiWebhook(payload)) {
      throw new HttpError(401, "Signature webhook tidak valid.");
    }
    const ref = String(payload.order_id ?? "");
    const pembayaran = db
      .prepare("SELECT id FROM pembayaran WHERE provider_ref = ?")
      .get(ref) as { id: number } | undefined;
    if (!pembayaran) throw new HttpError(404, "Pembayaran tidak ditemukan.");
    terapkanHasilCek(db, ref, hasilDariWebhook(payload), null, "webhook");
    catatAudit(db, null, "webhook", "pembayaran", pembayaran.id, ref);
    return { ok: true };
  });
}
