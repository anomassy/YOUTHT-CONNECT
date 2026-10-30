import { table, serial, text, integer, timestamp, boolean } from "./dialect";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const readingPlansTable = table("reading_plans", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const readingPlanDaysTable = table("reading_plan_days", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull(),
  dayNumber: integer("day_number").notNull(),
  passage: text("passage").notNull(),
  reflection: text("reflection").default(""),
});

export const readingProgressTable = table("reading_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  planDayId: integer("plan_day_id").notNull(),
  completed: boolean("completed").default(true).notNull(),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
});

export const insertReadingPlanSchema = createInsertSchema(readingPlansTable).omit({
  id: true,
  createdAt: true,
});
export type ReadingPlan = typeof readingPlansTable.$inferSelect;
export type ReadingPlanDay = typeof readingPlanDaysTable.$inferSelect;
