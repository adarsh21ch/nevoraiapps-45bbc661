import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_PLATFORM_SETTINGS,
  fetchPlatformSettings,
  platformSettingsKey,
  waHref,
} from "@/lib/platform-settings";

const DEMO_MSG = "Hi, I'd like a demo of Academy OS";

/** Landing shown at the root domain when no tenant matches the URL.
 *  Acts as the platform's own marketing + login entry point. */
export function TenantPlaceholder() {
  const { data: settings = DEFAULT_PLATFORM_SETTINGS } = useQuery({
    queryKey: platformSettingsKey,
    queryFn: fetchPlatformSettings,
    staleTime: 60_000,
  });
  const whatsappUrl = waHref(settings.contact_whatsapp, DEMO_MSG);
  const emailUrl = `mailto:${settings.contact_email}?subject=${encodeURIComponent("Demo request — Academy OS")}`;

  return (
    <div className="min-h-screen w-full bg-[#050505] text-zinc-100 selection:bg-purple-500/30 font-[Inter,ui-sans-serif,system-ui] overflow-x-hidden">

      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 flex justify-center">
        <div className="h-[520px] w-[900px] max-w-full rounded-full bg-purple-600/15 blur-[140px]" />
      </div>
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_center,transparent_0,#050505_70%)]" />

      <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 py-16 md:py-24">
        {/* Hero */}
        <header className="flex w-full max-w-4xl flex-col items-center gap-6 text-center animate-fade-in">
          <div className="group relative">
            <div className="absolute -inset-4 rounded-full bg-purple-600/25 opacity-40 blur-3xl transition-opacity duration-700 group-hover:opacity-100" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-xl shadow-purple-500/20">
              <span className="font-[Bricolage_Grotesque,serif] text-3xl font-bold text-white">A</span>
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="font-[Bricolage_Grotesque,serif] text-5xl font-bold tracking-tight text-white md:text-7xl">
              Academy{" "}
              <span className="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                OS
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg font-light leading-relaxed text-zinc-400 md:text-xl">
              The white-label operating system for{" "}
              <span className="text-zinc-200">sports academies, gyms, and coaching centres</span>.
              Give every owner a branded portal, online registration, fees, batches, and WhatsApp
              alerts — without hiring a tech team.
            </p>
          </div>

          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-8 py-3.5 font-semibold text-black shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 hover:brightness-110 active:scale-95"
            >
              <WhatsAppIcon />
              WhatsApp {settings.contact_whatsapp}
            </a>
            <a
              href={emailUrl}
              className="rounded-full bg-zinc-100 px-8 py-3.5 font-semibold text-zinc-950 shadow-lg shadow-white/10 transition-all hover:scale-105 hover:bg-white active:scale-95"
            >
              Email {settings.contact_email}
            </a>
            <Link
              to="/auth"
              className="rounded-full border border-zinc-800 bg-zinc-900 px-8 py-3.5 font-medium text-zinc-100 transition-all hover:bg-zinc-800"
            >
              Log in
            </Link>
          </div>


          <div className="flex items-center gap-2 pt-4 text-xs font-medium uppercase tracking-widest text-zinc-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            No academy configured for this URL
          </div>
        </header>

        {/* Product proof */}
        <section className="mt-24 grid w-full max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="group rounded-3xl border border-zinc-800/60 bg-zinc-900/30 p-6 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-900/60"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div
                className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${f.iconWrap}`}
              >
                {f.icon}
              </div>
              <h3 className="mb-2 font-semibold text-zinc-100">{f.title}</h3>
              <p className="text-sm leading-relaxed text-zinc-500">{f.body}</p>
            </div>
          ))}
        </section>

        {/* Who it's for */}
        <section className="mt-24 grid w-full max-w-5xl grid-cols-1 gap-4 md:grid-cols-3">
          {AUDIENCES.map((a) => (
            <div
              key={a.title}
              className="rounded-3xl border border-zinc-800/60 bg-gradient-to-b from-zinc-900/50 to-transparent p-6"
            >
              <div className={`text-xs font-semibold uppercase tracking-widest ${a.accent}`}>
                {a.eyebrow}
              </div>
              <h3 className="mt-2 font-[Bricolage_Grotesque,serif] text-2xl font-semibold text-white">
                {a.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{a.body}</p>
            </div>
          ))}
        </section>

        {/* Onboarding steps */}
        <section className="mt-24 w-full max-w-5xl">
          <div className="mb-8 text-center">
            <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              How it works
            </div>
            <h2 className="mt-2 font-[Bricolage_Grotesque,serif] text-3xl font-bold text-white md:text-4xl">
              Live in 30 minutes
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative rounded-3xl border border-zinc-800/60 bg-zinc-900/30 p-6">
                <div className="mb-3 font-[Bricolage_Grotesque,serif] text-4xl font-bold text-zinc-800">
                  0{i + 1}
                </div>
                <h3 className="font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing strip */}
        <div className="mt-24 flex w-full max-w-4xl flex-col items-center justify-between gap-4 border-y border-zinc-800 px-4 py-6 md:flex-row">
          <div className="flex items-center gap-3 text-sm text-zinc-300">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
            <span className="font-medium">Zero setup fees. Cancel anytime.</span>
          </div>
          <div className="font-[Bricolage_Grotesque,serif] text-sm italic text-zinc-500">
            Starts at <span className="font-semibold not-italic text-zinc-100">₹2,000/mo</span> per academy
          </div>
        </div>

        {/* Conversion */}
        <section className="mt-24 w-full max-w-2xl rounded-[3rem] border border-zinc-800 bg-gradient-to-b from-zinc-900 to-transparent p-10 text-center md:p-12">
          <h2 className="mb-4 font-[Bricolage_Grotesque,serif] text-3xl font-bold text-white">
            Ready to digitise your academy?
          </h2>
          <p className="mb-8 text-zinc-400">
            Whether you run a single-court gym or a multi-location academy, we'll set you up with a
            branded portal you own end-to-end.
          </p>
          <div className="mx-auto flex max-w-sm flex-col gap-3">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-6 py-4 font-bold text-black transition-all hover:brightness-110"
            >
              <WhatsAppIcon />
              Chat on WhatsApp · {settings.contact_whatsapp}
            </a>
            <a
              href={emailUrl}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 px-6 py-4 font-semibold text-zinc-100 transition-all hover:bg-zinc-800"
            >
              Email {settings.contact_email}
            </a>
            <Link
              to="/auth"
              className="text-xs text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-300"
            >
              Existing owner? Sign in →
            </Link>
          </div>

        </section>

        <footer className="mt-24 text-[10px] uppercase tracking-widest text-zinc-600">
          Academy OS · Built for performance
        </footer>
      </div>
    </div>
  );
}

/* ─── Content ─────────────────────────────────────────── */

const FEATURES = [
  {
    title: "Online registration",
    body: "Branded intake forms with photo, batch and fee-plan pickers. Auto-generated receipts.",
    iconWrap: "bg-purple-500/10 text-purple-400",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    title: "Fee management",
    body: "Monthly cycles, pending / overdue chips, UPI receipts, and one-click WhatsApp reminders.",
    iconWrap: "bg-indigo-500/10 text-indigo-400",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    title: "WhatsApp reminders",
    body: "Chase pending fees and share schedule updates on the app your students already use.",
    iconWrap: "bg-emerald-500/10 text-emerald-400",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
  },
  {
    title: "Batches & attendance",
    body: "Multi-batch, multi-centre scheduling with a coach-friendly attendance view.",
    iconWrap: "bg-sky-500/10 text-sky-400",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
];

const AUDIENCES = [
  {
    eyebrow: "For coaches",
    accent: "text-purple-400",
    title: "Sports academies",
    body: "Cricket, football, tennis, chess — anywhere you run batches and collect monthly fees.",
  },
  {
    eyebrow: "For owners",
    accent: "text-emerald-400",
    title: "Gyms & fitness studios",
    body: "Members instead of students, plans instead of batches, trainers instead of coaches — same OS.",
  },
  {
    eyebrow: "For teachers",
    accent: "text-sky-400",
    title: "Coaching centres",
    body: "Tuition classes with structured curricula, small groups, and predictable billing.",
  },
];

const STEPS = [
  {
    title: "Share your details",
    body: "Name, niche, colours, fee plans, and your UPI ID. We build the branded portal from that.",
  },
  {
    title: "We onboard you",
    body: "Custom subdomain, logo, and site content go live. You get an owner login and a short walkthrough.",
  },
  {
    title: "Start collecting",
    body: "Send the registration link to parents/members. Manage everything from one dashboard.",
  },
];

function WhatsAppIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.484 8.412-.003 6.557-5.338 11.892-11.893 11.892-1.997-.001-3.951-.5-5.688-1.448l-6.309 1.656zm6.224-3.82c1.516.903 3.136 1.379 4.793 1.38h.005c5.331 0 9.673-4.341 9.676-9.674 0-2.584-1.005-5.013-2.829-6.837-1.826-1.826-4.253-2.831-6.834-2.831-5.334 0-9.673 4.341-9.676 9.674-.001 1.887.544 3.723 1.574 5.337l-.999 3.65 3.734-.98z" />
    </svg>
  );
}
