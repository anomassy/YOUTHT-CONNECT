import { Router, type IRouter } from "express";
import { desc, eq, and, sql } from "drizzle-orm";
import {
  db,
  prayerRequestsTable,
  prayerPraysTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../lib/auth";

const router: IRouter = Router();

router.get("/prayers", requireAuth, async (req: AuthedRequest, res) => {
  const rows = await db
    .select({
      id: prayerRequestsTable.id,
      userId: prayerRequestsTable.userId,
      content: prayerRequestsTable.content,
      isAnonymous: prayerRequestsTable.isAnonymous,
      prayCount: prayerRequestsTable.prayCount,
      createdAt: prayerRequestsTable.createdAt,
      firstName: usersTable.firstName,
      username: usersTable.username,
    })
    .from(prayerRequestsTable)
    .leftJoin(usersTable, eq(prayerRequestsTable.userId, usersTable.id))
    .orderBy(desc(prayerRequestsTable.createdAt));

  const mine = await db
    .select()
    .from(prayerPraysTable)
    .where(eq(prayerPraysTable.userId, req.userId!));
  const prayedIds = new Set<number>(mine.map((m: { prayerRequestId: number }) => m.prayerRequestId));

  return res.json({
    prayers: rows.map((r: {
      id: number;
      userId: number;
      content: string;
      isAnonymous: boolean;
      prayCount: number;
      createdAt: Date;
      firstName: string | null;
      username: string | null;
    }) => ({
      id: r.id,
      content: r.content,
      isAnonymous: r.isAnonymous,
      prayCount: r.prayCount,
      createdAt: r.createdAt,
      author: r.isAnonymous ? null : r.firstName ?? r.username,
      isOwn: r.userId === req.userId,
      hasPrayed: prayedIds.has(r.id),
    })),
  });
});

router.post("/prayers", requireAuth, async (req: AuthedRequest, res) => {
  const { content, isAnonymous } = req.body ?? {};
  if (!content || typeof content !== "string" || !content.trim()) {
    return res.status(400).json({ error: "Prayer request content is required." });
  }
  const [row] = await db
    .insert(prayerRequestsTable)
    .values({
      userId: req.userId!,
      content: content.trim(),
      isAnonymous: isAnonymous !== false,
    })
    .returning();
  return res.status(201).json({ prayer: row });
});

router.post("/prayers/:id/pray", requireAuth, async (req: AuthedRequest, res) => {
  const prayerRequestId = Number(req.params.id);
  const existing = await db
    .select()
    .from(prayerPraysTable)
    .where(
      and(
        eq(prayerPraysTable.prayerRequestId, prayerRequestId),
        eq(prayerPraysTable.userId, req.userId!),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .delete(prayerPraysTable)
      .where(eq(prayerPraysTable.id, existing[0].id));
    await db
      .update(prayerRequestsTable)
      .set({ prayCount: sql`greatest(${prayerRequestsTable.prayCount} - 1, 0)` })
      .where(eq(prayerRequestsTable.id, prayerRequestId));
    return res.json({ hasPrayed: false });
  }

  await db
    .insert(prayerPraysTable)
    .values({ prayerRequestId, userId: req.userId! });
  await db
    .update(prayerRequestsTable)
    .set({ prayCount: sql`${prayerRequestsTable.prayCount} + 1` })
    .where(eq(prayerRequestsTable.id, prayerRequestId));
  return res.json({ hasPrayed: true });
});

export default router;
