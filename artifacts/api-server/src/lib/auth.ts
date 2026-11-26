import { createPublicKey, type KeyObject } from "node:crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { eq } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";

const JWT_SECRET = process.env.SESSION_SECRET;
const AUTH_PROVIDER = (process.env.AUTH_PROVIDER ?? "local").trim().toLowerCase();
if (!JWT_SECRET) {
  throw new Error("SESSION_SECRET must be set to sign auth tokens.");
}

if (AUTH_PROVIDER !== "local" && AUTH_PROVIDER !== "clerk") {
  throw new Error("AUTH_PROVIDER must be either local or clerk.");
}

const CLERK_CLOCK_SKEW_SECONDS = 60;
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000;

interface ClerkJwk {
  kty: string;
  kid: string;
  n?: string;
  e?: string;
  use?: string;
  alg?: string;
}

interface ClerkIdentity extends JwtPayload {
  sub: string;
  azp?: string;
}

interface ClerkJwks {
  expiresAt: number;
  keys: Map<string, KeyObject>;
}

class ClerkAuthError extends Error {
  constructor(
    message: string,
    readonly statusCode: 401 | 503,
  ) {
    super(message);
  }
}

let clerkJwks: ClerkJwks | undefined;
let clerkJwksRequest: Promise<ClerkJwks> | undefined;

async function loadClerkJwks(forceRefresh = false): Promise<ClerkJwks> {
  if (!forceRefresh && clerkJwks && clerkJwks.expiresAt > Date.now()) {
    return clerkJwks;
  }
  if (clerkJwksRequest) return clerkJwksRequest;

  const jwksUrl = process.env.CLERK_JWKS_URL?.trim();
  if (!jwksUrl) {
    throw new ClerkAuthError(
      "Clerk is not configured. Set CLERK_JWKS_URL.",
      503,
    );
  }

  clerkJwksRequest = (async () => {
    let response: globalThis.Response;
    try {
      response = await fetch(jwksUrl, { signal: AbortSignal.timeout(5000) });
    } catch {
      throw new ClerkAuthError("Could not reach the Clerk signing keys.", 503);
    }
    if (!response.ok) {
      throw new ClerkAuthError("Could not load the Clerk signing keys.", 503);
    }

    let body: { keys?: ClerkJwk[] };
    try {
      body = (await response.json()) as { keys?: ClerkJwk[] };
    } catch {
      throw new ClerkAuthError("Clerk returned invalid signing keys.", 503);
    }
    if (!Array.isArray(body.keys)) {
      throw new ClerkAuthError("Clerk returned invalid signing keys.", 503);
    }

    const keys = new Map<string, KeyObject>();
    for (const key of body.keys) {
      if (
        key.kty === "RSA" &&
        key.kid &&
        key.n &&
        key.e &&
        (!key.use || key.use === "sig") &&
        (!key.alg || key.alg === "RS256")
      ) {
        keys.set(
          key.kid,
          createPublicKey({
            key: { kty: "RSA", n: key.n, e: key.e },
            format: "jwk",
          }),
        );
      }
    }
    if (keys.size === 0) {
      throw new ClerkAuthError("Clerk returned no usable signing keys.", 503);
    }

    const loaded = { keys, expiresAt: Date.now() + JWKS_CACHE_TTL_MS };
    clerkJwks = loaded;
    return loaded;
  })();

  try {
    return await clerkJwksRequest;
  } finally {
    clerkJwksRequest = undefined;
  }
}

async function verifyClerkToken(token: string): Promise<ClerkIdentity> {
  const issuer = process.env.CLERK_ISSUER?.trim();
  const allowedOrigins = (process.env.CLERK_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (!issuer || allowedOrigins.length === 0) {
    throw new ClerkAuthError(
      "Clerk is not fully configured. Set CLERK_ISSUER and CLERK_ALLOWED_ORIGINS.",
      503,
    );
  }

  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || decoded.header.alg !== "RS256" || !decoded.header.kid) {
    throw new ClerkAuthError("Invalid or expired Clerk session.", 401);
  }

  let jwks = await loadClerkJwks();
  let signingKey = jwks.keys.get(decoded.header.kid);
  if (!signingKey) {
    jwks = await loadClerkJwks(true);
    signingKey = jwks.keys.get(decoded.header.kid);
  }
  if (!signingKey) {
    throw new ClerkAuthError("Invalid or expired Clerk session.", 401);
  }

  let claims: string | JwtPayload;
  try {
    claims = jwt.verify(token, signingKey, {
      algorithms: ["RS256"],
      issuer,
      clockTolerance: CLERK_CLOCK_SKEW_SECONDS,
    });
  } catch {
    throw new ClerkAuthError("Invalid or expired Clerk session.", 401);
  }
  if (
    typeof claims === "string" ||
    typeof claims.sub !== "string" ||
    !claims.sub
  ) {
    throw new ClerkAuthError("Clerk session does not identify a user.", 401);
  }
  if (
    typeof claims.azp !== "string" ||
    !allowedOrigins.includes(claims.azp)
  ) {
    throw new ClerkAuthError(
      "Clerk session is not from an allowed application origin.",
      401,
    );
  }
  return claims as ClerkIdentity;
}

export interface AuthTokenPayload {
  userId: number;
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: "30d" });
}

export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET as string) as AuthTokenPayload;
  } catch {
    return null;
  }
}

export interface AuthedRequest extends Request {
  userId?: number;
  clerkId?: string;
}

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

function sendClerkError(res: Response, error: unknown): void {
  if (error instanceof ClerkAuthError) {
    res.status(error.statusCode).json({ detail: error.message });
    return;
  }
  res.status(503).json({ detail: "Could not verify the Clerk session." });
}

export async function requireClerkIdentity(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (AUTH_PROVIDER !== "clerk") {
    res.status(404).json({ detail: "Clerk authentication is not enabled." });
    return;
  }
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ detail: "Missing authorization token." });
    return;
  }
  try {
    const identity = await verifyClerkToken(token);
    req.clerkId = identity.sub;
    next();
  } catch (error) {
    sendClerkError(res, error);
  }
}

export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ detail: "Missing authorization token" });
    return;
  }

  const payload = verifyToken(token);
  if (payload) {
    req.userId = payload.userId;
    next();
    return;
  }
  if (AUTH_PROVIDER !== "clerk") {
    res.status(401).json({ detail: "Invalid or expired token" });
    return;
  }

  try {
    const identity = await verifyClerkToken(token);
    const [user] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.clerkId, identity.sub))
      .limit(1);
    if (!user) {
      res.status(403).json({
        detail:
          "Your Clerk account is not linked yet. Complete account setup or contact the administrator.",
      });
      return;
    }
    req.userId = user.id;
    next();
  } catch (error) {
    sendClerkError(res, error);
  }
}
