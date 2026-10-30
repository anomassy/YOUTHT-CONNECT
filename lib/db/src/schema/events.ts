import { table, serial, text, timestamp, integer } from "./dialect";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventsTable = table("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").default(""),
  location: text("location").default(""),
  startsAt: timestamp("starts_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const eventRsvpsTable = table("event_rsvps", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
export type EventRsvp = typeof eventRsvpsTable.$inferSelect;
