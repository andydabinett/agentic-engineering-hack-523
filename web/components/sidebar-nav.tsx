"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, CalendarRange, LayoutGrid, MessageSquare, Bell, Trash2, CalendarCheck } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/calendar", label: "Calendar", icon: CalendarRange },
];

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const notifications = useAppStore((s) => s.notifications);
  const markNotificationAsRead = useAppStore((s) => s.markNotificationAsRead);
  const clearAllNotifications = useAppStore((s) => s.clearAllNotifications);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const [isOpen, setIsOpen] = useState(false);

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

          {/* Notifications item */}
          <li className="relative">
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink transition-colors text-left"
                >
                  <div className="relative animate-none">
                    <Bell className="h-4 w-4 text-ink-muted" strokeWidth={1.75} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[8px] font-bold text-white leading-none">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <span>Notifications</span>
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="flex flex-col h-full bg-canvas p-0">
                <SheetHeader className="px-6 pt-6 pb-4 border-b border-rule">
                  <div className="flex items-center justify-between">
                    <div>
                      <SheetTitle className="font-serif text-xl">Notifications</SheetTitle>
                      <SheetDescription className="mt-1">
                        Updates on viewings scheduled by Javier.
                      </SheetDescription>
                    </div>
                    {notifications.length > 0 && (
                      <Button
                        variant="subtle"
                        size="sm"
                        onClick={clearAllNotifications}
                        className="text-xs flex items-center gap-1.5 h-7 px-2"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Clear all
                      </Button>
                    )}
                  </div>
                </SheetHeader>

                {/* Notifications list */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent mb-3">
                        <Bell className="h-5 w-5" strokeWidth={1.75} />
                      </div>
                      <p className="text-sm font-medium text-ink">All caught up</p>
                      <p className="text-xs text-ink-faint mt-1 max-w-[200px]">
                        No new updates. Javier is coordinating bookings in the background.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            markNotificationAsRead(n.id);
                            setIsOpen(false);
                            router.push(`/calendar?viewing=${n.viewingId}`);
                          }}
                          className={cn(
                            "group relative flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all hover:bg-surface-raised",
                            n.read ? "bg-surface border-rule" : "bg-accent-soft/30 border-accent/20"
                          )}
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                            <CalendarCheck className="h-4.5 w-4.5" />
                          </div>
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="flex items-center gap-1.5 justify-between">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">
                                Viewing Booked
                              </span>
                              <span className="text-[10px] text-ink-faint tabular">
                                {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
                              </span>
                            </div>
                            <p className="text-sm font-medium leading-snug mt-1 text-ink group-hover:text-accent transition-colors">
                              {n.address}
                            </p>
                            <p className="text-xs text-ink-muted mt-1 leading-normal">
                              Javier booked a viewing with {n.brokerName} for{" "}
                              <span className="font-semibold text-ink">
                                {format(new Date(n.startTime), "eeee MMM d 'at' h:mm a")}
                              </span>.
                            </p>
                          </div>
                          {!n.read && (
                            <span className="absolute top-3 right-3 h-2 w-2 rounded-full bg-accent" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </li>
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
