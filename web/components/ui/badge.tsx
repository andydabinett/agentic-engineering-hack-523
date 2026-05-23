import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default: "border-rule bg-surface-raised text-ink",
        accent: "border-transparent bg-accent text-white",
        green:
          "border-transparent bg-signal-green-soft text-signal-green",
        amber:
          "border-transparent bg-signal-amber-soft text-signal-amber",
        blue: "border-transparent bg-signal-blue-soft text-signal-blue",
        purple:
          "border-transparent bg-signal-purple-soft text-signal-purple",
        gray: "border-transparent bg-signal-gray-soft text-signal-gray",
        outline: "border-rule-strong text-ink-muted",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
