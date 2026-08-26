"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlgorithmSelector } from "@/components/AlgorithmSelector";
import { ProcessInputTable } from "@/components/ProcessInputTable";
import { GanttChart } from "@/components/GanttChart";
import { MetricsTable } from "@/components/MetricsTable";
import { runScheduler, type Process, type ScheduleResult } from "@/lib/api";
import { Cpu, Play, AlertCircle, RefreshCcw } from "lucide-react";

const DEFAULT_PROCESSES: Process[] = [
  { pid: "P1", arrival_time: 0, burst_time: 6, priority: 2 },
  { pid: "P2", arrival_time: 1, burst_time: 4, priority: 1 },
  { pid: "P3", arrival_time: 2, burst_time: 2, priority: 3 },
  { pid: "P4", arrival_time: 3, burst_time: 5, priority: 2 },
];

export default function Home() {
  const [algorithm, setAlgorithm] = useState("fcfs");
  const [quantum, setQuantum]     = useState(2);
  const [processes, setProcesses] = useState<Process[]>(DEFAULT_PROCESSES);
  const [result, setResult]       = useState<ScheduleResult | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const showPriority = algorithm === "priority";

  async function handleRun() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const payload = {
        algorithm,
        ...(algorithm === "round_robin" ? { quantum } : {}),
        processes: processes.map((p) => ({
          ...p,
          priority: showPriority ? (p.priority ?? 0) : 0,
        })),
      };
      const res = await runScheduler(payload);
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResult(null);
    setError(null);
    setProcesses(DEFAULT_PROCESSES);
    setAlgorithm("fcfs");
    setQuantum(2);
  }

  return (
    <main className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-10 space-y-8">
        {/* Header */}
        <header className="text-center space-y-3">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30">
              <Cpu className="h-7 w-7 text-indigo-400" />
            </div>
            <h1 className="text-4xl font-extrabold bg-linear-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
              CPU Scheduling Simulator
            </h1>
          </div>
          <p className="text-slate-400 text-sm max-w-xl mx-auto">
            Simulate FCFS, SJF, SRTF, Round Robin, and Priority algorithms.
            Visualise the Gantt chart and per-process metrics in real time.
          </p>
        </header>

        {/* Configuration Card */}
        <Card className="bg-slate-800/40 border-slate-700 backdrop-blur-sm shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              Simulation Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Algorithm selector */}
            <AlgorithmSelector
              algorithm={algorithm}
              quantum={quantum}
              onAlgorithmChange={setAlgorithm}
              onQuantumChange={setQuantum}
            />

            {/* Divider */}
            <div className="border-t border-slate-700" />

            {/* Process table */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-300">
                Processes
                <span className="ml-2 text-xs text-slate-500">
                  ({processes.length} process{processes.length !== 1 ? "es" : ""})
                </span>
              </p>
              <ProcessInputTable
                processes={processes}
                showPriority={showPriority}
                onChange={setProcesses}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleRun}
                disabled={loading || processes.length === 0}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 shadow-lg shadow-indigo-500/20 transition-all"
              >
                {loading ? (
                  <>
                    <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                    Simulating…
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Run Simulation
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                className="border-slate-600 text-slate-400 hover:text-white hover:bg-slate-700"
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300">
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0 text-red-400" />
            <div>
              <p className="font-semibold text-red-300">Simulation Error</p>
              <p className="text-sm text-red-400/80 mt-0.5">{error}</p>
              <p className="text-xs text-red-500/60 mt-1">
                Make sure the backend server is running on{" "}
                <code className="font-mono">localhost:8080</code>.
              </p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats strip */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Avg Waiting Time",    value: result.averages.avg_waiting_time,    color: "text-amber-400" },
                { label: "Avg Turnaround Time", value: result.averages.avg_turnaround_time, color: "text-emerald-400" },
                { label: "Avg Response Time",   value: result.averages.avg_response_time,   color: "text-cyan-400" },
              ].map((s) => (
                <Card key={s.label} className="bg-slate-800/40 border-slate-700 backdrop-blur-sm text-center">
                  <CardContent className="pt-5 pb-4">
                    <p className={`text-3xl font-bold ${s.color}`}>
                      {s.value.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <GanttChart ganttChart={result.gantt_chart} />
            <MetricsTable result={result} />
          </div>
        )}
      </div>
    </main>
  );
}
