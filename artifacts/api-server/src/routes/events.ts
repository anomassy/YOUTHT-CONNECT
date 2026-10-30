import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { db, eventsTable, eventRsvpsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../lib/auth";

const router: IRouter = Router();

router.get("/events", requireAuth, async (req: AuthedRequest, res) => {
  const rows = await db
    .select()
    .from(eventsTable)
    .orderBy(asc(eventsTable.startsAt));
  const mine = await db
    .select()
    .from(eventRsvpsTable)
    .where(eq(eventRsvpsTable.userId, req.userId!));
  const rsvpEventIds = new Set<number>(mine.map((r: { eventId: number }) => r.eventId));
  return res.json({
    events: rows.map((e: { id: number; [key: string]: unknown }) => ({
      ...e,
      isRsvped: rsvpEventIds.has(e.id),
    })),
  });
});

router.post("/events", requireAuth, async (req, res) => {
  const { title, description, location, startsAt } = req.body ?? {};
  if (!title || !startsAt) {
    return res.status(400).json({ error: "Title and start date are required." });
  }
  const [row] = await db
    .insert(eventsTable)
    .values({
      title,
      description: description ?? "",
      location: location ?? "",
      startsAt: new Date(startsAt),
    })
    .returning();
  return res.status(201).json({ event: row });
});

router.post("/events/:id/rsvp", requireAuth, async (req: AuthedRequest, res) => {
  const eventId = Number(req.params.id);
  const existing = await db
    .select()
    .from(eventRsvpsTable)
    .where(eq(eventRsvpsTable.eventId, eventId));
  const already = existing.find((r: { userId: number | undefined; id: number }) => r.userId === req.userId);
  if (already) {
    await db.delete(eventRsvpsTable).where(eq(eventRsvpsTable.id, already.id));
    return res.json({ isRsvped: false });
  }
  await db.insert(eventRsvpsTable).values({ eventId, userId: req.userId! });
  return res.json({ isRsvped: true });
});

export default router;
