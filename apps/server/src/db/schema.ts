/** Skema Milestone 1. Migrasi berikutnya ditambahkan sebagai berkas/ID baru. */
export const MIGRATION_ID = "001_init";

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS migrations (
  id          TEXT PRIMARY KEY,
  applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS outlet (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  nama            TEXT NOT NULL,
  alamat          TEXT,
  pajak_persen    REAL NOT NULL DEFAULT 0,
  service_persen  REAL NOT NULL DEFAULT 0,
  mode_bayar      TEXT NOT NULL DEFAULT 'manual'
                  CHECK (mode_bayar IN ('manual','otomatis','keduanya')),
  dibuat_pada     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pengguna (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nama           TEXT NOT NULL,
  peran          TEXT NOT NULL CHECK (peran IN ('owner','kasir')),
  pin_hash       TEXT,
  password_hash  TEXT,
  aktif          INTEGER NOT NULL DEFAULT 1,
  dibuat_pada    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kategori (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  nama    TEXT NOT NULL,
  urutan  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_item (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  kategori_id  INTEGER NOT NULL REFERENCES kategori(id) ON DELETE RESTRICT,
  nama         TEXT NOT NULL,
  harga        INTEGER NOT NULL CHECK (harga >= 0),
  foto_path    TEXT,
  habis        INTEGER NOT NULL DEFAULT 0,
  aktif        INTEGER NOT NULL DEFAULT 1,
  urutan       INTEGER NOT NULL DEFAULT 0,
  dibuat_pada  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_menu_kategori ON menu_item(kategori_id, urutan);

CREATE TABLE IF NOT EXISTS addon_grup (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nama        TEXT NOT NULL,
  min_pilih   INTEGER NOT NULL DEFAULT 0 CHECK (min_pilih >= 0),
  max_pilih   INTEGER NOT NULL DEFAULT 1 CHECK (max_pilih >= 1),
  wajib       INTEGER NOT NULL DEFAULT 0,
  urutan      INTEGER NOT NULL DEFAULT 0,
  CHECK (max_pilih >= min_pilih)
);

CREATE TABLE IF NOT EXISTS addon (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  grup_id  INTEGER NOT NULL REFERENCES addon_grup(id) ON DELETE CASCADE,
  nama     TEXT NOT NULL,
  harga    INTEGER NOT NULL DEFAULT 0 CHECK (harga >= 0),
  habis    INTEGER NOT NULL DEFAULT 0,
  aktif    INTEGER NOT NULL DEFAULT 1,
  urutan   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_addon_grup ON addon(grup_id, urutan);

CREATE TABLE IF NOT EXISTS menu_addon (
  menu_item_id  INTEGER NOT NULL REFERENCES menu_item(id) ON DELETE CASCADE,
  grup_id       INTEGER NOT NULL REFERENCES addon_grup(id) ON DELETE CASCADE,
  urutan        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (menu_item_id, grup_id)
);

CREATE TABLE IF NOT EXISTS meja (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  nomor   INTEGER NOT NULL UNIQUE CHECK (nomor BETWEEN 1 AND 30),
  token   TEXT NOT NULL UNIQUE,
  aktif   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS kunjungan (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  meja_id        INTEGER NOT NULL REFERENCES meja(id) ON DELETE RESTRICT,
  dibuka_pada    TEXT NOT NULL DEFAULT (datetime('now')),
  ditutup_pada   TEXT,
  status         TEXT NOT NULL DEFAULT 'buka'
                 CHECK (status IN ('buka','ditutup'))
);
CREATE INDEX IF NOT EXISTS idx_kunjungan_meja ON kunjungan(meja_id, status);

CREATE TABLE IF NOT EXISTS pesanan (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  kunjungan_id    INTEGER NOT NULL REFERENCES kunjungan(id) ON DELETE RESTRICT,
  status          TEXT NOT NULL DEFAULT 'baru'
                  CHECK (status IN ('baru','diterima','disajikan','ditutup','dibatalkan')),
  dibuat_pada     TEXT NOT NULL DEFAULT (datetime('now')),
  diterima_oleh   INTEGER REFERENCES pengguna(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_pesanan_status ON pesanan(status, dibuat_pada);

CREATE TABLE IF NOT EXISTS pesanan_item (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  pesanan_id      INTEGER NOT NULL REFERENCES pesanan(id) ON DELETE CASCADE,
  menu_item_id    INTEGER NOT NULL REFERENCES menu_item(id) ON DELETE RESTRICT,
  nama_snapshot   TEXT NOT NULL,
  harga_snapshot  INTEGER NOT NULL CHECK (harga_snapshot >= 0),
  jumlah          INTEGER NOT NULL CHECK (jumlah > 0),
  catatan         TEXT,
  status          TEXT NOT NULL DEFAULT 'baru'
                  CHECK (status IN ('baru','diterima','disajikan','dibatalkan')),
  alasan_batal    TEXT
);

CREATE TABLE IF NOT EXISTS item_addon (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  pesanan_item_id  INTEGER NOT NULL REFERENCES pesanan_item(id) ON DELETE CASCADE,
  addon_id         INTEGER NOT NULL REFERENCES addon(id) ON DELETE RESTRICT,
  nama_snapshot    TEXT NOT NULL,
  harga_snapshot   INTEGER NOT NULL CHECK (harga_snapshot >= 0),
  grup_snapshot    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tagihan (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kunjungan_id  INTEGER NOT NULL UNIQUE REFERENCES kunjungan(id) ON DELETE RESTRICT,
  subtotal      INTEGER NOT NULL DEFAULT 0,
  diskon        INTEGER NOT NULL DEFAULT 0,
  pajak         INTEGER NOT NULL DEFAULT 0,
  service       INTEGER NOT NULL DEFAULT 0,
  total         INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'buka'
                CHECK (status IN ('buka','tertunda','lunas','perlu_dicek','ditutup')),
  dibuat_pada   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pembayaran (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  tagihan_id     INTEGER NOT NULL REFERENCES tagihan(id) ON DELETE RESTRICT,
  metode         TEXT NOT NULL CHECK (metode IN ('tunai','qris_manual','qris_otomatis')),
  nominal        INTEGER NOT NULL CHECK (nominal >= 0),
  status         TEXT NOT NULL DEFAULT 'tertunda'
                 CHECK (status IN ('tertunda','lunas','kedaluwarsa','batal')),
  provider_ref   TEXT,
  dibuat_pada    TEXT NOT NULL DEFAULT (datetime('now')),
  final_pada     TEXT
);

CREATE TABLE IF NOT EXISTS pengaturan (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  pengguna_id  INTEGER REFERENCES pengguna(id) ON DELETE SET NULL,
  aksi         TEXT NOT NULL,
  entitas      TEXT NOT NULL,
  entitas_id   INTEGER,
  detail       TEXT,
  waktu        TEXT NOT NULL DEFAULT (datetime('now'))
);
`;
