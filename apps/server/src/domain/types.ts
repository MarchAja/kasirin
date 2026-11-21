export type StatusPesanan =
  | "baru"
  | "diterima"
  | "disajikan"
  | "ditutup"
  | "dibatalkan";

export type StatusKunjungan = "buka" | "ditutup";

export type StatusMeja =
  | "kosong"
  | "baru"
  | "diterima"
  | "disajikan"
  | "perlu_dicek";

export interface OutletPublik {
  nama: string;
  alamat: string | null;
  mode_bayar: "manual" | "otomatis" | "keduanya";
}
