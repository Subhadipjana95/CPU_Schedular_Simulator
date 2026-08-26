"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, Trash2 } from "lucide-react";
import type { Process } from "@/lib/api";

interface Props {
  processes: Process[];
  showPriority: boolean;
  onChange: (processes: Process[]) => void;
}

function makeProcess(id: number): Process {
  return {
    pid: `P${id}`,
    arrival_time: 0,
    burst_time: 4,
    priority: 1,
  };
}

export function ProcessInputTable({ processes, showPriority, onChange }: Props) {
  const [nextId, setNextId] = useState(processes.length + 1);

  const addRow = () => {
    onChange([...processes, makeProcess(nextId)]);
    setNextId((n) => n + 1);
  };

  const removeRow = (idx: number) => {
    onChange(processes.filter((_, i) => i !== idx));
  };

  const update = (idx: number, field: keyof Process, value: string | number) => {
    const updated = processes.map((p, i) =>
      i === idx ? { ...p, [field]: value } : p
    );
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div
        className={`grid gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 ${
          showPriority ? "grid-cols-[1fr_1fr_1fr_1fr_auto]" : "grid-cols-[1fr_1fr_1fr_auto]"
        }`}
      >
        <span>Process ID</span>
        <span>Arrival Time</span>
        <span>Burst Time</span>
        {showPriority && <span>Priority</span>}
        <span />
      </div>

      {/* Rows */}
      {processes.map((p, idx) => (
        <div
          key={idx}
          className={`grid gap-2 items-center ${
            showPriority ? "grid-cols-[1fr_1fr_1fr_1fr_auto]" : "grid-cols-[1fr_1fr_1fr_auto]"
          }`}
        >
          <Input
            value={p.pid}
            onChange={(e) => update(idx, "pid", e.target.value)}
            placeholder="P1"
          />
          <Input
            type="number"
            min={0}
            value={p.arrival_time}
            onChange={(e) => update(idx, "arrival_time", Number(e.target.value))}
          />
          <Input
            type="number"
            min={1}
            value={p.burst_time}
            onChange={(e) => update(idx, "burst_time", Number(e.target.value))}
          />
          {showPriority && (
            <Input
              type="number"
              min={0}
              value={p.priority ?? 0}
              onChange={(e) => update(idx, "priority", Number(e.target.value))}
            />
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => removeRow(idx)}
            disabled={processes.length <= 1}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {/* Add row button */}
      <Button
        variant="outline"
        size="sm"
        onClick={addRow}
        className="mt-1 border-dashed text-muted-foreground hover:text-foreground w-full"
      >
        <PlusCircle className="h-4 w-4 mr-2" />
        Add Process
      </Button>
    </div>
  );
}
