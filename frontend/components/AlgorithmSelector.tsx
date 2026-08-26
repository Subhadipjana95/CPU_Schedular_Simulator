"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  algorithm: string;
  quantum: number;
  onAlgorithmChange: (algo: string) => void;
  onQuantumChange: (q: number) => void;
}

const ALGORITHMS = [
  { value: "fcfs",        label: "FCFS — First Come First Served" },
  { value: "sjf",         label: "SJF — Shortest Job First" },
  { value: "srtf",        label: "SRTF — Shortest Remaining Time First" },
  { value: "round_robin", label: "Round Robin" },
  { value: "priority",    label: "Priority (Non-Preemptive)" },
];

export function AlgorithmSelector({
  algorithm,
  quantum,
  onAlgorithmChange,
  onQuantumChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium text-slate-300">Algorithm</Label>
        <Select value={algorithm} onValueChange={(v) => v && onAlgorithmChange(v)}>
          <SelectTrigger className="w-70 bg-slate-800/60 border-slate-600 text-white focus:ring-indigo-500">
            <SelectValue placeholder="Select algorithm…" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-600 text-white">
            {ALGORITHMS.map((a) => (
              <SelectItem
                key={a.value}
                value={a.value}
                className="hover:bg-slate-700 focus:bg-slate-700"
              >
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {algorithm === "round_robin" && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-medium text-slate-300">
            Time Quantum
          </Label>
          <Input
            type="number"
            min={1}
            value={quantum}
            onChange={(e) => onQuantumChange(Math.max(1, Number(e.target.value)))}
            className="w-28 bg-slate-800/60 border-slate-600 text-white focus:ring-indigo-500"
          />
        </div>
      )}
    </div>
  );
}
