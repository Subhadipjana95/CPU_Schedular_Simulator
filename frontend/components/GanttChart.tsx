"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GanttSegment } from "@/lib/api";

interface Props {
  ganttChart: GanttSegment[];
}

// Deterministic color palette for up to 20 processes
const COLORS = [
  "bg-indigo-500",  "bg-violet-500", "bg-cyan-500",    "bg-emerald-500",
  "bg-amber-500",   "bg-rose-500",   "bg-pink-500",    "bg-sky-500",
  "bg-teal-500",    "bg-orange-500", "bg-lime-500",    "bg-fuchsia-500",
  "bg-red-500",     "bg-blue-500",   "bg-green-500",   "bg-yellow-500",
  "bg-purple-500",  "bg-indigo-400", "bg-violet-400",  "bg-cyan-400",
];

const TEXT_COLORS = [
  "text-indigo-400",  "text-violet-400", "text-cyan-400",    "text-emerald-400",
  "text-amber-400",   "text-rose-400",   "text-pink-400",    "text-sky-400",
  "text-teal-400",    "text-orange-400", "text-lime-400",    "text-fuchsia-400",
  "text-red-400",     "text-blue-400",   "text-green-400",   "text-yellow-400",
  "text-purple-400",  "text-indigo-300", "text-violet-300",  "text-cyan-300",
];

export function GanttChart({ ganttChart }: Props) {
  if (!ganttChart || ganttChart.length === 0) return null;

  const totalTime = ganttChart[ganttChart.length - 1].end;
  const startTime = ganttChart[0].start;
  const span = totalTime - startTime || 1;

  // Assign a stable color index to each unique PID
  const pidColorMap = new Map<string, number>();
  let colorIdx = 0;
  for (const seg of ganttChart) {
    if (!pidColorMap.has(seg.pid)) {
      pidColorMap.set(seg.pid, colorIdx++ % COLORS.length);
    }
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-white">
          Gantt Chart
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Bars */}
        <div className="relative flex h-14 rounded-lg overflow-hidden border border-slate-700 mb-3">
          {ganttChart.map((seg, i) => {
            const width = ((seg.end - seg.start) / span) * 100;
            const ci = pidColorMap.get(seg.pid) ?? 0;
            return (
              <div
                key={i}
                className={`${COLORS[ci]} flex items-center justify-center text-white text-xs font-bold border-r border-slate-900/30 transition-all group relative`}
                style={{ width: `${width}%` }}
                title={`${seg.pid}: ${seg.start}–${seg.end}`}
              >
                {width > 3 && <span className="truncate px-1">{seg.pid}</span>}
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 border border-slate-700">
                  {seg.pid}: {seg.start} → {seg.end} ({seg.end - seg.start} units)
                </div>
              </div>
            );
          })}
        </div>

        {/* Time markers */}
        <div className="relative flex text-xs text-slate-500 select-none">
          {ganttChart.map((seg, i) => {
            const leftPct = ((seg.start - startTime) / span) * 100;
            const widthPct = ((seg.end - seg.start) / span) * 100;
            return (
              <div
                key={i}
                className="absolute flex justify-between"
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              >
                <span>{seg.start}</span>
                {i === ganttChart.length - 1 && (
                  <span className="absolute right-0">{seg.end}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-3">
          {Array.from(pidColorMap.entries()).map(([pid, ci]) => (
            <div key={pid} className="flex items-center gap-1.5 text-xs">
              <div className={`w-3 h-3 rounded-sm ${COLORS[ci]}`} />
              <span className={`font-medium ${TEXT_COLORS[ci]}`}>{pid}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
