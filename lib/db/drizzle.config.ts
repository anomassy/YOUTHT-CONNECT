import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

const url = process.env.DATABASE_URL;
const isMysql = url.startsWith("mysql://") || url.startsWith("mysql2://");

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: isMysql ? "mysql" : "postgresql",
  dbCredentials: {
    url,
  },
});
