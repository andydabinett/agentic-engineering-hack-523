export interface Config {
  port: number;
  publicBaseUrl: string;
  correspondenceDev: boolean;
  openRouterApiKey: string | undefined;
  twilioAccountSid: string | undefined;
  twilioAuthToken: string | undefined;
  twilioPhoneNumber: string | undefined;
  textbeltApiKey: string | undefined;
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
    textbeltApiKey: env("TEXTBELT_API_KEY"),
    clickhouseHost: env("CLICKHOUSE_HOST"),
    clickhousePort: Number(env("CLICKHOUSE_PORT", "8443")),
    clickhouseUser: env("CLICKHOUSE_USER", "default")!,
    clickhousePassword:
      env("CLICKHOUSE_PASSWORD") ??
      env("CLICKHOUSE_API_KEY") ??
      env("CLICKHOUSE_KEY"),
    clickhouseDatabase: env("CLICKHOUSE_DATABASE", "default")!,
    clickhouseSecure: env("CLICKHOUSE_SECURE", "true") === "true",
    googleClientId: env("GOOGLE_CLIENT_ID"),
    googleClientSecret: env("GOOGLE_CLIENT_SECRET"),
    googleRedirectUri: env("GOOGLE_REDIRECT_URI"),
    googleRefreshToken: env("GOOGLE_REFRESH_TOKEN"),
  };
}

export function twilioConfigured(config: Config): boolean {
  return Boolean(
    (config.twilioAccountSid && config.twilioAuthToken && config.twilioPhoneNumber) ||
      config.textbeltApiKey
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
