import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_PLATFORM_SETTINGS,
  fetchPlatformSettings,
  platformSettingsKey,
  waHref,
} from "@/lib/platform-settings";

const DEMO_MSG = "Hi, I'd like a demo of Academy OS";

// Stadium Night palette
const BG = "#0a0f0a";
const SURFACE = "#141d16";
const LIME = "#c6ff4a";
const CHALK = "#f5f5f0";

/** Landing shown at the root domain when no tenant matches the URL.
 *  Stadium Night direction: near-black turf, chalk lines, single lime accent. */
export function TenantPlaceholder() {
  const { data: settings = DEFAULT_PLATFORM_SETTINGS } = useQuery({
    queryKey: platformSettingsKey,
    queryFn: fetchPlatformSettings,
    staleTime: 60_000,
  });
  const whatsappUrl = waHref(settings.contact_whatsapp, DEMO_MSG);
  const emailUrl = `mailto:${settings.contact_email}?subject=${encodeURIComponent("Demo request — Academy OS")}`;

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden font-[Inter,ui-sans-serif,system-ui] selection:bg-[color:var(--lime)]/40 selection:text-black"
      style={{
        background: BG,
        color: CHALK,
        // expose palette as CSS vars for arbitrary values
        // @ts-expect-error CSS custom props
        "--lime": LIME,
        "--surface": SURFACE,
      }}
    >
      {/* Floodlight glow, top-left and top-right */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full opacity-40 blur-[140px]"
          style={{ background: `radial-gradient(closest-side, ${LIME}22, transparent 70%)` }}
        />
        <div
          className="absolute inset-x-0 top-0 h-[70vh] opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
            backgroundSize: "80px 80px",
            maskImage: "linear-gradient(to bottom, black, transparent)",
          }}
        />
      </div>

      {/* Top nav bar */}
      <nav className="sticky top-0 z-20 border-b border-white/5 backdrop-blur-md" style={{ background: `${BG}cc` }}>
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div
              className="grid h-8 w-8 place-items-center rounded-md text-[13px] font-bold"
              style={{ background: LIME, color: "#0a0f0a" }}
            >
              A
            </div>
            <span className="font-[Bricolage_Grotesque,serif] text-sm font-semibold tracking-tight">Academy OS</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              className="rounded-full border border-white/10 px-4 py-1.5 text-xs font-medium text-white/80 transition hover:border-white/25 hover:text-white"
            >
              Log in
            </Link>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full px-4 py-1.5 text-xs font-semibold transition hover:brightness-110"
              style={{ background: LIME, color: "#0a0f0a" }}
            >
              Book a demo
            </a>
          </div>
        </div>
      </nav>

      <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-16 md:py-24">
        {/* Hero */}
        <header className="animate-fade-in">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: LIME }} />
            Matchday · Season 26
          </div>

          <h1 className="mt-6 max-w-4xl font-[Bricolage_Grotesque,serif] text-6xl font-bold leading-[0.95] tracking-tight text-white md:text-8xl">
            Run your academy
            <br />
            like a <span className="relative inline-block">
              <span className="relative z-10">pro club</span>
              <span
                aria-hidden
                className="absolute -bottom-1 left-0 right-0 h-3 rounded-sm"
                style={{ background: LIME }}
              />
            </span>.
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-white/60 md:text-xl">
            One dashboard for registrations, fees, batches, attendance and WhatsApp reminders.
            Built for cricket academies, gyms and coaching centres who want to look sharp and get paid on time.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 font-semibold transition hover:brightness-110 active:scale-[0.98]"
              style={{ background: LIME, color: "#0a0f0a" }}
            >
              <WhatsAppIcon />
              Chat on WhatsApp
              <span className="transition group-hover:translate-x-0.5">→</span>
            </a>
            <a
              href={emailUrl}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-7 py-3.5 font-semibold text-white transition hover:border-white/30 hover:bg-white/10"
            >
              Email the team
            </a>
          </div>

          {/* Scoreboard-style stat strip */}
          <dl className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] md:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="p-6" style={{ background: SURFACE }}>
                <dt className="text-[11px] font-semibold uppercase tracking-widest text-white/40">{s.label}</dt>
                <dd className="mt-2 font-[Bricolage_Grotesque,serif] text-3xl font-bold" style={{ color: LIME }}>
                  {s.value}
                </dd>
                <p className="mt-1 text-xs text-white/50">{s.hint}</p>
              </div>
            ))}
          </dl>
        </header>

        {/* Feature grid */}
        <section className="mt-28">
          <SectionHeader eyebrow="What's in the kitbag" title="Everything an owner needs. Nothing you don't." />
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="group relative overflow-hidden rounded-2xl border border-white/10 p-6 transition hover:-translate-y-0.5 hover:border-white/25"
                style={{ background: SURFACE, animationDelay: `${i * 40}ms` }}
              >
                <div
                  className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity group-hover:opacity-30"
                  style={{ background: LIME }}
                />
                <div
                  className="mb-4 grid h-10 w-10 place-items-center rounded-lg font-[Bricolage_Grotesque,serif] text-lg font-bold text-black"
                  style={{ background: LIME }}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="font-[Bricolage_Grotesque,serif] text-lg font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{f.body}</p>
              </div>

            ))}
          </div>
        </section>

        {/* Segmented audience chips */}
        <section className="mt-28">
          <SectionHeader eyebrow="Built for" title="Any coaching business that runs on batches and monthly fees." />
          <div className="mt-8 flex flex-wrap gap-2.5">
            {AUDIENCES.map((a) => (
              <div
                key={a.title}
                className="group inline-flex items-center gap-3 rounded-full border border-white/10 px-4 py-2.5 transition hover:border-[color:var(--lime)]/50"
                style={{ background: SURFACE }}
              >
                <span
                  className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold text-black"
                  style={{ background: LIME }}
                >
                  {a.tag}
                </span>
                <span className="text-sm font-medium text-white">{a.title}</span>
                <span className="hidden text-xs text-white/50 sm:inline">— {a.hint}</span>
              </div>
            ))}
          </div>
        </section>

        {/* How it works — three lanes */}
        <section className="mt-28">
          <SectionHeader eyebrow="How it works" title="From cold WhatsApp to first collected fee in 48 hours." />
          <ol className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/10 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative p-8" style={{ background: SURFACE }}>
                <div className="flex items-baseline gap-3">
                  <span className="font-[Bricolage_Grotesque,serif] text-5xl font-bold" style={{ color: LIME }}>
                    0{i + 1}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Step</span>
                </div>
                <h3 className="mt-4 font-[Bricolage_Grotesque,serif] text-xl font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Pricing strip */}
        <section className="mt-28 flex flex-col items-start justify-between gap-6 rounded-2xl border border-white/10 p-8 md:flex-row md:items-center" style={{ background: SURFACE }}>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Pricing</div>
            <div className="mt-2 font-[Bricolage_Grotesque,serif] text-3xl font-bold text-white">
              Starts at <span style={{ color: LIME }}>₹2,000</span>
              <span className="text-white/50">/mo</span>
            </div>
            <p className="mt-1 text-sm text-white/60">Zero setup. No card. Cancel anytime.</p>
          </div>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold transition hover:brightness-110"
            style={{ background: LIME, color: "#0a0f0a" }}
          >
            <WhatsAppIcon /> See a live demo
          </a>
        </section>

        {/* Coming AI teaser */}
        <section className="mt-28 rounded-2xl border border-white/10 p-8 md:p-12" style={{ background: `linear-gradient(180deg, ${SURFACE}, ${BG})` }}>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: LIME }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: LIME }} />
            Coming soon · AI assistant
          </div>
          <h2 className="mt-4 max-w-3xl font-[Bricolage_Grotesque,serif] text-3xl font-bold text-white md:text-4xl">
            Ask your academy anything.
            <span className="text-white/60"> "Who hasn't paid this month? Draft reminders. Show absentees this week."</span>
          </h2>
          <p className="mt-4 max-w-2xl text-white/60">
            The AI agent that replaces the extra admin hire. Same subscription. Rolling out to every owner.
          </p>
        </section>

        {/* Footer CTA */}
        <section className="mt-20 border-t border-white/10 pt-10 text-center">
          <h2 className="font-[Bricolage_Grotesque,serif] text-3xl font-bold text-white md:text-4xl">
            Ready to run a tighter academy?
          </h2>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 font-semibold transition hover:brightness-110"
              style={{ background: LIME, color: "#0a0f0a" }}
            >
              <WhatsAppIcon /> Chat on WhatsApp
            </a>
            <a href={emailUrl} className="text-sm text-white/50 underline underline-offset-4 hover:text-white">
              or drop us an email
            </a>
          </div>
          <div className="mt-10 flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/30">
            <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
            No academy configured for this URL
          </div>
        </section>

        <footer className="mt-16 pb-4 text-center text-[10px] uppercase tracking-widest text-white/30">
          Academy OS · Built for performance
        </footer>
      </div>
    </div>
  );
}

