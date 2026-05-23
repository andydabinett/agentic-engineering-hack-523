import { resolveClickHouseSettings } from "./config/resolveClickhouse.ts";

export interface Config {
  port: number;
  publicBaseUrl: string;
  correspondenceDev: boolean;
  openRouterApiKey: string | undefined;
  twilioAccountSid: string | undefined;
  twilioAuthToken: string | undefined;
  twilioPhoneNumber: string | undefined;
  clickhouseHost: string | undefined;
  clickhousePort: number;
  clickhouseUser: string;
  clickhousePassword: string | undefined;
  clickhouseDatabase: string;
  clickhouseSecure: boolean;
  googleClientId: string | undefined;
  googleClientSecret: string | undefined;
  googleRedirectUri: string | undefined;
  googleRefreshToken: string | undefined;
}

function env(name: string, fallback?: string): string | undefined {
  return process.env[name] ?? fallback;
}

export function loadConfig(): Config {
  const clickhouse = resolveClickHouseSettings({ defaultDatabase: "javier" });

  return {
    port: Number(env("PORT", "3001")),
    publicBaseUrl: env("PUBLIC_BASE_URL", "http://localhost:3001")!,
    correspondenceDev:
      env("CORRESPONDENCE_DEV", "0") === "1" ||
      env("CORRESPONDENCE_FAKE_DEMO", "0") === "1",
    openRouterApiKey: env("OPENROUTER_API_KEY"),
    twilioAccountSid: env("TWILIO_ACCOUNT_SID"),
    twilioAuthToken: env("TWILIO_AUTH_TOKEN"),
    twilioPhoneNumber: env("TWILIO_PHONE_NUMBER"),
    clickhouseHost: clickhouse.host,
    clickhousePort: clickhouse.port,
    clickhouseUser: clickhouse.user,
    clickhousePassword: clickhouse.password,
    clickhouseDatabase: clickhouse.database,
    clickhouseSecure: clickhouse.secure,
    googleClientId: env("GOOGLE_CLIENT_ID"),
    googleClientSecret: env("GOOGLE_CLIENT_SECRET"),
    googleRedirectUri: env("GOOGLE_REDIRECT_URI"),
    googleRefreshToken: env("GOOGLE_REFRESH_TOKEN"),
  };
}

export function twilioConfigured(config: Config): boolean {
  return Boolean(
    config.twilioAccountSid && config.twilioAuthToken && config.twilioPhoneNumber,
  );
}

export function clickhouseConfigured(config: Config): boolean {
  return Boolean(config.clickhouseHost && config.clickhousePassword);
}

export function calendarConfigured(config: Config): boolean {
  return Boolean(
    config.googleRefreshToken ||
      (config.googleClientId && config.googleClientSecret && config.googleRedirectUri),
  );
}
