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
    <div className="flex flex-col gap-4 w-full">
      <div className="flex flex-col gap-1.5 w-full">
        <Label>Algorithm</Label>
        <Select value={algorithm} onValueChange={(v) => v && onAlgorithmChange(v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select algorithm…" />
          </SelectTrigger>
          <SelectContent>
            {ALGORITHMS.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {algorithm === "round_robin" && (
        <div className="flex flex-col gap-1.5 w-full">
          <Label>Time Quantum</Label>
          <Input
            type="number"
            min={1}
            value={quantum}
            onChange={(e) => onQuantumChange(Math.max(1, Number(e.target.value)))}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}
