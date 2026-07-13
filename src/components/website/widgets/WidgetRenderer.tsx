import { lazy, Suspense } from "react";
import type { PublicAcademyBundle, WidgetKey } from "@/lib/mc-website-engine";
import { WidgetCard, EmptyLine } from "./WidgetCard";
import { ListWidget } from "./ListWidget";

const LiveMatchWidget = lazy(() =>
  import("./LiveMatchWidget").then((m) => ({ default: m.LiveMatchWidget })),
);

function formatDate(v: unknown) {
  if (!v) return "TBD";
  try {
    return new Date(v as string).toLocaleDateString();
  } catch {
    return String(v);
  }
}

export function WidgetRenderer({
  widgetKey,
  bundle,
}: {
  widgetKey: WidgetKey;
  bundle: PublicAcademyBundle;
}) {
  switch (widgetKey) {
    case "live_match": {
      const live = bundle.upcoming_matches.find(
        (m) => (m.scheduled_date as string) &&
          new Date(m.scheduled_date as string).getTime() <= Date.now() + 3 * 60 * 60 * 1000,
      );
      const slug = (live?.id as string | undefined) ?? null;
      return (
        <Suspense fallback={<WidgetCard title="Live Match"><EmptyLine>Loading…</EmptyLine></WidgetCard>}>
          <LiveMatchWidget academySlug={bundle.academy.slug} liveMatchSlug={slug} />
        </Suspense>
      );
    }
    case "upcoming_matches":
      return (
        <ListWidget
          title="Upcoming Matches"
          items={bundle.upcoming_matches}
          empty="No upcoming matches scheduled."
          render={(m) => (
            <div className="flex items-center justify-between">
              <span>{(m.format as string) ?? "Match"}</span>
              <span className="text-xs text-muted-foreground">
                {formatDate(m.scheduled_date)}
              </span>
            </div>
          )}
        />
      );
    case "recent_results":
      return (
        <ListWidget
          title="Recent Results"
          items={bundle.recent_results}
          empty="No results yet."
          render={(m) => (
            <div>
              <p className="text-sm">{(m.result as string) ?? "Result recorded"}</p>
              <p className="text-xs text-muted-foreground">{formatDate(m.scheduled_date)}</p>
            </div>
          )}
        />
      );
    case "academy_records":
      return (
        <ListWidget
          title="Academy Records"
          items={bundle.academy_records}
          empty="No records set yet."
          render={(r) => (
            <div className="flex items-center justify-between">
              <span className="capitalize">
                {String(r.record_type ?? "").replace(/_/g, " ")}
              </span>
              <span className="font-semibold">{String(r.record_value ?? "—")}</span>
            </div>
          )}
        />
      );
    case "hall_of_fame":
      return (
        <ListWidget
          title="Hall Of Fame"
          items={bundle.hall_of_fame}
          empty="No inductees yet."
          render={(h) => (
            <div>
              <p className="font-medium">{String(h.player_name ?? h.name ?? "Player")}</p>
              <p className="text-xs text-muted-foreground">
                {String(h.category ?? h.achievement ?? "")}
              </p>
            </div>
          )}
        />
      );
    case "recognition_wall":
    case "player_of_month":
      return (
        <ListWidget
          title={widgetKey === "player_of_month" ? "Player Of The Month" : "Recognition Wall"}
          items={bundle.recognitions}
          empty="No recognitions published yet."
          render={(r) => (
            <div>
              <p className="font-medium">{String(r.title ?? r.award_type ?? "Award")}</p>
              <p className="text-xs text-muted-foreground">
                {String(r.recipient_name ?? "")}
              </p>
            </div>
          )}
        />
      );
    case "top_run_scorer":
    case "top_wicket_taker":
    case "tournament_table":
    case "orange_cap":
    case "purple_cap":
    case "upcoming_events":
    default:
      return (
        <WidgetCard title={widgetKey.replace(/_/g, " ")}>
          <EmptyLine>Coming soon — sourced from existing engines.</EmptyLine>
        </WidgetCard>
      );
  }
}
