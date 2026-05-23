import type { Config } from "./config.ts";
import { calendarConfigured, clickhouseConfigured, twilioConfigured } from "./config.ts";
import { createAgentRunner } from "./agent/index.ts";
import { ClickHouseCorrespondenceStore, createClickHouseClient } from "./services/clickhouse/client.ts";
import { FakeCalendarProvider } from "./services/calendar/provider.ts";
import { GoogleCalendarProvider } from "./services/calendar/google.ts";
import { CorrespondenceOrchestrator } from "./services/correspondence/orchestrator.ts";
import { FakeSmsProvider } from "./services/sms/provider.ts";
import { createTwilioSmsProvider } from "./services/sms/twilio.ts";
import type { CorrespondenceStore } from "./services/correspondence/types.ts";
import type { SmsProvider } from "./services/sms/provider.ts";
import type { CalendarProvider } from "./services/calendar/provider.ts";
import { FakeClickHouse } from "./services/clickhouse/fake.ts";

export interface AppDeps {
  config: Config;
  store: CorrespondenceStore;
  sms: SmsProvider;
  calendar: CalendarProvider;
  orchestrator: CorrespondenceOrchestrator;
}

export function createAppDeps(config: Config, overrides?: Partial<AppDeps>): AppDeps {
  const store =
    overrides?.store ??
    (clickhouseConfigured(config)
      ? new ClickHouseCorrespondenceStore(
          createClickHouseClient(config),
          config.clickhouseDatabase,
        )
      : new FakeClickHouse());

  const sms =
    overrides?.sms ??
    (twilioConfigured(config) ? createTwilioSmsProvider(config) : new FakeSmsProvider());

  const calendar =
    overrides?.calendar ??
    (calendarConfigured(config)
      ? new GoogleCalendarProvider(config, store)
      : new FakeCalendarProvider());

  const agent = createAgentRunner(config);
  const orchestrator =
    overrides?.orchestrator ??
    new CorrespondenceOrchestrator(store, sms, calendar, agent);

  return { config, store, sms, calendar, orchestrator };
}

export function healthPayload(config: Config) {
  return {
    status: "ok",
    twilioConfigured: twilioConfigured(config),
    clickhouseConfigured: clickhouseConfigured(config),
    calendarConfigured: calendarConfigured(config),
  };
}
