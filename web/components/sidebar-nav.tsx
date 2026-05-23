"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CalendarRange, LayoutGrid, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/calendar", label: "Calendar", icon: CalendarRange },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex h-screen sticky top-0 w-[220px] shrink-0 flex-col border-r border-rule bg-canvas">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-8">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-ink text-canvas">
          <Building2 className="h-4 w-4" strokeWidth={2.2} />
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-serif text-lg tracking-tight">Javier</span>
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">
            Rent concierge
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3">
        <ul className="flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <li key={href} className="relative">
                {isActive && (
                  <span className="absolute inset-y-1 left-0 w-[2px] rounded-full bg-accent" />
                )}
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-accent-soft text-ink"
                      : "text-ink-muted hover:bg-surface-raised hover:text-ink",
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive ? "text-accent" : "text-ink-muted")} strokeWidth={1.75} />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User */}
      <div className="m-3 mt-0 flex items-center gap-3 rounded-md border border-rule bg-surface px-3 py-2.5">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-accent/15 text-accent">AC</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="text-sm font-medium text-ink">Alex Chen</span>
          <span className="truncate text-[11px] text-ink-faint">East Village hunter</span>
        </div>
      </div>
    </aside>
  );
}
