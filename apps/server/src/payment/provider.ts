import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import type { Db } from "../db/client.js";

export type NamaProvider = "mock" | "midtrans";
export type StatusProvider = "lunas" | "tertunda" | "batal" | "kedaluwarsa";

export interface HasilBuat {
  provider: NamaProvider;
  provider_ref: string;
  qr_data: string;
  expired_at: string | null;
}
export interface HasilCek {
  status: StatusProvider;
  keterangan: string;
}
export interface PenyediaBayar {
  nama: NamaProvider;
  buat(tagihanId: number, amount: number): Promise<HasilBuat>;
  cek(providerRef: string): Promise<HasilCek>;
  verifikasiWebhook(payload: Record<string, unknown>): boolean;
}

function penyediaMock(db: Db): PenyediaBayar {
  return {
    nama: "mock",
    async buat(tagihanId, amount) {
      const ref = `mock-${tagihanId}-${randomBytes(4).toString("hex")}`;
      const qr_data = `000201010211KASIRIN|${tagihanId}|${amount}|${ref}5204000053033605802ID6304A1B2`;
      return {
        provider: "mock",
        provider_ref: ref,
        qr_data,
        expired_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      };
    },
    async cek(providerRef) {
      const row = db
        .prepare("SELECT status FROM pembayaran WHERE provider_ref = ?")
        .get(providerRef) as { status: string } | undefined;
      if (row?.status === "lunas") {
        return { status: "lunas", keterangan: "Pembayaran simulasi diterima." };
      }
      return { status: "tertunda", keterangan: "Menunggu pembayaran (simulasi)." };
    },
    verifikasiWebhook: () => true,
  };
}

function penyediaMidtrans(): PenyediaBayar {
  const base = config.midtransProduction
    ? "https://api.midtrans.com"
    : "https://api.sandbox.midtrans.com";
  const authorization = `Basic ${Buffer.from(`${config.midtransServerKey}:`).toString("base64")}`;

  return {
    nama: "midtrans",
    async buat(tagihanId, amount) {
      const provider_ref = `kasirin-${tagihanId}-${Date.now()}`;
      const response = await fetch(`${base}/v2/charge`, {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payment_type: "qris",
          transaction_details: {
            order_id: provider_ref,
            gross_amount: amount,
          },
          qris: { enable_callback: false },
        }),
      });
      if (!response.ok) {
        throw new Error(`Midtrans menolak permintaan (${response.status}).`);
      }
      const data = (await response.json()) as {
        actions?: Array<{ name?: string; url?: string }>;
        expiry_time?: string;
      };
      const qr = data.actions?.find((a) => a.name === "qr_code_url");
      if (!qr?.url) throw new Error("Midtrans tidak mengembalikan QRIS.");
      return {
        provider: "midtrans",
        provider_ref,
        qr_data: qr.url,
        expired_at: data.expiry_time ?? null,
      };
    },
    async cek(providerRef) {
      const response = await fetch(
        `${base}/v2/${encodeURIComponent(providerRef)}/status`,
        { headers: { Authorization: authorization } },
      );
      if (!response.ok) {
        throw new Error(`Gagal menanyakan status ke Midtrans (${response.status}).`);
      }
      const data = (await response.json()) as { transaction_status?: string };
      switch (data.transaction_status) {
        case "settlement":
        case "capture":
          return { status: "lunas", keterangan: "Pembayaran berhasil." };
        case "expire":
          return { status: "kedaluwarsa", keterangan: "QRIS kedaluwarsa." };
        case "cancel":
        case "deny":
          return { status: "batal", keterangan: "Pembayaran dibatalkan." };
        default:
          return { status: "tertunda", keterangan: "Menunggu pembayaran." };
      }
    },
    verifikasiWebhook(payload) {
      const orderId = String(payload.order_id ?? "");
      const statusCode = String(payload.status_code ?? "");
      const grossAmount = String(payload.gross_amount ?? "");
      const diterima = String(payload.signature_key ?? "").toLowerCase();
      const diharapkan = createHash("sha512")
        .update(orderId + statusCode + grossAmount + config.midtransServerKey)
        .digest("hex");
      return (
        diterima.length === diharapkan.length &&
        timingSafeEqual(Buffer.from(diterima), Buffer.from(diharapkan))
      );
    },
  };
}

export function penyediaBayar(db: Db): PenyediaBayar {
  return config.midtransServerKey ? penyediaMidtrans() : penyediaMock(db);
}
