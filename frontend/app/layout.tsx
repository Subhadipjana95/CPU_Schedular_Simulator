import type { Metadata } from "next";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CPU Scheduling Simulator",
  description:
    "Interactive CPU scheduling simulator with FCFS, SJF, SRTF, Round Robin and Priority algorithms. Visualise Gantt charts and process metrics in real time.",
  keywords: ["CPU scheduling", "FCFS", "SJF", "SRTF", "Round Robin", "Priority", "OS simulator"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("dark", "font-sans", geist.variable)}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
