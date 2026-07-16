import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service · AcademyOS" },
      { name: "description", content: "Terms governing use of AcademyOS by sports academies." },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="font-semibold tracking-tight">
            AcademyOS
          </Link>
          <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
            Privacy
          </Link>
        </div>
      </header>
      <article className="max-w-3xl mx-auto px-4 py-12 prose prose-sm md:prose-base">
        <h1>Terms of Service</h1>
        <p className="text-sm text-muted-foreground">
          These terms govern use of AcademyOS. By creating an academy on AcademyOS you accept them.
        </p>

        <h2>Account</h2>
        <p>
          Each academy account has one or more owners. Owners are responsible for admin invitations,
          for the data entered, and for ensuring appropriate consent from students and guardians.
        </p>

        <h2>Acceptable use</h2>
        <p>
          Do not use AcademyOS to store data unrelated to running a sports academy, to send
          unsolicited communications to non-consenting recipients, or to attempt to access another
          academy's data.
        </p>

        <h2>Payments and trial</h2>
        <p>
          A free trial is offered on new academies. Paid plans are billed monthly and can be
          cancelled at any time. Refunds are handled case-by-case.
        </p>

        <h2>Availability</h2>
        <p>
          AcademyOS aims for high availability but does not guarantee uptime except where an
          Enterprise SLA has been signed.
        </p>

        <h2>Termination</h2>
        <p>
          We may suspend accounts that violate these terms. Owners can close their account at any
          time from the Subscription page.
        </p>

        <h2>Contact</h2>
        <p>
          Legal questions: <a href="mailto:legal@nevorai.com">legal@nevorai.com</a>
        </p>
      </article>
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} AcademyOS
      </footer>
    </div>
  );
}
