import type { JobStats } from "@/types/job";

export default function StatsCards({ stats }: { stats: JobStats }) {
  return (
    <div className="hud-panel flex items-stretch divide-x divide-hud-border">
      <MetricCell label="TOTAL" value={stats.total} valueClass="text-hud-cyan" />
      <MetricCell label="QUEUED" value={stats.queued} valueClass="text-hud-text" />
      <MetricCell label="PROCESSING" value={stats.processing} valueClass="text-hud-amber" />
      <MetricCell label="COMPLETED" value={stats.completed} valueClass="text-hud-green" />
      <MetricCell label="FAILED" value={stats.failed} valueClass="text-hud-red" />
    </div>
  );
}

function MetricCell({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: number;
  valueClass: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-3 gap-1">
      <span className="hud-label">{label}</span>
      <span className={`text-2xl font-bold tabular-nums ${valueClass}`}>
        {String(value).padStart(2, "0")}
      </span>
    </div>
  );
}
