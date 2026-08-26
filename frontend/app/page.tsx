"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlgorithmSelector } from "@/components/AlgorithmSelector";
import { ProcessInputTable } from "@/components/ProcessInputTable";
import { GanttChart } from "@/components/GanttChart";
import { MetricsTable } from "@/components/MetricsTable";
import { ThemeToggle } from "@/components/ThemeToggle";
import { runScheduler, type Process, type ScheduleResult } from "@/lib/api";
import { Cpu, Play, AlertCircle, RefreshCcw } from "lucide-react";

const DEFAULT_PROCESSES: Process[] = [
  { pid: "P1", arrival_time: 0, burst_time: 6, priority: 2 },
  { pid: "P2", arrival_time: 1, burst_time: 4, priority: 1 },
  { pid: "P3", arrival_time: 2, burst_time: 2, priority: 3 },
  { pid: "P4", arrival_time: 3, burst_time: 5, priority: 2 },
];

export default function Home() {
  const [algorithm, setAlgorithm] = useState("FCFS");
  const [quantum, setQuantum]     = useState(2);
  const [processes, setProcesses] = useState<Process[]>(DEFAULT_PROCESSES);
  const [result, setResult]       = useState<ScheduleResult | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const showPriority = algorithm === "PRIORITY";

  async function handleRun() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const payload = {
        algorithm,
        ...(algorithm === "ROUND_ROBIN" ? { quantum } : {}),
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
    setAlgorithm("FCFS");
    setQuantum(2);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="relative mx-auto max-w-6xl px-4 py-10 space-y-8">
        {/* Header */}
        <header className="text-center space-y-3">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl border border-border bg-card">
              <Cpu className="h-6 w-6 text-foreground" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              CPU Scheduling Simulator
            </h1>
          </div>
        </header>

        {/* Configuration Card */}
        <Card size="sm" className="relative">
          <div className="absolute top-3.5 right-3.5 z-10">
            <ThemeToggle />
          </div>
          <CardHeader className="flex items-center justify-center">
            <CardTitle className="text-3xl font-semibold flex items-center gap-2">
              Simulation Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-6 items-stretch">
              {/* Process table */}
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Processes
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({processes.length} process{processes.length !== 1 ? "es" : ""})
                  </span>
                </p>
                <ProcessInputTable
                  processes={processes}
                  showPriority={showPriority}
                  onChange={setProcesses}
                />
              </div>

              {/* Divider */}
              <div className="hidden lg:block w-px bg-border shrink-0 self-stretch" />
              <div className="block lg:hidden h-px bg-border shrink-0 w-full" />

              {/* Actions */}
              <div className="w-full lg:w-72 shrink-0 flex flex-col justify-between gap-6">
                <div>
                  {/* Algorithm selector */}
                  <AlgorithmSelector
                    algorithm={algorithm}
                    quantum={quantum}
                    onAlgorithmChange={setAlgorithm}
                    onQuantumChange={setQuantum}
                  />
                </div>

                <div className="flex flex-col gap-2.5 pt-2">
                  <Button
                    onClick={handleRun}
                    disabled={loading || processes.length === 0}
                    className="w-full font-semibold"
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
                    className="w-full"
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Simulation Error</p>
              <p className="text-sm mt-0.5 opacity-90">{error}</p>
              <p className="text-xs mt-1 opacity-75">
                Make sure the backend server is running.
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
                { label: "Avg Waiting Time",    value: result.averages.avg_waiting_time,    color: "text-amber-600 dark:text-amber-400" },
                { label: "Avg Turnaround Time", value: result.averages.avg_turnaround_time, color: "text-emerald-600 dark:text-emerald-400" },
                { label: "Avg Response Time",   value: result.averages.avg_response_time,   color: "text-cyan-600 dark:text-cyan-400" },
              ].map((s) => (
                <Card key={s.label} className="text-center">
                  <CardContent className="pt-5 pb-4">
                    <p className={`text-3xl font-bold ${s.color}`}>
                      {s.value.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
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
