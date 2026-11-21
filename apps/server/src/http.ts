import type { FastifyRequest } from "fastify";
import { verifySession, type SessionPayload } from "./auth.js";

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function sessionOf(request: FastifyRequest): SessionPayload | null {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return verifySession(header.slice(7).trim());
}

export async function requireAuth(request: FastifyRequest): Promise<SessionPayload> {
  const session = sessionOf(request);
  if (!session) throw new HttpError(401, "Sesi tidak valid. Silakan masuk lagi.");
  return session;
}

export async function requireOwner(request: FastifyRequest): Promise<SessionPayload> {
  const session = await requireAuth(request);
  if (session.peran !== "owner") {
    throw new HttpError(403, "Hanya pemilik yang bisa melakukan ini.");
  }
  return session;
}
