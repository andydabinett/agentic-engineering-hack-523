import { CalendarGrid } from "@/components/calendar-grid";

export default function CalendarPage() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-8 pt-6 pb-12">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-faint">
            Calendar
          </p>
          <h1 className="mt-1 font-serif text-3xl leading-tight tracking-tight">
            This week
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-muted">
            Apartment viewings the agent booked, alongside your own events.
          </p>
        </div>
      </header>

      <CalendarGrid />
    </div>
  );
}
