import type { JobStatus } from "@/types/job";

const styles: Record<JobStatus, string> = {
  queued: "text-hud-text",
  processing: "text-hud-amber animate-pulse",
  completed: "text-hud-green",
  failed: "text-hud-red",
};

const labels: Record<JobStatus, string> = {
  queued: "[QUEUED]",
  processing: "[PROC..]",
  completed: "[CMPL]",
  failed: "[FAIL]",
};

export default function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={`text-xs font-bold font-mono tracking-widest uppercase ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
