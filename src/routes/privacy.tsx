import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy · AcademyOS" },
      {
        name: "description",
        content: "How AcademyOS handles data for sports academies and their students.",
      },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="font-semibold tracking-tight">
            AcademyOS
          </Link>
          <Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground">
            Terms
          </Link>
        </div>
      </header>
      <article className="max-w-3xl mx-auto px-4 py-12 prose prose-sm md:prose-base">
        <h1>Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">
          This page is maintained by AcademyOS to answer common privacy questions about the
          platform. It is app-owned editable content, not an independent certification.
        </p>

        <h2>What we collect</h2>
        <p>
          AcademyOS stores the information academies enter to run their operations: student
          profiles, guardian contacts, attendance, fees, matches, and communications. Owners and
          admins choose what to enter; parents and students see only what their academy shares with
          them.
        </p>

        <h2>How data is used</h2>
        <p>
          Data is used solely to provide AcademyOS to the academy the data belongs to. We do not
          sell, rent or use academy or student data to train third-party AI models.
        </p>

        <h2>Data isolation</h2>
        <p>
          Every record is scoped to a single tenant (academy). Row-level security in the database
          enforces this boundary — one academy cannot read or write another academy's data.
        </p>

        <h2>Retention</h2>
        <p>
          Data is retained for the life of the account. On account termination, data may be exported
          for 30 days, after which it is permanently deleted.
        </p>

        <h2>Sub-processors</h2>
        <p>
          AcademyOS is built on Lovable Cloud (Supabase). Emails, WhatsApp templates and payment
          references are handled by the academy's own configured providers.
        </p>

        <h2>Contact</h2>
        <p>
          Privacy questions: <a href="mailto:privacy@nevorai.com">privacy@nevorai.com</a>
        </p>
      </article>
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} AcademyOS
      </footer>
    </div>
  );
}
