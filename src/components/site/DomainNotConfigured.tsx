/**
 * Shown when the visitor is on an external hostname that we don't recognise
 * as either a reserved platform host or any tenant's custom_domain.
 * This is a "misconfigured domain" screen — NOT the marketing homepage.
 */
export function DomainNotConfigured() {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-6 text-center text-white">
      <div className="max-w-md space-y-4">
        <div
          className="text-5xl font-black uppercase tracking-tighter"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          Not <span className="text-lime-400">connected</span>
        </div>
        <p className="text-sm text-zinc-400">
          {host ? <span className="font-mono text-white">{host}</span> : "This domain"} is not
          linked to an academy yet.
        </p>
        <p className="text-xs text-zinc-500">
          If you are the academy owner, contact us to finish setup. If you were
          looking for Academy OS, visit{" "}
          <a href="https://academy.nevorai.com" className="text-lime-400 underline">
            academy.nevorai.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
