import { useEffect, useState } from "react";
import { signedUrl } from "@/lib/storage";

/** Renders an <img> for either an absolute URL or a `tenant-assets` storage path. */
export function StoragedImage({
  path, alt, className, fallback,
}: { path?: string | null; alt: string; className?: string; fallback?: React.ReactNode }) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    if (!path) { setUrl(""); return; }
    if (path.startsWith("http")) { setUrl(path); return; }
    let active = true;
    signedUrl(path).then((u) => { if (active) setUrl(u); });
    return () => { active = false; };
  }, [path]);
  if (!path || (!url && !path.startsWith("http"))) return <>{fallback ?? null}</>;
  return <img src={url} alt={alt} className={className} />;
}
