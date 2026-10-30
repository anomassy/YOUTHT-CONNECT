import { table, serial, text, integer, timestamp } from "./dialect";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// room: "friends" (real usernames, for making friends) or "anonymous" (aliases)
export const chatMessagesTable = table("chat_messages", {
  id: serial("id").primaryKey(),
  room: text("room").notNull(),
  userId: integer("user_id").notNull(),
  displayName: text("display_name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const questionsTable = table("questions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  ticketCode: text("ticket_code").notNull(),
  content: text("content").notNull(),
  answer: text("answer"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  answeredAt: timestamp("answered_at"),
});

export const insertChatMessageSchema = createInsertSchema(chatMessagesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessagesTable.$inferSelect;
export type Question = typeof questionsTable.$inferSelect;
