import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { config } from "./config.js";

export function hashSecret(secret: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(secret, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifySecret(secret: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [salt, hex] = stored.split(":");
  if (!salt || !hex) return false;
  const expected = Buffer.from(hex, "hex");
  if (expected.length === 0) return false;
  const actual = scryptSync(secret, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export type Peran = "owner" | "kasir";

export interface SessionPayload {
  sub: number;
  nama: string;
  peran: Peran;
  exp: number;
}

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export function signSession(input: Omit<SessionPayload, "exp">): string {
  const payload: SessionPayload = { ...input, exp: Date.now() + SESSION_TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", config.sessionSecret)
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

export function verifySession(token: string): SessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = createHmac("sha256", config.sessionSecret)
    .update(body)
    .digest("base64url");
  const received = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (received.length !== wanted.length || !timingSafeEqual(received, wanted)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (payload.peran !== "owner" && payload.peran !== "kasir") return null;
    if (typeof payload.sub !== "number" || typeof payload.nama !== "string") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
