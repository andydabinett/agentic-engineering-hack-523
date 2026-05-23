import { google } from "googleapis";

import type { Config } from "../../config.ts";
import type { CorrespondenceStore } from "../correspondence/types.ts";
import type {
  CalendarEvent,
  CalendarEventInput,
  CalendarProvider,
} from "./provider.ts";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

export function createGoogleOAuthClient(config: Config) {
  return new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRedirectUri,
  );
}

export function getGoogleAuthUrl(config: Config, userId: string): string {
  const oauth2 = createGoogleOAuthClient(config);
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state: userId,
  });
}

export class GoogleCalendarProvider implements CalendarProvider {
  constructor(
    private readonly config: Config,
    private readonly store: CorrespondenceStore,
  ) {}

  private async getAuthClient(userId: string) {
    const oauth2 = createGoogleOAuthClient(this.config);
    const stored = await this.store.getCalendarToken(userId);
    const refreshToken = stored ?? this.config.googleRefreshToken;
    if (!refreshToken) {
      throw new Error(`No Google refresh token for user ${userId}`);
    }
    oauth2.setCredentials({ refresh_token: refreshToken });
    return oauth2;
  }

  async getFreeBusy(
    userId: string,
    timeMin: string,
    timeMax: string,
  ): Promise<Array<{ start: string; end: string }>> {
    const auth = await this.getAuthClient(userId);
    const calendar = google.calendar({ version: "v3", auth });
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        items: [{ id: "primary" }],
      },
    });
    const busy = response.data.calendars?.primary?.busy ?? [];
    return busy
      .filter((block) => block.start && block.end)
      .map((block) => ({
        start: block.start!,
        end: block.end!,
      }));
  }

  async createEvent(
    userId: string,
    event: CalendarEventInput,
  ): Promise<CalendarEvent> {
    const auth = await this.getAuthClient(userId);
    const calendar = google.calendar({ version: "v3", auth });
    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: event.title,
        location: event.location,
        description: event.description,
        start: { dateTime: event.start },
        end: { dateTime: event.end },
      },
    });
    return {
      id: response.data.id ?? crypto.randomUUID(),
      htmlLink: response.data.htmlLink ?? undefined,
    };
  }
}

export async function exchangeGoogleCode(
  config: Config,
  code: string,
): Promise<string> {
  const oauth2 = createGoogleOAuthClient(config);
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("Google OAuth did not return a refresh token");
  }
  return tokens.refresh_token;
}
