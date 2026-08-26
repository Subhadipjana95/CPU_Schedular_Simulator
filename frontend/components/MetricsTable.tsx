"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ScheduleResult } from "@/lib/api";

interface Props {
  result: ScheduleResult;
}

function fmt(n: number) {
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
}

export function MetricsTable({ result }: Props) {
  const { process_metrics, averages } = result;

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-white">
          Process Metrics
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto rounded-b-lg">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 hover:bg-transparent">
                <TableHead className="text-slate-400 font-semibold">PID</TableHead>
                <TableHead className="text-slate-400 font-semibold text-right">
                  Completion
                </TableHead>
                <TableHead className="text-slate-400 font-semibold text-right">
                  Turnaround
                </TableHead>
                <TableHead className="text-slate-400 font-semibold text-right">
                  Waiting
                </TableHead>
                <TableHead className="text-slate-400 font-semibold text-right">
                  Response
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {process_metrics.map((m, i) => (
                <TableRow
                  key={m.pid}
                  className={`border-slate-700/50 ${
                    i % 2 === 0 ? "bg-slate-800/30" : "bg-slate-800/10"
                  } hover:bg-slate-700/40`}
                >
                  <TableCell className="font-mono font-bold text-indigo-400">
                    {m.pid}
                  </TableCell>
                  <TableCell className="text-right text-slate-200">
                    {m.completion_time}
                  </TableCell>
                  <TableCell className="text-right text-slate-200">
                    {m.turnaround_time}
                  </TableCell>
                  <TableCell className="text-right text-slate-200">
                    {m.waiting_time}
                  </TableCell>
                  <TableCell className="text-right text-slate-200">
                    {m.response_time}
                  </TableCell>
                </TableRow>
              ))}

              {/* Averages row */}
              <TableRow className="border-t-2 border-slate-600 bg-slate-700/30 font-semibold">
                <TableCell className="text-slate-300 italic">Average</TableCell>
                <TableCell className="text-right text-slate-400">—</TableCell>
                <TableCell className="text-right text-emerald-400">
                  {fmt(averages.avg_turnaround_time)}
                </TableCell>
                <TableCell className="text-right text-amber-400">
                  {fmt(averages.avg_waiting_time)}
                </TableCell>
                <TableCell className="text-right text-cyan-400">
                  {fmt(averages.avg_response_time)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
