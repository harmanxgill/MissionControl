"use client";

import { useEffect, useRef, useState } from "react";
import type { DroneJobInput, FlightResult } from "@/types/job";

interface Props {
  input: DroneJobInput;
  result?: FlightResult | null;
  animate?: boolean;
}

const V = 1000;
const DURATION = 4500; // ms — total flight animation time

function sx(x: number) { return x; }
function sy(y: number) { return V - y; }
function pointsAttr(pts: [number, number][]) {
  return pts.map(([x, y]) => `${sx(x)},${sy(y)}`).join(" ");
}

export default function FlightMap({ input, result, animate = true }: Props) {
  const pathRef = useRef<SVGPolylineElement>(null);
  const rafRef = useRef<number>(0);
  const [progress, setProgress] = useState(0);   // 0 → 1
  const [pathLen, setPathLen] = useState(0);
  const [arrived, setArrived] = useState(false);
  const [replayKey, setReplayKey] = useState(0);

  const waypoints = result?.waypoints as [number, number][] | undefined;
  const total = waypoints?.length ?? 0;
  const droneIdx = Math.min(total - 1, Math.floor(progress * total));

  // Measure SVG path length once waypoints render
  useEffect(() => {
    if (!pathRef.current || !total) return;
    // rAF ensures the polyline is in the DOM and measured after paint
    const id = requestAnimationFrame(() => {
      if (pathRef.current) setPathLen(pathRef.current.getTotalLength());
    });
    return () => cancelAnimationFrame(id);
  }, [waypoints]); // eslint-disable-line react-hooks/exhaustive-deps

  // rAF-based animation — time-driven so it always reaches t=1
  useEffect(() => {
    if (!animate || !total) return;
    setProgress(0);
    setArrived(false);
    cancelAnimationFrame(rafRef.current);

    const startTime = performance.now();

    function frame(now: number) {
      const t = Math.min(1, (now - startTime) / DURATION);
      setProgress(t);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        setProgress(1);
        setArrived(true);
      }
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate, total, replayKey]); // replayKey triggers replay

  const dronePos = waypoints?.[droneIdx] as [number, number] | undefined;

  return (
    <div className="relative w-full overflow-hidden" style={{ backgroundColor: "#060a0f" }}>
      <svg
        viewBox={`0 0 ${V} ${V}`}
        className="w-full"
        style={{ aspectRatio: "1" }}
        aria-label="Flight simulation map"
      >
        {/* Grid */}
        {Array.from({ length: 10 }, (_, i) => (i + 1) * 100).map((v) => (
          <g key={v}>
            <line x1={v} y1={0} x2={v} y2={V} stroke="#0f1c29" strokeWidth="1" />
            <line x1={0} y1={v} x2={V} y2={v} stroke="#0f1c29" strokeWidth="1" />
          </g>
        ))}

        {/* Obstacles */}
        {input.obstacles.map((obs, i) => (
          <g key={i}>
            {/* Filled danger zone */}
            <circle
              cx={sx(obs.x)} cy={sy(obs.y)} r={obs.radius}
              fill="rgba(255,58,58,0.07)" stroke="#ff3a3a"
              strokeWidth="1.5" strokeDasharray="6 3"
            />
            {/* Crosshair lines */}
            <line x1={sx(obs.x) - obs.radius * 0.4} y1={sy(obs.y)}
                  x2={sx(obs.x) + obs.radius * 0.4} y2={sy(obs.y)}
                  stroke="#ff3a3a" strokeWidth="1" opacity="0.5" />
            <line x1={sx(obs.x)} y1={sy(obs.y) - obs.radius * 0.4}
                  x2={sx(obs.x)} y2={sy(obs.y) + obs.radius * 0.4}
                  stroke="#ff3a3a" strokeWidth="1" opacity="0.5" />
            <circle cx={sx(obs.x)} cy={sy(obs.y)} r={4}
                    fill="#ff3a3a" opacity="0.6" />
          </g>
        ))}

        {/* Ghost direct path */}
        <line
          x1={sx(input.start.x)} y1={sy(input.start.y)}
          x2={sx(input.destination.x)} y2={sy(input.destination.y)}
          stroke="#1a2840" strokeWidth="1" strokeDasharray="8 6"
        />

        {/* Computed flight path — draws progressively */}
        {waypoints && (
          <polyline
            ref={pathRef}
            points={pointsAttr(waypoints)}
            fill="none"
            stroke="#00ff87"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.85"
            style={
              pathLen > 0
                ? {
                    strokeDasharray: pathLen,
                    strokeDashoffset: pathLen * (1 - progress),
                    transition: "none",
                  }
                : { strokeDasharray: pathLen, strokeDashoffset: pathLen }
            }
          />
        )}

        {/* Destination marker — pulses on arrival */}
        <circle
          cx={sx(input.destination.x)} cy={sy(input.destination.y)}
          r={arrived ? 20 : 14}
          fill={arrived ? "#ffb800" : "#ffb800"}
          opacity={arrived ? 1 : 0.85}
          style={{ transition: "r 0.3s ease, opacity 0.3s ease" }}
        />
        {/* Arrival ripple */}
        {arrived && (
          <circle
            cx={sx(input.destination.x)} cy={sy(input.destination.y)}
            r={36} fill="none" stroke="#ffb800" strokeWidth="1.5" opacity="0.3"
          />
        )}
        <text
          x={sx(input.destination.x)} y={sy(input.destination.y) + 5}
          textAnchor="middle" fontSize="12" fontWeight="bold"
          fill="#060a0f" fontFamily="monospace"
        >
          D
        </text>

        {/* Start marker */}
        <circle cx={sx(input.start.x)} cy={sy(input.start.y)} r={14}
                fill="#00ff87" opacity="0.9" />
        <text
          x={sx(input.start.x)} y={sy(input.start.y) + 5}
          textAnchor="middle" fontSize="12" fontWeight="bold"
          fill="#060a0f" fontFamily="monospace"
        >
          S
        </text>

        {/* Drone icon */}
        {dronePos && !arrived && (
          <g transform={`translate(${sx(dronePos[0])},${sy(dronePos[1])})`}>
            <circle r={20} fill="rgba(56,200,240,0.15)" />
            <polygon points="0,-13 9,9 0,4 -9,9"
                     fill="#38c8f0" stroke="#38c8f0" strokeWidth="1" />
            <line x1="-11" y1="-4" x2="-20" y2="-11" stroke="#38c8f0" strokeWidth="2" />
            <line x1="11"  y1="-4" x2="20"  y2="-11" stroke="#38c8f0" strokeWidth="2" />
            <circle cx={-20} cy={-11} r={5} fill="none" stroke="#38c8f0" strokeWidth="1.5" opacity="0.7" />
            <circle cx={20}  cy={-11} r={5} fill="none" stroke="#38c8f0" strokeWidth="1.5" opacity="0.7" />
          </g>
        )}

        {/* Arrival state: drone merges into destination */}
        {arrived && (
          <g transform={`translate(${sx(input.destination.x)},${sy(input.destination.y)})`}>
            <circle r={28} fill="rgba(255,184,0,0.12)" />
          </g>
        )}

        {/* ARRIVED label */}
        {arrived && (
          <text
            x={sx(input.destination.x)}
            y={sy(input.destination.y) - 30}
            textAnchor="middle"
            fontSize="18"
            fontWeight="bold"
            fill="#ffb800"
            fontFamily="monospace"
            letterSpacing="3"
          >
            ✓ ARRIVED
          </text>
        )}
      </svg>

      {/* Progress bar */}
      {animate && waypoints && (
        <div className="absolute bottom-0 left-0 right-0 h-px" style={{ backgroundColor: "#0f1c29" }}>
          <div
            className="h-full"
            style={{
              width: `${progress * 100}%`,
              backgroundColor: arrived ? "#ffb800" : "#00ff87",
              transition: "width 0.032s linear, background-color 0.3s",
            }}
          />
        </div>
      )}

      {/* Bottom bar: legend + replay */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs" style={{ color: "#2e4a5f" }}>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "#00ff87" }} />
            START
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "#ffb800" }} />
            DEST
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4" style={{ backgroundColor: "#00ff87" }} />
            ROUTE
          </span>
        </div>

        {animate && waypoints && (
          <button
            onClick={() => setReplayKey((k) => k + 1)}
            className="text-xs px-2 py-0.5 border"
            style={{
              color: "#2e4a5f",
              borderColor: "#1a2840",
              backgroundColor: "transparent",
              fontFamily: "monospace",
              letterSpacing: "0.1em",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.color = "#38c8f0";
              (e.target as HTMLElement).style.borderColor = "#38c8f0";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.color = "#2e4a5f";
              (e.target as HTMLElement).style.borderColor = "#1a2840";
            }}
          >
            ▶ REPLAY
          </button>
        )}
      </div>
    </div>
  );
}
