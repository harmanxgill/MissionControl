"use client";

import type { DroneJobInput, FlightResult, Job } from "@/types/job";
import StatusBadge from "./StatusBadge";

interface Props {
  jobs: Job[];
  onSelect: (job: Job) => void;
}

function parseInput(raw: string): DroneJobInput | null {
  try { return JSON.parse(raw); } catch { return null; }
}

function parseResult(raw: string | null): FlightResult | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

const rowBorderClass: Record<string, string> = {
  processing: "border-l-2 border-l-[#ffb800]",
  completed: "border-l-2 border-l-[#00ff87]",
  failed: "border-l-2 border-l-[#ff3a3a]",
  queued: "border-l-2 border-l-[#2e4a5f]",
};

export default function JobsTable({ jobs, onSelect }: Props) {
  if (jobs.length === 0) {
    return (
      <div className="hud-panel flex h-40 items-center justify-center border-dashed">
        <span className="text-xs text-hud-dim tracking-widest uppercase">
          NO SIMULATIONS — LAUNCH ONE FROM THE FORM
        </span>
      </div>
    );
  }

  return (
    <div className="hud-panel overflow-hidden">
      <table className="min-w-full text-xs font-mono">
        <thead>
          <tr className="border-b border-hud-border">
            <th className="px-3 py-2 text-left hud-label w-8">#</th>
            <th className="px-3 py-2 text-left hud-label">MISSION ID</th>
            <th className="px-3 py-2 text-left hud-label">STATUS</th>
            <th className="hidden px-3 py-2 text-left hud-label sm:table-cell">ROUTE</th>
            <th className="hidden px-3 py-2 text-left hud-label sm:table-cell">VELOCITY</th>
            <th className="hidden px-3 py-2 text-right hud-label md:table-cell">DIST</th>
            <th className="px-3 py-2 text-right hud-label">TIME</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job, idx) => {
            const input = parseInput(job.input_data);
            const result = parseResult(job.result);
            return (
              <tr
                key={job.id}
                onClick={() => onSelect(job)}
                className={`cursor-pointer border-b border-hud-border transition-colors hover:bg-hud-surface/50 ${rowBorderClass[job.status] ?? ""}`}
              >
                <td className="px-3 py-2 text-hud-dim tabular-nums">
                  {String(idx + 1).padStart(2, "0")}
                </td>
                <td className="px-3 py-2">
                  <span className="text-hud-text max-w-[140px] truncate block">{job.title}</span>
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={job.status} />
                </td>
                <td className="hidden px-3 py-2 text-hud-dim sm:table-cell">
                  {input ? (
                    <span>
                      <span style={{ color: "#00ff87" }}>
                        ({input.start.x},{input.start.y})
                      </span>
                      <span className="text-hud-dim">→</span>
                      <span style={{ color: "#ffb800" }}>
                        ({input.destination.x},{input.destination.y})
                      </span>
                    </span>
                  ) : "—"}
                </td>
                <td className="hidden px-3 py-2 text-hud-text tabular-nums sm:table-cell">
                  {input ? <span>{input.speed} U/S</span> : "—"}
                </td>
                <td className="hidden px-3 py-2 text-right text-hud-text tabular-nums md:table-cell">
                  {result ? (
                    <span>{result.total_distance.toLocaleString()}</span>
                  ) : "—"}
                </td>
                <td className="px-3 py-2 text-right text-hud-dim tabular-nums">
                  {fmtTime(job.created_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
