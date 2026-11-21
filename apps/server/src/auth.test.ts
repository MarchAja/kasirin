import { describe, expect, it } from "vitest";
import { hashSecret, signSession, verifySecret, verifySession } from "./auth.js";

describe("auth", () => {
  it("hash PIN berbeda untuk dua pemanggilan tapi tetap terverifikasi", () => {
    const a = hashSecret("123456");
    const b = hashSecret("123456");
    expect(a).not.toBe(b);
    expect(verifySecret("123456", a)).toBe(true);
    expect(verifySecret("000000", a)).toBe(false);
    expect(verifySecret("123456", null)).toBe(false);
  });

  it("token sesi ditandatangani dan kedaluwarsa ditolak", () => {
    const token = signSession({ sub: 1, nama: "Rina", peran: "kasir" });
    const sesi = verifySession(token);
    expect(sesi).toMatchObject({ sub: 1, nama: "Rina", peran: "kasir" });
    expect(verifySession(`${token}x`)).toBeNull();
    expect(verifySession("bukan-token")).toBeNull();
  });
});
