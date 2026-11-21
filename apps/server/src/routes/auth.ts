import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { signSession, verifySecret } from "../auth.js";
import type { Db } from "../db/client.js";
import { HttpError, requireAuth } from "../http.js";

interface PenggunaRow {
  id: number;
  nama: string;
  peran: "owner" | "kasir";
  pin_hash: string | null;
  password_hash: string | null;
}

const loginSchema = z
  .object({
    pin: z.string().regex(/^\d{4,6}$/).optional(),
    password: z.string().min(1).max(200).optional(),
  })
  .refine((value) => Boolean(value.pin) !== Boolean(value.password), {
    message: "Isi PIN atau kata sandi, bukan keduanya.",
  });

function buatSesi(user: PenggunaRow) {
  const pengguna = { id: user.id, nama: user.nama, peran: user.peran };
  const token = signSession({
    sub: user.id,
    nama: user.nama,
    peran: user.peran,
  });
  return { token, pengguna };
}

export function registerAuth(app: FastifyInstance, db: Db): void {
  app.post("/api/auth/login", async (request) => {
    const input = loginSchema.parse(request.body);

    const pin = input.pin;
    if (pin !== undefined) {
      const kasir = db
        .prepare("SELECT * FROM pengguna WHERE peran = 'kasir' AND aktif = 1")
        .all() as PenggunaRow[];
      const user = kasir.find((kandidat) => verifySecret(pin, kandidat.pin_hash));
      if (!user) throw new HttpError(401, "PIN tidak benar.");
      return buatSesi(user);
    }

    const owner = db
      .prepare("SELECT * FROM pengguna WHERE peran = 'owner' AND aktif = 1 LIMIT 1")
      .get() as PenggunaRow | undefined;
    if (!owner || !verifySecret(input.password ?? "", owner.password_hash)) {
      throw new HttpError(401, "Kata sandi tidak benar.");
    }
    return buatSesi(owner);
  });

  app.get("/api/auth/me", async (request) => {
    const sesi = await requireAuth(request);
    return {
      pengguna: { id: sesi.sub, nama: sesi.nama, peran: sesi.peran },
    };
  });
}
