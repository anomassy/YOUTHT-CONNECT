import { table, serial, text, integer, boolean, timestamp } from "./dialect";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const prayerRequestsTable = table("prayer_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  content: text("content").notNull(),
  isAnonymous: boolean("is_anonymous").default(true).notNull(),
  prayCount: integer("pray_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const prayerPraysTable = table("prayer_prays", {
  id: serial("id").primaryKey(),
  prayerRequestId: integer("prayer_request_id").notNull(),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPrayerRequestSchema = createInsertSchema(prayerRequestsTable).omit({
  id: true,
  prayCount: true,
  createdAt: true,
});
export type InsertPrayerRequest = z.infer<typeof insertPrayerRequestSchema>;
export type PrayerRequest = typeof prayerRequestsTable.$inferSelect;
