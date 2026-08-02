import { useEffect, useState } from "react";
import { signedUrl } from "@/lib/storage";

/**
 * Academy mark for the member portal.
 *
 * `tenant.logo_url` is usually a `tenant-assets` storage PATH (not a URL), so a
 * raw <img src={logo_url}> renders the browser's broken-image icon. This
 * component resolves storage paths to signed URLs, keeps the aspect ratio with
 * object-contain, and falls back to branded initials whenever the image is
 * missing, still resolving, or fails to load.
 */
export function AcademyLogo({
  path,
  name,
  initials,
  accent,
  className = "size-11",
}: {
  path?: string | null;
  name: string;
  initials: string;
  accent: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (!path) {
      setUrl(null);
      return;
    }
    if (path.startsWith("http") || path.startsWith("/")) {
      setUrl(path);
      return;
    }
    let active = true;
    signedUrl(path)
      .then((u) => active && setUrl(u || null))
      .catch(() => active && setUrl(null));
    return () => {
      active = false;
    };
  }, [path]);

  const showImage = !!url && !failed;

  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-xl border border-auth-border bg-auth-surface ${className}`}
      aria-hidden={false}
    >
      {showImage ? (
        <img
          src={url}
          alt={name}
          width={44}
          height={44}
          decoding="async"
          className="size-full object-contain p-1"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="text-sm font-black uppercase tracking-tight"
          style={{ color: accent }}
          aria-label={name}
        >
          {initials}
        </span>
      )}
    </span>
  );
}