/* ─── Content ─────────────────────────────────────────── */

const STATS = [
  { label: "Setup time", value: "48h", hint: "From signup to live portal" },
  { label: "Owner time saved", value: "12h/wk", hint: "Vs pen-and-paper" },
  { label: "Fees collected", value: "94%", hint: "Median on-time rate" },
  { label: "Monthly cost", value: "₹2K+", hint: "Per academy" },
];

const FEATURES = [
  { title: "Online registration", body: "Branded intake forms, batch + fee-plan pickers, UPI-ready payment flow, PDF receipts." },
  { title: "Fee management", body: "Monthly cycles, overdue chips, UPI verification, one-tap WhatsApp reminders." },
  { title: "Batches & rosters", body: "Multi-batch, multi-centre scheduling with coach-friendly attendance." },
  { title: "Lead inbox", body: "Landing-page enquiries land in your dashboard. Reply on WhatsApp in one tap." },
  { title: "Owner site", body: "A polished branded microsite per academy — subdomain or custom domain. Editable copy." },
  { title: "Reports", body: "Registrations, revenue, retention. Export CSV whenever you need it." },
];

const AUDIENCES = [
  { tag: "🏏", title: "Cricket academies", hint: "Nets, coaching, tournaments" },
  { tag: "⚽", title: "Football & sports", hint: "Any batch-based sport" },
  { tag: "💪", title: "Gyms & fitness studios", hint: "Members, plans, trainers" },
  { tag: "📚", title: "Coaching centres", hint: "Tuition, groups, tutors" },
];

const STEPS = [
  { title: "Share your details", body: "Name, colours, fee plans and your UPI ID. We set up your branded portal from that." },
  { title: "Go live", body: "Custom subdomain, logo and site content ship in a day. You get an owner login and a walkthrough." },
  { title: "Collect fees", body: "Send the registration link to parents. Track everything from one dashboard on your phone." },
];

function WhatsAppIcon() {
  return (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.484 8.412-.003 6.557-5.338 11.892-11.893 11.892-1.997-.001-3.951-.5-5.688-1.448l-6.309 1.656zm6.224-3.82c1.516.903 3.136 1.379 4.793 1.38h.005c5.331 0 9.673-4.341 9.676-9.674 0-2.584-1.005-5.013-2.829-6.837-1.826-1.826-4.253-2.831-6.834-2.831-5.334 0-9.673 4.341-9.676 9.674-.001 1.887.544 3.723 1.574 5.337l-.999 3.65 3.734-.98z" />
    </svg>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
        <span className="h-px w-8" style={{ background: LIME }} />
        {eyebrow}
      </div>
      <h2 className="max-w-3xl font-[Bricolage_Grotesque,serif] text-3xl font-bold leading-tight text-white md:text-5xl">
        {title}
      </h2>
    </div>
  );
}
