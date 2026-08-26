export interface Process {
  pid: string;
  arrival_time: number;
  burst_time: number;
  priority?: number;
}

export interface SchedulePayload {
  algorithm: string;
  quantum?: number;
  processes: Process[];
}

export interface GanttSegment {
  pid: string;
  start: number;
  end: number;
}

export interface ProcessMetric {
  pid: string;
  completion_time: number;
  turnaround_time: number;
  waiting_time: number;
  response_time: number;
}

export interface ScheduleResult {
  gantt_chart: GanttSegment[];
  process_metrics: ProcessMetric[];
  averages: {
    avg_waiting_time: number;
    avg_turnaround_time: number;
    avg_response_time: number;
  };
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export async function runScheduler(
  payload: SchedulePayload
): Promise<ScheduleResult> {
  const body = {
    ...payload,
    algorithm: payload.algorithm.toLowerCase(),
  };
  const res = await fetch(`${API_BASE}/api/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Scheduling request failed");
  }
  return res.json();
}
