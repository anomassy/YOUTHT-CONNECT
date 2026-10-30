import { table, serial, text, timestamp } from "./dialect";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const devotionalsTable = table("devotionals", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  scriptureRef: text("scripture_ref").notNull(),
  scriptureText: text("scripture_text").notNull(),
  body: text("body").notNull(),
  publishDate: timestamp("publish_date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDevotionalSchema = createInsertSchema(devotionalsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDevotional = z.infer<typeof insertDevotionalSchema>;
export type Devotional = typeof devotionalsTable.$inferSelect;
