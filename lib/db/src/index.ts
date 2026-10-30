import { drizzle } from "drizzle-orm/node-postgres";
import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const url = process.env.DATABASE_URL;
const isMysql = url.startsWith("mysql://") || url.startsWith("mysql2://");

export const pool: any = isMysql
  ? undefined
  : new Pool({ connectionString: url });

export const mysqlPool: any = isMysql
  ? createPool({ uri: url, waitForConnections: true, connectionLimit: 10 })
  : undefined;

export const db: any = isMysql
  ? (drizzleMysql(mysqlPool, { schema, mode: "default" }) as any)
  : (drizzle(pool, { schema }) as any);

export * from "./schema";
