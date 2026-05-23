import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@clickhouse/client";

import { loadConfig, clickhouseConfigured } from "../src/config.ts";

async function main() {
  const config = loadConfig();
  if (!clickhouseConfigured(config)) {
    console.error("Set CLICKHOUSE_HOST and CLICKHOUSE_PASSWORD in .env");
    process.exit(1);
  }

  const sql = readFileSync(
    resolve(import.meta.dirname, "init_clickhouse.sql"),
    "utf8",
  );
  const statements = sql
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  const client = createClient({
    url: `${config.clickhouseSecure ? "https" : "http"}://${config.clickhouseHost}:${config.clickhousePort}`,
    username: config.clickhouseUser,
    password: config.clickhousePassword,
  });

  for (const statement of statements) {
    await client.command({ query: statement });
    console.log("OK:", statement.split("\n")[0]);
  }

  await client.close();
  console.log("ClickHouse schema initialized.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
