import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clickhouseConfigured, loadConfig } from "../src/config.ts";
import {
  clickhouseConfiguredFromEnv,
  resolveClickHouseSettings,
} from "../src/config/resolveClickhouse.ts";

const ENV_KEYS = [
  "CLICKHOUSE_URL",
  "CLICKHOUSE_HOST",
  "CLICKHOUSE_PASSWORD",
  "CLICKHOUSE_API_KEY",
  "CLICKHOUSE_KEY",
  "CLICKHOUSE_PORT",
  "CLICKHOUSE_USER",
  "CLICKHOUSE_DATABASE",
  "CLICKHOUSE_SECURE",
] as const;

function saveEnv(): Record<string, string | undefined> {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const key of ENV_KEYS) {
    const value = snapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("resolveClickHouseSettings", () => {
  let envSnapshot: Record<string, string | undefined>;

  beforeEach(() => {
    envSnapshot = saveEnv();
  });

  afterEach(() => {
    restoreEnv(envSnapshot);
  });

  it("accepts CLICKHOUSE_API_KEY as password", () => {
    for (const key of ENV_KEYS) delete process.env[key];
    process.env.CLICKHOUSE_HOST = "example.clickhouse.cloud";
    process.env.CLICKHOUSE_API_KEY = "secret-key";

    const settings = resolveClickHouseSettings({ defaultDatabase: "javier" });
    expect(settings.password).toBe("secret-key");
    expect(clickhouseConfiguredFromEnv({ defaultDatabase: "javier" })).toBe(true);
    expect(clickhouseConfigured(loadConfig())).toBe(true);
  });

  it("parses CLICKHOUSE_URL", () => {
    for (const key of ENV_KEYS) delete process.env[key];
    process.env.CLICKHOUSE_URL =
      "https://default:pass@abc.us-east1.aws.clickhouse.cloud:8443/javier";

    const settings = resolveClickHouseSettings({ defaultDatabase: "default" });
    expect(settings.host).toBe("abc.us-east1.aws.clickhouse.cloud");
    expect(settings.password).toBe("pass");
    expect(settings.database).toBe("javier");
  });
});
