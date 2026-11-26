import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq, or } from "drizzle-orm";
import { db, usersTable, type PublicUser } from "@workspace/db";
import {
  signToken,
  requireAuth,
  requireClerkIdentity,
  type AuthedRequest,
} from "../lib/auth";

const router: IRouter = Router();

function toPublicUser(u: typeof usersTable.$inferSelect): PublicUser {
  const { passwordHash, clerkId, ...rest } = u;
  return rest;
}

router.post("/auth/register", async (req, res) => {
  try {
    const { firstName, lastName, username, email, password } = req.body ?? {};
    if (!firstName || !lastName || !username || !email || !password) {
      return res.status(400).json({ error: "All fields are required." });
    }
    if (typeof password !== "string" || password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedUsername = String(username).trim().toLowerCase();

    const existing = await db
      .select()
      .from(usersTable)
      .where(
        or(
          eq(usersTable.email, normalizedEmail),
          eq(usersTable.username, normalizedUsername),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return res
        .status(409)
        .json({ error: "An account with that email or username already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db
      .insert(usersTable)
      .values({
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        username: normalizedUsername,
        email: normalizedEmail,
        passwordHash,
      })
      .returning();

    const token = signToken({ userId: user.id });
    return res.status(201).json({ token, user: toPublicUser(user) });
  } catch (err) {
    req.log?.error(err);
    return res.status(500).json({ error: "Registration failed." });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { identifier, password } = req.body ?? {};
    if (!identifier || !password) {
      return res
        .status(400)
        .json({ error: "Email/username and password are required." });
    }
    const normalized = String(identifier).trim().toLowerCase();

    const [user] = await db
      .select()
      .from(usersTable)
      .where(
        or(
          eq(usersTable.email, normalized),
          eq(usersTable.username, normalized),
        ),
      )
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const token = signToken({ userId: user.id });
    return res.json({ token, user: toPublicUser(user) });
  } catch (err) {
    req.log?.error(err);
    return res.status(500).json({ error: "Login failed." });
  }
});

router.post(
  "/auth/clerk-sync",
  requireClerkIdentity,
  async (req: AuthedRequest, res) => {
    const { firstName, lastName, username, email } = req.body ?? {};
    if (
      typeof username !== "string" ||
      typeof email !== "string" ||
      !req.clerkId
    ) {
      return res.status(400).json({
        detail: "Clerk profile must include a username and email.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();
    if (!normalizedEmail || !normalizedUsername) {
      return res.status(400).json({
        detail: "Clerk profile must include a username and email.",
      });
    }

    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, req.clerkId))
      .limit(1);
    if (existing) {
      return res.json({ user: toPublicUser(existing) });
    }

    const [conflict] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(
        or(
          eq(usersTable.email, normalizedEmail),
          eq(usersTable.username, normalizedUsername),
        ),
      )
      .limit(1);
    if (conflict) {
      return res.status(409).json({
        detail:
          "An existing account has this email or username. Ask an administrator to verify and link the existing local account.",
      });
    }

    const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
    await db
      .insert(usersTable)
      .values({
        firstName: typeof firstName === "string" ? firstName.trim() : "",
        lastName: typeof lastName === "string" ? lastName.trim() : "",
        username: normalizedUsername,
        email: normalizedEmail,
        passwordHash,
        clerkId: req.clerkId,
      });
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, req.clerkId))
      .limit(1);
    if (!user) {
      return res.status(500).json({
        detail: "The Clerk profile was created but could not be loaded.",
      });
    }

    return res.status(201).json({ user: toPublicUser(user) });
  },
);

router.get("/auth/me", requireAuth, async (req: AuthedRequest, res) => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);
  if (!user) return res.status(404).json({ error: "User not found." });
  return res.json({ user: toPublicUser(user) });
});

router.patch("/auth/me", requireAuth, async (req: AuthedRequest, res) => {
  const { firstName, lastName, bio } = req.body ?? {};
  await db
    .update(usersTable)
    .set({
      ...(firstName ? { firstName: String(firstName).trim() } : {}),
      ...(lastName ? { lastName: String(lastName).trim() } : {}),
      ...(bio !== undefined ? { bio: String(bio) } : {}),
    })
    .where(eq(usersTable.id, req.userId!));
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);
  if (!user) return res.status(404).json({ error: "User not found." });
  return res.json({ user: toPublicUser(user) });
});

export default router;
