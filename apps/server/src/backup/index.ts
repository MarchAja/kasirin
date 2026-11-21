import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import type { Db } from "../db/client.js";

export interface CadanganInfo {
  nama: string;
  ukuran: number;
  dibuat_pada: string;
}

const NAMA_RE = /^kasirin-\d{4}-\d{2}-\d{2}.*\.db$/;
let berjalan: Promise<void> | null = null;

export function daftarCadangan(): CadanganInfo[] {
  if (!fs.existsSync(config.backupDir)) return [];
  return fs
    .readdirSync(config.backupDir)
    .filter((nama) => NAMA_RE.test(nama))
    .map((nama) => {
      const stat = fs.statSync(path.join(config.backupDir, nama));
      return {
        nama,
        ukuran: stat.size,
        dibuat_pada: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.dibuat_pada.localeCompare(a.dibuat_pada));
}

async function jalankan(db: Db): Promise<void> {
  fs.mkdirSync(config.backupDir, { recursive: true });
  const cap = new Date().toISOString().replace(/[:.]/g, "-");
  await db.backup(path.join(config.backupDir, `kasirin-${cap}.db`));
  for (const lama of daftarCadangan().slice(config.backupKeep)) {
    fs.rmSync(path.join(config.backupDir, lama.nama), { force: true });
  }
}

export async function buatCadangan(db: Db): Promise<void> {
  if (berjalan) return berjalan;
  berjalan = jalankan(db).finally(() => {
    berjalan = null;
  });
  return berjalan;
}

export function jadwalkanCadangan(db: Db): () => void {
  if (!config.backupEnabled) return () => {};

  const cek = async () => {
    const hariIni = new Date().toISOString().slice(0, 10);
    const sudahAda = daftarCadangan().some((c) =>
      c.nama.startsWith(`kasirin-${hariIni}`),
    );
    if (sudahAda) return;
    try {
      await buatCadangan(db);
    } catch {
      // Cadangan gagal tidak boleh menghentikan server; dicoba lagi jam berikutnya.
    }
  };

  void cek();
  const timer = setInterval(() => void cek(), 60 * 60 * 1000);
  timer.unref();
  return () => clearInterval(timer);
}
