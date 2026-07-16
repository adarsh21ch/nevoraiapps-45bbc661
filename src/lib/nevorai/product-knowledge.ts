/**
 * NevorAI Product Knowledge Registry
 * ----------------------------------
 * Static, reusable knowledge about the platform's features. This is the
 * "how-to" side of NevorAI (as opposed to the business intelligence
 * queries handled by the Tool Registry).
 *
 * Never exposes source code, tables, RLS policies, or implementation
 * detail — only user-visible behaviour, guides, and troubleshooting.
 *
 * The server injects the matching topic(s) into the system prompt based
 * on the current screen so the assistant can answer product questions
 * without hitting a tool.
 */

export type ProductKnowledgeTopic = {
  id: string;
  title: string;
  /** Route path prefixes this topic is relevant to. */
  screens: string[];
  /** Keywords that should surface this topic (case-insensitive). */
  keywords: string[];
  /** Short summary — always safe to include verbatim in the prompt. */
  summary: string;
  /** Step-by-step guide the assistant can quote. */
  steps?: string[];
  faq?: { q: string; a: string }[];
  troubleshooting?: { symptom: string; fix: string }[];
  bestPractices?: string[];
};

export const PRODUCT_KNOWLEDGE: ProductKnowledgeTopic[] = [
  {
    id: "attendance",
    title: "Attendance",
    screens: ["/dashboard/attendance"],
    keywords: ["attendance", "present", "absent", "mark", "batch attendance"],
    summary:
      "Attendance is captured per batch per session. Owners and coaches can mark players present, absent, or late. Marks feed into engagement reports and parent notifications.",
    steps: [
      "Open Attendance and pick the date + batch.",
      "Tap each player to toggle Present / Absent / Late.",
      "Save. Parents of absentees receive an automation notification (if enabled).",
    ],
    faq: [
      {
        q: "Can I mark attendance for a past date?",
        a: "Yes — pick the date, marks are stored with the session date.",
      },
      {
        q: "Who can mark attendance?",
        a: "Owners, admins, head coaches, and assistant coaches assigned to that batch.",
      },
    ],
    troubleshooting: [
      {
        symptom: "Player missing from the roster",
        fix: "Check that the player is active and assigned to the selected batch under Students → Batches.",
      },
    ],
  },
  {
    id: "fees",
    title: "Fees & Billing",
    screens: ["/dashboard/fees", "/dashboard/billing"],
    keywords: ["fees", "invoice", "payment", "overdue", "billing", "manual payment"],
    summary:
      "Fees generate invoices per student per billing cycle. Owners can send reminders, record manual payments, or let the payment gateway auto-reconcile online payments.",
    steps: [
      "Open Fees to see all invoices grouped by status.",
      "Click an invoice for details, reminder history, and payment log.",
      "Use Record Payment for cash/UPI/bank transfer; the invoice is marked paid.",
    ],
    faq: [
      {
        q: "How do reminders work?",
        a: "Automations dispatch a WhatsApp/SMS reminder N days before/after the due date, based on the reminder policy.",
      },
      {
        q: "Can I edit an issued invoice?",
        a: "Only voiding is supported — void and re-issue to keep the audit trail clean.",
      },
    ],
    troubleshooting: [
      {
        symptom: "Online payment succeeded but invoice still 'due'",
        fix: "Payment verification is asynchronous — check Payment Verification queue. If stuck > 5 min, reconcile manually.",
      },
    ],
  },
  {
    id: "admissions",
    title: "Admissions & Leads",
    screens: ["/dashboard/admissions-review", "/dashboard/registrations"],
    keywords: ["admission", "lead", "registration", "trial", "approve", "reject"],
    summary:
      "Every registration is a lead. Owners review, request more info, or approve to convert a lead into a student.",
    steps: [
      "Open Admissions to see pending leads in the pipeline.",
      "Click a lead to review the form, run the checklist, and message the parent.",
      "Approve to convert into a student and generate the first invoice.",
    ],
    faq: [
      {
        q: "Where do leads come from?",
        a: "Public site registration form, imported CSVs, or leads added manually by staff.",
      },
    ],
  },
  {
    id: "reports",
    title: "Reports",
    screens: ["/dashboard/reports"],
    keywords: ["report", "analytics", "revenue", "engagement", "export"],
    summary:
      "Reports summarize revenue, attendance, and admissions across any date range. Export as CSV.",
    steps: [
      "Pick the report from the sidebar.",
      "Set the date range and any filters.",
      "Use Export CSV for a spreadsheet copy.",
    ],
  },
  {
    id: "communications",
    title: "Communications",
    screens: ["/dashboard/communications"],
    keywords: ["announcement", "message", "campaign", "whatsapp", "sms", "broadcast"],
    summary:
      "Send announcements and campaigns to parents, players, or coaches. Uses the same delivery pipeline as automations.",
    steps: [
      "Open Communications and click New Campaign.",
      "Pick the audience (batch, tag, or custom filter) and channel.",
      "Compose, preview, and send or schedule.",
    ],
    bestPractices: [
      "Keep announcements under 300 characters for WhatsApp readability.",
      "Prefer scheduled sends outside class hours.",
    ],
  },
  {
    id: "automations",
    title: "Automations",
    screens: ["/dashboard/automations", "/dashboard/communications"],
    keywords: ["automation", "workflow", "trigger", "auto reminder"],
    summary:
      "Automations react to platform events (new registration, invoice overdue, absent player) and dispatch a message or task. Toggle each automation on/off from Automations.",
    troubleshooting: [
      {
        symptom: "Automation not firing",
        fix: "Check that the automation is enabled AND the tenant's messaging channel is connected. See the Automation Executions log for failure reason.",
      },
    ],
  },
  {
    id: "subscription",
    title: "Subscription & Plan",
    screens: ["/dashboard/profile", "/dashboard/billing"],
    keywords: ["subscription", "plan", "upgrade", "trial", "downgrade"],
    summary:
      "Subscription controls which features are enabled for the academy. Trials are 14 days; downgrading disables premium features but keeps data intact.",
  },
  {
    id: "students",
    title: "Students & Batches",
    screens: ["/dashboard/students"],
    keywords: ["student", "player", "batch", "roster", "profile"],
    summary:
      "Students belong to one or more batches. Each student has a profile with attendance, fees, and notes visible to their parent and assigned coaches.",
  },
];

