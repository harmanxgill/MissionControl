"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Obstacle } from "@/types/job";
import FlightMap from "./FlightMap";

interface Props {
  onCreated: () => void;
}

const DEFAULTS = {
  title: "",
  startX: 100,
  startY: 100,
  destX: 850,
  destY: 850,
  speed: 75,
};

export default function JobSubmitForm({ onCreated }: Props) {
  const [title, setTitle] = useState(DEFAULTS.title);
  const [startX, setStartX] = useState(DEFAULTS.startX);
  const [startY, setStartY] = useState(DEFAULTS.startY);
  const [destX, setDestX] = useState(DEFAULTS.destX);
  const [destY, setDestY] = useState(DEFAULTS.destY);
  const [speed, setSpeed] = useState(DEFAULTS.speed);
  const [obstacles, setObstacles] = useState<Obstacle[]>([
    { x: 400, y: 400, radius: 70 },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  function addObstacle() {
    setObstacles((prev) => [...prev, { x: 500, y: 500, radius: 60 }]);
  }

  function removeObstacle(i: number) {
    setObstacles((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateObstacle(i: number, field: keyof Obstacle, value: number) {
    setObstacles((prev) =>
      prev.map((o, idx) => (idx === i ? { ...o, [field]: value } : o))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.createJob({
        title: title || `Flight (${startX},${startY}) → (${destX},${destY})`,
        input_data: {
          start: { x: startX, y: startY },
          destination: { x: destX, y: destY },
          speed,
          obstacles,
        },
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const previewInput = {
    start: { x: startX, y: startY },
    destination: { x: destX, y: destY },
    speed,
    obstacles,
  };

  return (
    <form onSubmit={handleSubmit} className="hud-panel flex flex-col">
      {/* Header */}
      <div className="border-b border-hud-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-hud-amber text-xs">▶</span>
          <span className="text-xs font-bold tracking-widest text-hud-text uppercase">
            Define Flight Parameters
          </span>
        </div>
        <p className="mt-1 text-xs text-hud-dim">
          GRID: 1000×1000 UNITS // ORIGIN (0,0) = BOTTOM-LEFT
        </p>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4">
        {/* Mission ID */}
        <div>
          <label className="hud-label mb-1">MISSION ID //</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. ALPHA-RECON-01"
            className="hud-input"
          />
        </div>

        {/* Coordinates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="hud-label mb-1">ORIGIN COORDS //</label>
            <div className="flex gap-2">
              <CoordInput label="X" value={startX} onChange={setStartX} />
              <CoordInput label="Y" value={startY} onChange={setStartY} />
            </div>
          </div>
          <div>
            <label className="hud-label mb-1">DEST COORDS //</label>
            <div className="flex gap-2">
              <CoordInput label="X" value={destX} onChange={setDestX} />
              <CoordInput label="Y" value={destY} onChange={setDestY} />
            </div>
          </div>
        </div>

        {/* Speed */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="hud-label">VELOCITY //</label>
            <span className="text-xs font-bold text-hud-amber tabular-nums">
              {speed} U/S
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={10}
              max={300}
              step={5}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="flex-1 h-1 cursor-pointer accent-[#ffb800] bg-hud-border"
              style={{ accentColor: "#ffb800" }}
            />
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-xs text-hud-dim">10 U/S</span>
            <span className="text-xs text-hud-dim">300 U/S</span>
          </div>
        </div>

        {/* Obstacles */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="hud-label">OBSTACLE DATA //</label>
            <button
              type="button"
              onClick={addObstacle}
              className="text-xs text-hud-cyan border border-hud-border px-2 py-0.5 hover:border-hud-cyan hover:text-hud-cyan uppercase tracking-widest"
            >
              + ADD
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {obstacles.map((obs, i) => (
              <div
                key={i}
                className="flex items-center gap-2 border border-hud-border bg-hud-bg px-2 py-1.5"
              >
                <span className="text-xs text-hud-dim w-4 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-xs text-hud-dim">[X:</span>
                <input
                  type="number"
                  value={obs.x}
                  min={0}
                  max={1000}
                  onChange={(e) => updateObstacle(i, "x", Number(e.target.value))}
                  className="w-14 bg-transparent border-b border-hud-border text-xs text-hud-text outline-none text-center tabular-nums focus:border-hud-cyan"
                />
                <span className="text-xs text-hud-dim">] [Y:</span>
                <input
                  type="number"
                  value={obs.y}
                  min={0}
                  max={1000}
                  onChange={(e) => updateObstacle(i, "y", Number(e.target.value))}
                  className="w-14 bg-transparent border-b border-hud-border text-xs text-hud-text outline-none text-center tabular-nums focus:border-hud-cyan"
                />
                <span className="text-xs text-hud-dim">] [R:</span>
                <input
                  type="number"
                  value={obs.radius}
                  min={0}
                  max={500}
                  onChange={(e) => updateObstacle(i, "radius", Number(e.target.value))}
                  className="w-14 bg-transparent border-b border-hud-border text-xs text-hud-text outline-none text-center tabular-nums focus:border-hud-cyan"
                />
                <span className="text-xs text-hud-dim">]</span>
                <button
                  type="button"
                  onClick={() => removeObstacle(i)}
                  className="ml-auto text-xs text-hud-dim hover:text-hud-red"
                  aria-label="Remove obstacle"
                >
                  ✕
                </button>
              </div>
            ))}
            {obstacles.length === 0 && (
              <p className="text-xs text-hud-dim py-1">NO OBSTACLES — DIRECT FLIGHT PATH.</p>
            )}
          </div>
        </div>

        {/* Preview toggle */}
        <button
          type="button"
          onClick={() => setShowPreview((p) => !p)}
          className="w-full border border-dashed border-hud-border py-2 text-xs text-hud-dim hover:border-hud-cyan hover:text-hud-cyan uppercase tracking-widest"
        >
          [ {showPreview ? "HIDE MAP PREVIEW" : "TOGGLE MAP PREVIEW"} ]
        </button>

        {showPreview && (
          <FlightMap input={previewInput} result={null} animate={false} />
        )}

        {error && (
          <p className="text-xs text-hud-red border border-hud-red px-2 py-1.5">
            ✕ FAULT: {error.toUpperCase()}
          </p>
        )}
      </div>

      {/* Submit */}
      <div className="border-t border-hud-border px-4 py-3 mt-auto">
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 text-xs font-bold uppercase tracking-widest disabled:opacity-40"
          style={{ backgroundColor: "#ffb800", color: "#060a0f" }}
        >
          {loading ? "▶ LAUNCHING..." : "▶ LAUNCH SIMULATION"}
        </button>
      </div>
    </form>
  );
}

function CoordInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 flex-1">
      <span className="text-xs text-hud-dim">{label}:</span>
      <input
        type="number"
        value={value}
        min={0}
        max={1000}
        onChange={(e) => onChange(Number(e.target.value))}
        className="hud-input py-1 text-xs tabular-nums"
      />
    </div>
  );
}
