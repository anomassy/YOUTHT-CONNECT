import {
  boolean as pgBoolean,
  integer as pgInteger,
  pgTable as pgTableFn,
  serial as pgSerial,
  text as pgText,
  timestamp as pgTimestamp,
  varchar as pgVarchar,
} from "drizzle-orm/pg-core";
import {
  boolean as mysqlBoolean,
  int as mysqlInt,
  mysqlTable as mysqlTableFn,
  serial as mysqlSerial,
  text as mysqlText,
  timestamp as mysqlTimestamp,
  varchar as mysqlVarchar,
} from "drizzle-orm/mysql-core";

const getDialect = () => {
  const envDialect = process.env.DB_DIALECT ?? process.env.DATABASE_DIALECT;
  const url = process.env.DATABASE_URL ?? "";

  if (envDialect === "mysql") return "mysql";
  if (envDialect === "postgresql") return "postgresql";
  if (url.startsWith("mysql://") || url.startsWith("mysql2://")) return "mysql";

  return "postgresql";
};

export const isMySql = getDialect() === "mysql";

export const table: any = isMySql ? mysqlTableFn : pgTableFn;
export const serial: any = isMySql ? mysqlSerial : pgSerial;
export const integer: any = isMySql ? mysqlInt : pgInteger;
export const text: any = isMySql ? mysqlText : pgText;
export const varchar: any = isMySql ? mysqlVarchar : pgVarchar;
export const timestamp: any = isMySql ? mysqlTimestamp : pgTimestamp;
export const boolean: any = isMySql ? mysqlBoolean : pgBoolean;
