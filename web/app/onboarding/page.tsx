import { ChatPanel } from "@/components/chat-panel";
import { CriteriaCard } from "@/components/criteria-card";

export default function OnboardingPage() {
  return (
    <div className="mx-auto flex h-screen w-full max-w-[1400px] gap-6 p-6">
      {/* Left — Chat (60%) */}
      <section className="flex min-w-0 flex-[3] flex-col overflow-hidden rounded-xl border border-rule bg-surface">
        <header className="border-b border-rule px-7 pt-7 pb-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-faint">
            New search
          </p>
          <h1 className="mt-1.5 font-serif text-[34px] leading-[1.05] tracking-tight">
            Find your apartment
          </h1>
          <p className="mt-2 max-w-[44ch] text-[14px] text-ink-muted">
            Tell the agent what you&apos;re looking for. It&apos;ll handle the rest —
            scraping listings, texting brokers, and booking viewings.
          </p>
        </header>
        <div className="min-h-0 flex-1">
          <ChatPanel variant="page" />
        </div>
      </section>

      {/* Right — Criteria (40%) */}
      <section className="flex min-w-0 flex-[2] flex-col">
        <CriteriaCard />
      </section>
    </div>
  );
}
