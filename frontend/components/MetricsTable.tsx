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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">
          Process Metrics
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold px-2">PID</TableHead>
                <TableHead className="font-semibold text-right px-2">
                  Completion
                </TableHead>
                <TableHead className="font-semibold text-right px-2">
                  Turnaround
                </TableHead>
                <TableHead className="font-semibold text-right px-2">
                  Waiting
                </TableHead>
                <TableHead className="font-semibold text-right px-2">
                  Response
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {process_metrics.map((m) => (
                <TableRow key={m.pid}>
                  <TableCell className="font-mono font-bold text-indigo-600 dark:text-indigo-400 px-2">
                    {m.pid}
                  </TableCell>
                  <TableCell className="text-right px-2">
                    {m.completion_time}
                  </TableCell>
                  <TableCell className="text-right px-2">
                    {m.turnaround_time}
                  </TableCell>
                  <TableCell className="text-right px-2">
                    {m.waiting_time}
                  </TableCell>
                  <TableCell className="text-right px-2">
                    {m.response_time}
                  </TableCell>
                </TableRow>
              ))}

              {/* Averages row */}
              <TableRow className="border-t-2 border-border bg-muted/40 font-semibold">
                <TableCell className="italic text-muted-foreground px-2">Average</TableCell>
                <TableCell className="text-right text-muted-foreground px-2">—</TableCell>
                <TableCell className="text-right text-emerald-600 dark:text-emerald-400 font-bold px-2">
                  {fmt(averages.avg_turnaround_time)}
                </TableCell>
                <TableCell className="text-right text-amber-600 dark:text-amber-400 font-bold px-2">
                  {fmt(averages.avg_waiting_time)}
                </TableCell>
                <TableCell className="text-right text-cyan-600 dark:text-cyan-400 font-bold px-2">
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