function screenMatches(topic: ProductKnowledgeTopic, currentScreen?: string) {
  if (!currentScreen) return false;
  return topic.screens.some((s) => currentScreen === s || currentScreen.startsWith(s + "/"));
}

/** Pick topics relevant to the current screen and/or the user's message. */
export function selectRelevantTopics(opts: {
  currentScreen?: string;
  query?: string;
  limit?: number;
}): ProductKnowledgeTopic[] {
  const limit = opts.limit ?? 3;
  const q = (opts.query ?? "").toLowerCase();

  const scored = PRODUCT_KNOWLEDGE.map((topic) => {
    let score = 0;
    if (screenMatches(topic, opts.currentScreen)) score += 3;
    if (q) {
      for (const kw of topic.keywords) if (q.includes(kw)) score += 2;
      if (q.includes(topic.title.toLowerCase())) score += 1;
    }
    return { topic, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((s) => s.topic);
}

export function renderTopicForPrompt(topic: ProductKnowledgeTopic): string {
  const lines: string[] = [`# ${topic.title}`, topic.summary];
  if (topic.steps?.length) {
    lines.push("## How", ...topic.steps.map((s, i) => `${i + 1}. ${s}`));
  }
  if (topic.faq?.length) {
    lines.push("## FAQ", ...topic.faq.map((f) => `Q: ${f.q}\nA: ${f.a}`));
  }
  if (topic.troubleshooting?.length) {
    lines.push(
      "## Troubleshooting",
      ...topic.troubleshooting.map((t) => `- ${t.symptom} → ${t.fix}`),
    );
  }
  if (topic.bestPractices?.length) {
    lines.push("## Best practices", ...topic.bestPractices.map((b) => `- ${b}`));
  }
  return lines.join("\n");
}

/** Screen → suggested prompt chips. Reused by AskNevorAI + panel welcome. */
export const PAGE_SUGGESTIONS: Array<{
  match: (path: string) => boolean;
  label: string;
  suggestions: string[];
}> = [
  {
    match: (p) => p.startsWith("/dashboard/attendance"),
    label: "Attendance",
    suggestions: [
      "Why is attendance low today?",
      "Compare today's attendance with yesterday",
      "Show absent players",
    ],
  },
  {
    match: (p) => p.startsWith("/dashboard/fees") || p.startsWith("/dashboard/billing"),
    label: "Fees",
    suggestions: [
      "Show pending fees",
      "Send reminders to overdue parents",
      "Revenue summary this month",
    ],
  },
  {
    match: (p) => p.startsWith("/dashboard/admissions") || p.startsWith("/dashboard/registrations"),
    label: "Admissions",
    suggestions: [
      "Which leads need follow-up?",
      "Admission conversion rate this month",
      "Help me approve this admission",
    ],
  },
  {
    match: (p) => p.startsWith("/dashboard/reports"),
    label: "Reports",
    suggestions: ["Explain this report", "Generate a monthly summary", "Compare this to last month"],
  },
  {
    match: (p) => p.startsWith("/dashboard/communications"),
    label: "Communications",
    suggestions: [
      "Draft an announcement",
      "How do I improve engagement?",
      "Which campaigns performed best?",
    ],
  },
  {
    match: (p) => p.startsWith("/dashboard/automations"),
    label: "Automations",
    suggestions: [
      "Why did this automation fail?",
      "Explain this workflow",
      "Which automations ran today?",
    ],
  },
  {
    match: (p) => p.startsWith("/dashboard/students"),
    label: "Students",
    suggestions: ["Who's new this month?", "Show inactive students", "Explain this student profile"],
  },
  {
    match: (p) => p.startsWith("/platform-admin"),
    label: "Platform",
    suggestions: [
      "Platform revenue this week",
      "Top performing academies",
      "Any accounts at risk?",
    ],
  },
];

export function suggestionsForScreen(pathname: string): string[] {
  const hit = PAGE_SUGGESTIONS.find((s) => s.match(pathname));
  return (
    hit?.suggestions ?? [
      "Brief me on today",
      "Who hasn't paid this month?",
      "Today's attendance",
    ]
  );
}
