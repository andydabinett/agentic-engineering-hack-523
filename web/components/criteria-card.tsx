"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { triggerIngest, refreshListingsInStore } from "@/lib/hydrate";
import { useAppStore } from "@/lib/store";
import { cn, formatPricePerMonth } from "@/lib/utils";

export function CriteriaCard() {
  const router = useRouter();
  const [ingesting, setIngesting] = useState(false);
  const criteria = useAppStore((s) => s.criteria);

  const formattedPrice = criteria.maxPrice != null ? formatPricePerMonth(criteria.maxPrice) : null;
  const formattedBedrooms =
    criteria.bedrooms != null
      ? criteria.bedrooms === 0
        ? "Studio"
        : `${criteria.bedrooms} bedroom${criteria.bedrooms === 1 ? "" : "s"}`
      : null;

  return (
    <aside className="sticky top-6 flex h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-xl border border-rule bg-surface">
      <header className="border-b border-rule px-6 pt-6 pb-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ink-faint">
          Live criteria
        </p>
        <h2 className="mt-1.5 font-serif text-2xl leading-tight">Your search</h2>
        <p className="mt-1 text-[13px] text-ink-muted">
          The agent updates this as you talk.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <dl className="flex flex-col">
          <Field label="Bedrooms" value={formattedBedrooms} />
          <Field label="Max price" value={formattedPrice} accent />
          <Field label="Neighborhood" value={criteria.neighborhood} />
          <Field label="Move-in" value={criteria.moveInDate} />
          <ChipField label="Must-haves" chips={criteria.amenities} tone="must" />
          <ChipField label="Deal-breakers" chips={criteria.dealBreakers} tone="deal" />
        </dl>
      </div>

      <footer className="border-t border-rule p-5">
        <Button
          size="lg"
          disabled={!criteria.readyToSearch || ingesting}
          onClick={async () => {
            setIngesting(true);
            toast.message("Starting ingest…", {
              description: "Nimble search — usually a few seconds in demo mode.",
            });
            try {
              const result = await triggerIngest(criteria as unknown as Record<string, unknown>);
              if (!result.ok) {
                toast.error("Ingest failed", { description: result.stderr || result.error });
              } else {
                const { total, newIds, matches } = await refreshListingsInStore();
                const stored = result.storedTotal ?? 0;
                toast.success("Ingest complete", {
                  description:
                    stored > 0
                      ? `Indexed ${stored} from Nimble — ${newIds.length} new, ${matches} match criteria.`
                      : `${total} listings on dashboard (${matches} match criteria).`,
                });
              }
            } catch {
              toast.error("Could not reach ingest API");
            } finally {
              setIngesting(false);
              router.push("/dashboard");
            }
          }}
          className={cn(
            "w-full text-[15px] tracking-tight",
            criteria.readyToSearch
              ? "accent-glow text-white"
              : "bg-surface-raised text-ink-faint border border-rule",
          )}
        >
          {ingesting ? (
            "Ingesting…"
          ) : criteria.readyToSearch ? (
            <span className="flex items-center gap-1.5">
              Start hunting
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </span>
          ) : (
            "Tell the agent more"
          )}
        </Button>
        {!criteria.readyToSearch && (
          <p className="mt-2 text-center text-[11px] text-ink-faint">
            Unlocks when the agent has enough to search.
          </p>
        )}
      </footer>
    </aside>
  );
}

function Field({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | null;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-4 border-b border-rule/60 py-3 last:border-b-0">
      <dt className="w-28 shrink-0 text-[12px] uppercase tracking-[0.1em] text-ink-faint">
        {label}
      </dt>
      <dd className="min-w-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          {value ? (
            <motion.span
              key={value}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "block truncate text-[15px] text-ink",
                accent && "font-serif text-lg leading-snug tabular tracking-tight",
              )}
            >
              {value}
            </motion.span>
          ) : (
            <motion.span
              key="empty"
              initial={false}
              animate={{ opacity: 1 }}
              className="block truncate text-[14px] text-ink-faint"
            >
              — not set yet
            </motion.span>
          )}
        </AnimatePresence>
      </dd>
    </div>
  );
}

function ChipField({
  label,
  chips,
  tone,
}: {
  label: string;
  chips: string[];
  tone: "must" | "deal";
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-rule/60 py-3 last:border-b-0">
      <dt className="text-[12px] uppercase tracking-[0.1em] text-ink-faint">
        {label}
      </dt>
      <dd>
        {chips.length === 0 ? (
          <span className="text-[14px] text-ink-faint">— not set yet</span>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            <AnimatePresence initial={false}>
              {chips.map((chip) => (
                <motion.li
                  key={chip}
                  layout
                  initial={{ opacity: 0, x: 10, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px]",
                    tone === "must"
                      ? "bg-accent-soft text-accent-deep"
                      : "bg-surface-raised text-ink-muted line-through decoration-rule-strong",
                  )}
                >
                  {chip}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </dd>
    </div>
  );
}
