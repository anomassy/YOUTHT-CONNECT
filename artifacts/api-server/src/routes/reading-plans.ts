import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  readingPlansTable,
  readingPlanDaysTable,
  readingProgressTable,
} from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../lib/auth";

const router: IRouter = Router();

router.get("/reading-plans", requireAuth, async (_req, res) => {
  const plans = await db.select().from(readingPlansTable);
  const days = await db.select().from(readingPlanDaysTable);
  return res.json({
    plans: plans.map((p: { id: number; [key: string]: unknown }) => ({
      ...p,
      days: days
        .filter((d: { planId: number; dayNumber: number }) => d.planId === p.id)
        .sort((a: { dayNumber: number }, b: { dayNumber: number }) => a.dayNumber - b.dayNumber),
    })),
  });
});

router.get("/reading-plans/progress", requireAuth, async (req: AuthedRequest, res) => {
  const rows = await db
    .select()
    .from(readingProgressTable)
    .where(eq(readingProgressTable.userId, req.userId!));
  return res.json({ progress: rows });
});

router.post("/reading-plans/days/:dayId/complete", requireAuth, async (req: AuthedRequest, res) => {
  const planDayId = Number(req.params.dayId);
  const existing = await db
    .select()
    .from(readingProgressTable)
    .where(
      and(
        eq(readingProgressTable.userId, req.userId!),
        eq(readingProgressTable.planDayId, planDayId),
      ),
    )
    .limit(1);
  if (existing.length > 0) {
    return res.json({ progress: existing[0] });
  }
  const [row] = await db
    .insert(readingProgressTable)
    .values({ userId: req.userId!, planDayId })
    .returning();
  return res.status(201).json({ progress: row });
});

export default router;
