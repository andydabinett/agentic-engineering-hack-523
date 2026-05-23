export interface CalendarEventInput {
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
}

export interface CalendarEvent {
  id: string;
  htmlLink?: string;
}

export interface CalendarProvider {
  getFreeBusy(
    userId: string,
    timeMin: string,
    timeMax: string,
  ): Promise<Array<{ start: string; end: string }>>;
  createEvent(userId: string, event: CalendarEventInput): Promise<CalendarEvent>;
}

export class FakeCalendarProvider implements CalendarProvider {
  readonly events: Array<{ userId: string; event: CalendarEventInput; id: string }> =
    [];
  busyBlocks: Array<{ start: string; end: string }> = [];

  async getFreeBusy(
    _userId: string,
    timeMin: string,
    timeMax: string,
  ): Promise<Array<{ start: string; end: string }>> {
    return this.busyBlocks.filter(
      (block) => block.start >= timeMin && block.end <= timeMax,
    );
  }

  async createEvent(
    userId: string,
    event: CalendarEventInput,
  ): Promise<CalendarEvent> {
    const id = `evt_fake_${this.events.length + 1}`;
    this.events.push({ userId, event, id });
    return { id, htmlLink: `https://calendar.google.com/event?eid=${id}` };
  }
}
