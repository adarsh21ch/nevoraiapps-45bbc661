import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · Academy OS" },
      { name: "description", content: "Sign in to your academy dashboard." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) navigate({ to: await routeAfterLogin(data.session.user.id) });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Signed in");
    const uid = data.user?.id;
    navigate({ to: uid ? await routeAfterLogin(uid) : "/dashboard" });
  }

  async function routeAfterLogin(uid: string): Promise<"/platform-admin" | "/dashboard"> {
    const { data } = await supabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", uid)
      .maybeSingle();
    return data ? "/platform-admin" : "/dashboard";
  }

  return (
    <div
      className="grid min-h-screen w-full lg:grid-cols-2"
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui" }}
    >
      {/* Left — Stadium visual */}
      <aside className="relative hidden overflow-hidden bg-[#0a0a0a] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 -left-20 h-[500px] w-[500px] rounded-full bg-lime-500/20 blur-[140px]" />
          <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-blue-500/10 blur-[120px]" />
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "linear-gradient(to right,#fff 1px,transparent 1px),linear-gradient(to bottom,#fff 1px,transparent 1px)",
              backgroundSize: "60px 60px",
              maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
            }}
          />
        </div>

        {/* Top — brand */}
        <Link to="/" className="z-10 flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded bg-lime-400 text-sm font-black text-black">
            A
          </div>
          <span
            className="text-lg font-black uppercase tracking-tight"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.02em" }}
          >
            Academy<span className="text-lime-400">OS</span>
          </span>
        </Link>

        {/* Middle — pitch */}
        <div className="z-10 max-w-md space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full border border-lime-500/30 bg-lime-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-lime-400"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-lime-400" />
            </span>
            Coach Dashboard
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-6xl leading-[0.9] tracking-tighter"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            Welcome <br />
            <span className="text-lime-400">back, Coach.</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-zinc-400"
          >
            Sign in to run your academy — registrations, fees, batches and attendance, all in one
            place on your phone.
          </motion.p>

          <motion.ul
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="space-y-2 pt-2"
          >
            {[
              "See new enquiries the moment they arrive",
              "Send fee reminders on WhatsApp with one tap",
              "Mark attendance from the ground",
            ].map((t) => (
              <li key={t} className="flex items-center gap-3 text-sm text-zinc-300">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-lime-400/20 text-lime-400">
                  ✓
                </span>
                {t}
              </li>
            ))}
          </motion.ul>
        </div>

        {/* Bottom — reassurance for offline coaches */}
        <div className="z-10 text-[10px] uppercase tracking-[0.25em] text-white/40">
          Simple. On your phone. In your language soon.
        </div>
      </aside>

      {/* Right — friendly form */}
      <main className="relative flex items-center justify-center bg-white p-6 sm:p-10">
        {/* Mobile-only mini brand strip */}
        <Link to="/" className="absolute left-4 top-4 flex items-center gap-2 lg:hidden">
          <div className="grid h-8 w-8 place-items-center rounded bg-lime-400 text-[13px] font-black text-black">
            A
          </div>
          <span
            className="text-base font-black uppercase tracking-tight text-zinc-900"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            Academy<span className="text-lime-500">OS</span>
          </span>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm space-y-8"
        >
          <div>
            <h1
              className="text-4xl uppercase leading-none tracking-tight text-zinc-900"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              Sign in
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Use the email and password we set up for your academy.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <Field
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
              placeholder="you@academy.com"
            />
            <Field
              id="password"
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
              placeholder="Your password"
            />

            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full items-center justify-center gap-2 rounded-none bg-[#0a0a0a] px-6 py-4 text-sm font-bold uppercase tracking-wider text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-lime-400 hover:text-black disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in →"}
              <span
                aria-hidden
                className="absolute -bottom-1 -right-1 h-full w-full border-b-2 border-r-2 border-[#0a0a0a] transition-colors group-hover:border-lime-400"
              />
            </button>
          </form>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600">
            <div className="font-semibold text-zinc-900">First time here?</div>
            <p className="mt-1 leading-relaxed">
              If your academy isn't set up yet, message us on WhatsApp and we'll create your account
              and walk you through it — no tech skills needed.
            </p>
          </div>

          <div className="text-center text-xs text-zinc-500">
            <Link to="/" className="hover:text-zinc-900">
              ← Back to home
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

function Field({
  id,
  label,
  type,
  autoComplete,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block text-[11px] font-bold uppercase tracking-widest text-zinc-500"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        required
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border-0 border-b-2 border-zinc-200 bg-transparent px-0 py-2.5 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-lime-500"
      />
    </div>
  );
}
