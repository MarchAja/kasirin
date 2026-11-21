import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Akar repo, stabil baik saat dijalankan dari src/ maupun dist/. */
export const ROOT_DIR = path.resolve(here, "../../..");

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return !["0", "false", "no", "off"].includes(raw.toLowerCase());
}

export const config = {
  versi: "0.1.0",
  host: process.env.HOST ?? "0.0.0.0",
  port: intEnv("PORT", 3000),
  dataDir: path.resolve(ROOT_DIR, process.env.KASIRIN_DATA_DIR ?? "data"),
  demo: boolEnv("KASIRIN_DEMO", true),
  ownerPassword: process.env.KASIRIN_OWNER_PASSWORD ?? "owner123",
  ownerPin: process.env.KASIRIN_OWNER_PIN ?? "246810",
  kasirPin: process.env.KASIRIN_KASIR_PIN ?? "123456",
  sessionSecret:
    process.env.KASIRIN_SESSION_SECRET ?? "kasirin-dev-secret-ganti-di-produksi",
  midtransServerKey: process.env.MIDTRANS_SERVER_KEY ?? "",
  midtransClientKey: process.env.MIDTRANS_CLIENT_KEY ?? "",
  midtransProduction: boolEnv("MIDTRANS_IS_PRODUCTION", false),
  backupEnabled: boolEnv("KASIRIN_BACKUP_ENABLED", true),
  backupDir: path.resolve(
    ROOT_DIR,
    process.env.KASIRIN_BACKUP_DIR || path.join(configDataDir(), "backups"),
  ),
  backupKeep: intEnv("KASIRIN_BACKUP_KEEP", 7),
} as const;

function configDataDir(): string {
  return process.env.KASIRIN_DATA_DIR ?? "data";
}

export const dataFile = path.join(config.dataDir, "kasirin.db");
export const uploadDir = path.join(config.dataDir, "uploads");
export const webDistDir = path.join(ROOT_DIR, "apps", "web", "dist");
