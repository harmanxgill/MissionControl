"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Job, JobStats } from "@/types/job";
import StatsCards from "@/components/StatsCards";
import JobSubmitForm from "@/components/JobSubmitForm";
import JobsTable from "@/components/JobsTable";
import JobDrawer from "@/components/JobDrawer";

const POLL_INTERVAL = 4000;

const DEFAULT_STATS: JobStats = { total: 0, queued: 0, processing: 0, completed: 0, failed: 0 };

function useClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    function tick() {
      const now = new Date();
      const hh = String(now.getUTCHours()).padStart(2, "0");
      const mm = String(now.getUTCMinutes()).padStart(2, "0");
      const ss = String(now.getUTCSeconds()).padStart(2, "0");
      setTime(`${hh}:${mm}:${ss}Z`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export default function Dashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<JobStats>(DEFAULT_STATS);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clock = useClock();

  const refresh = useCallback(async () => {
    try {
      const [jobList, jobStats] = await Promise.all([api.listJobs(), api.getStats()]);
      setJobs(jobList);
      setStats(jobStats);
      setSelectedJob((prev) => {
        if (!prev) return null;
        return jobList.find((j) => j.id === prev.id) ?? prev;
      });
    } catch {
      // silently ignore transient network errors during polling
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh]);

  function handleJobCreated() {
    refresh();
  }

  function handleSelect(job: Job) {
    setSelectedJob(job);
  }

  function handleCloseDrawer() {
    setSelectedJob(null);
  }

  return (
    <div className="space-y-4">
      {/* Top status bar */}
      <div className="hud-panel flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="hud-label">SYS TIME</span>
            <span className="text-xs font-bold text-hud-cyan tabular-nums">{clock}</span>
          </div>
          <span className="text-hud-dim text-xs">│</span>
          <div className="flex items-center gap-2">
            <span className="hud-label">POLL INTERVAL</span>
            <span className="text-xs text-hud-text">{POLL_INTERVAL / 1000}S</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-hud-cyan blink text-sm">◈</span>
          <span className="text-xs tracking-widest text-hud-cyan uppercase font-bold">
            FLIGHT OPS ACTIVE
          </span>
        </div>
      </div>

      {/* Stats */}
      {!loading && <StatsCards stats={stats} />}
      {loading && (
        <div className="hud-panel px-4 py-3 flex items-center gap-3">
          <span className="text-hud-amber animate-pulse text-xs tracking-widest">
            ▶ LOADING TELEMETRY DATA...
          </span>
        </div>
      )}

      {/* Section divider */}
      <div className="hud-divider">
        <span>── OPERATIONS ──────────────────────────────────</span>
      </div>

      {/* Two-column layout: form + table */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <JobSubmitForm onCreated={handleJobCreated} />
        </div>
        <div className="lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="hud-label">SIMULATION QUEUE // {jobs.length} RECORDS</span>
            <span className="text-xs text-hud-dim">AUTO-REFRESH: {POLL_INTERVAL / 1000}S</span>
          </div>
          <JobsTable jobs={jobs} onSelect={handleSelect} />
        </div>
      </div>

      {/* Job details drawer */}
      {selectedJob && (
        <JobDrawer job={selectedJob} onClose={handleCloseDrawer} onUpdate={refresh} />
      )}
    </div>
  );
}
