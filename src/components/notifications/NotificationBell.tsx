import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useUnreadCount, useNotificationsRealtime } from "@/lib/notifications";
import { NotificationCenter } from "./NotificationCenter";
import { cn } from "@/lib/utils";

export function NotificationBell({ className }: { className?: string }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useNotificationsRealtime(userId);
  const unread = useUnreadCount(userId);
  const count = unread.data ?? 0;

  if (!userId) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
          className={cn(
            "relative inline-grid place-items-center size-9 rounded-full hover:bg-accent transition-colors",
            className,
          )}
        >
          <Bell className="size-4" />
          {count > 0 ? (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full text-[10px] font-bold text-white bg-rose-600 ring-2 ring-background"
            >
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full p-0 sm:max-w-md">
        <NotificationCenter userId={userId} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
