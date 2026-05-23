export interface ResolvedClickHouseSettings {
  host: string | undefined;
  port: number;
  user: string;
  password: string | undefined;
  database: string;
  secure: boolean;
}

function normalizeHostField(raw: string | undefined): {
  host: string;
  port: string | undefined;
  secure: boolean | undefined;
} {
  const value = raw?.trim();
  if (!value) return { host: "", port: undefined, secure: undefined };

  if (/^https?:\/\//i.test(value)) {
    const parsed = new URL(value);
    return {
      host: parsed.hostname,
      port: parsed.port || undefined,
      secure: parsed.protocol === "https:",
    };
  }

  if (value.includes(":") && !value.includes("/")) {
    const [host, port] = value.split(":");
    return { host, port: port || undefined, secure: undefined };
  }

  return { host: value.replace(/\/+$/, ""), port: undefined, secure: undefined };
}

function resolvePassword(): string | undefined {
  return (
    process.env.CLICKHOUSE_PASSWORD?.trim() ||
    process.env.CLICKHOUSE_API_KEY?.trim() ||
    process.env.CLICKHOUSE_KEY?.trim()
  );
}

/** Align correspondence ClickHouse env with listings (`clickhouseEnv.js`). */
export function resolveClickHouseSettings(options?: {
  defaultDatabase?: string;
}): ResolvedClickHouseSettings {
  const defaultDatabase = options?.defaultDatabase ?? "default";
  const rawUrl = process.env.CLICKHOUSE_URL?.trim();

  if (rawUrl) {
    const parsed = new URL(rawUrl);
    const secure = parsed.protocol === "https:";
    return {
      host: parsed.hostname,
      port: Number(parsed.port || (secure ? "8443" : "8123")),
      user: decodeURIComponent(parsed.username || "default"),
      password: decodeURIComponent(parsed.password || "") || undefined,
      database: parsed.pathname.replace(/^\//, "") || defaultDatabase,
      secure,
    };
  }

  const password = resolvePassword();
  const normalized = normalizeHostField(process.env.CLICKHOUSE_HOST);
  const host = normalized.host || undefined;
  const secure =
    normalized.secure ??
    ["1", "true", "yes"].includes((process.env.CLICKHOUSE_SECURE || "true").toLowerCase());

  return {
    host,
    port: Number(
      normalized.port ||
        process.env.CLICKHOUSE_PORT ||
        (secure ? "8443" : "8123"),
    ),
    user: process.env.CLICKHOUSE_USER || "default",
    password,
    database: process.env.CLICKHOUSE_DATABASE || defaultDatabase,
    secure,
  };
}

export function clickhouseConfiguredFromEnv(options?: {
  defaultDatabase?: string;
}): boolean {
  const settings = resolveClickHouseSettings(options);
  return Boolean(settings.host && settings.password);
}
