import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { signedUrl } from "@/lib/storage";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function PersonAvatar({
  name,
  src,
  className,
}: {
  name: string;
  /** Absolute URL or a `tenant-assets` storage path. */
  src?: string | null;
  className?: string;
}) {
  const [resolved, setResolved] = useState<string>(() =>
    src && src.startsWith("http") ? src : "",
  );

  useEffect(() => {
    if (!src) {
      setResolved("");
      return;
    }
    if (src.startsWith("http")) {
      setResolved(src);
      return;
    }
    let active = true;
    signedUrl(src).then((u) => {
      if (active) setResolved(u);
    });
    return () => {
      active = false;
    };
  }, [src]);

  return (
    <Avatar className={cn("h-10 w-10", className)}>
      {resolved ? <AvatarImage src={resolved} alt={name} /> : null}
      <AvatarFallback
        className="text-sm font-semibold"
        style={{
          backgroundColor: "color-mix(in oklab, var(--brand) 18%, white)",
          color: "var(--brand)",
        }}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
