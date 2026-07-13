import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTenant } from "@/lib/tenant-context";
import {
  DEFAULT_WIDGETS,
  WIDGET_LABELS,
  getWebsiteConfig,
  upsertWebsiteConfig,
  type WebsiteConfig,
  type WebsiteTheme,
  type WidgetSlot,
} from "@/lib/mc-website-engine";
import { toast } from "sonner";

export const Route = createFileRoute("/match-center/website")({
  component: WebsiteAdmin,
});

const THEMES: WebsiteTheme[] = ["classic", "modern", "professional", "minimal", "dark"];

function WebsiteAdmin() {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const [config, setConfig] = useState<WebsiteConfig | null>(null);
  const [widgets, setWidgets] = useState<WidgetSlot[]>(DEFAULT_WIDGETS);
  const [theme, setTheme] = useState<WebsiteTheme>("modern");
  const [headline, setHeadline] = useState("");
  const [subheadline, setSubheadline] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    void (async () => {
      const c = await getWebsiteConfig(tenantId);
      if (c) {
        setConfig(c);
        setWidgets(c.widgets?.length ? c.widgets : DEFAULT_WIDGETS);
        setTheme(c.theme);
        setHeadline(c.hero?.headline ?? "");
        setSubheadline(c.hero?.subheadline ?? "");
      }
    })();
  }, [tenantId]);

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...widgets];
    const to = idx + dir;
    if (to < 0 || to >= next.length) return;
    [next[idx], next[to]] = [next[to], next[idx]];
    setWidgets(next.map((w, i) => ({ ...w, order: i })));
  };

  const toggle = (idx: number) => {
    const next = [...widgets];
    next[idx] = { ...next[idx], enabled: !next[idx].enabled };
    setWidgets(next);
  };

  const save = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const saved = await upsertWebsiteConfig(tenantId, {
        theme,
        widgets,
        hero: { headline, subheadline },
      });
      setConfig(saved);
      toast.success("Website updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!tenantId) return <div className="p-8">No academy selected.</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Website Builder</h1>
        <p className="text-sm text-muted-foreground">
          Configure the public site at <code>/academy/{tenant?.slug}</code>. Data is pulled
          live from your existing engines.
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Theme</h2>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`rounded-full border px-3 py-1 text-sm capitalize ${
                theme === t ? "border-primary bg-primary/10" : "border-border"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Hero</h2>
        <input
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="Headline"
          className="mb-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <textarea
          value={subheadline}
          onChange={(e) => setSubheadline(e.target.value)}
          placeholder="Subheadline"
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
          Widgets (reorder & toggle)
        </h2>
        <ul className="space-y-1">
          {widgets.map((w, i) => (
            <li
              key={w.key}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2"
            >
              <span className="text-sm">{WIDGET_LABELS[w.key]}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => move(i, -1)}
                  className="rounded border px-2 py-0.5 text-xs"
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  onClick={() => move(i, 1)}
                  className="rounded border px-2 py-0.5 text-xs"
                  aria-label="Move down"
                >
                  ↓
                </button>
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={w.enabled}
                    onChange={() => toggle(i)}
                  />
                  Show
                </label>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {tenant?.slug ? (
          <a
            href={`/academy/${tenant.slug}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-input px-4 py-2 text-sm"
          >
            Preview
          </a>
        ) : null}
      </div>
    </div>
  );
}
