"use client";

import { useState } from "react";
import type { DroneJobInput, FlightResult, Job } from "@/types/job";
import { api } from "@/lib/api";
import StatusBadge from "./StatusBadge";
import FlightMap from "./FlightMap";

interface Props {
  job: Job;
  onClose: () => void;
  onUpdate: () => void;
}

function MetricCell({
  label,
  value,
  unit,
  sub,
  valueColor,
}: {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <div className="border border-hud-border bg-hud-bg p-3">
      <p className="hud-label mb-1">{label}</p>
      <p
        className="text-lg font-bold tabular-nums"
        style={{ color: valueColor ?? "#8faabe" }}
      >
        {value}
        {unit && (
          <span className="ml-1 text-xs font-normal text-hud-dim">{unit}</span>
        )}
      </p>
      {sub && <p className="mt-0.5 text-xs text-hud-dim">{sub}</p>}
    </div>
  );
}

export default function JobDrawer({ job, onClose, onUpdate }: Props) {
  const [retrying, setRetrying] = useState(false);

  const input: DroneJobInput | null = (() => {
    try { return JSON.parse(job.input_data); } catch { return null; }
  })();

  const result: FlightResult | null = (() => {
    if (!job.result) return null;
    try { return JSON.parse(job.result); } catch { return null; }
  })();

  async function handleRetry() {
    setRetrying(true);
    try {
      await api.retryJob(job.id);
      onUpdate();
    } finally {
      setRetrying(false);
    }
  }

  function formatTime(secs: number) {
    if (secs < 60) return `${secs}S`;
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}M ${s}S`;
  }

  function fmtTimestamp(iso: string): string {
    const d = new Date(iso);
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    const ss = String(d.getUTCSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}Z`;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/70"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-hud-border font-mono"
        style={{ backgroundColor: "#060a0f" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hud-border px-5 py-3">
          <div className="flex-1 min-w-0">
            <p className="hud-label mb-0.5">MISSION RECORD</p>
            <h2 className="truncate text-sm font-bold text-hud-text uppercase">
              {job.title}
            </h2>
            <p className="text-xs text-hud-dim mt-0.5">
              CREATED: {fmtTimestamp(job.created_at)}
              {job.retry_count > 0 && (
                <span className="ml-2 text-hud-amber">RETRY #{job.retry_count}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 ml-3">
            <StatusBadge status={job.status} />
            <button
              onClick={onClose}
              className="text-hud-dim hover:text-hud-text border border-hud-border px-2 py-1 text-xs"
              aria-label="Close drawer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {input && (
            <>
              {/* Flight map */}
              <div className="p-4 border-b border-hud-border">
                <div className="hud-divider mb-3">
                  <span>── FLIGHT TELEMETRY ──</span>
                </div>
                <FlightMap
                  input={input}
                  result={result}
                  animate={job.status === "completed"}
                />
              </div>

              {/* Route summary */}
              <div className="border-b border-hud-border px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="hud-label">ORIGIN:</span>
                  <span style={{ color: "#00ff87" }} className="tabular-nums">
                    ({input.start.x}, {input.start.y})
                  </span>
                  <span className="text-hud-dim">→</span>
                  <span className="hud-label">DEST:</span>
                  <span style={{ color: "#ffb800" }} className="tabular-nums">
                    ({input.destination.x}, {input.destination.y})
                  </span>
                  <span className="text-hud-dim ml-auto">
                    VEL: {input.speed} U/S
                    &nbsp;·&nbsp;
                    {input.obstacles.length} OBS
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Simulation Results */}
          {result && (
            <div className="border-b border-hud-border px-4 py-4">
              <div className="hud-divider mb-3">
                <span>── SIMULATION RESULTS ──</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <MetricCell
                  label="TOTAL DISTANCE"
                  value={result.total_distance.toLocaleString()}
                  unit="UNITS"
                  sub={`DIRECT: ${result.straight_line_distance.toLocaleString()} UNITS`}
                  valueColor="#00ff87"
                />
                <MetricCell
                  label="FLIGHT TIME"
                  value={formatTime(result.time_taken_seconds)}
                  sub={`${result.time_taken_seconds}S ELAPSED`}
                  valueColor="#00ff87"
                />
                <MetricCell
                  label="FUEL USED"
                  value={result.fuel_used.toLocaleString()}
                  unit="L"
                  sub={`SPEED: ${input?.speed} U/S`}
                  valueColor="#38c8f0"
                />
                <MetricCell
                  label="ROUTE EFFICIENCY"
                  value={result.route_efficiency}
                  unit="%"
                  sub={result.route_efficiency >= 90 ? "NEAR-OPTIMAL" : "DETOUR REQUIRED"}
                  valueColor={result.route_efficiency >= 90 ? "#00ff87" : "#ffb800"}
                />
                <MetricCell
                  label="WAYPOINTS"
                  value={result.waypoint_count.toLocaleString()}
                  sub="PATH NODES GENERATED"
                  valueColor="#38c8f0"
                />
                <MetricCell
                  label="OBSTACLES AVOIDED"
                  value={result.obstacles_avoided}
                  sub="SUCCESSFULLY AVOIDED"
                  valueColor="#00ff87"
                />
              </div>
            </div>
          )}

          {/* Processing placeholder */}
          {job.status === "processing" && !result && (
            <div className="flex flex-col items-center gap-3 px-4 py-10">
              <span className="text-hud-amber animate-pulse text-xs tracking-widest uppercase">
                ▶ SIMULATING FLIGHT PATH...
              </span>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-1 w-6 bg-hud-amber"
                    style={{
                      animation: `blink 1s step-end ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Queued placeholder */}
          {job.status === "queued" && (
            <div className="flex flex-col items-center gap-2 px-4 py-10">
              <span className="text-xs text-hud-dim tracking-widest uppercase">
                [QUEUED] — AWAITING DISPATCH...
              </span>
            </div>
          )}

          {/* Error */}
          {job.error_message && (
            <div className="mx-4 mb-4 mt-4 border border-hud-red bg-hud-bg p-3">
              <p className="hud-label mb-1 text-hud-red">FAULT RECORD</p>
              <p className="text-xs text-hud-red">{job.error_message}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {job.status === "failed" && (
          <div className="border-t border-hud-border px-5 py-3">
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="w-full py-2.5 text-xs font-bold uppercase tracking-widest disabled:opacity-40"
              style={{ backgroundColor: "#ffb800", color: "#060a0f" }}
            >
              {retrying ? "▶ RETRYING..." : "▶ RETRY SIMULATION"}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
