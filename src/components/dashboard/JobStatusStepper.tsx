import React from 'react';
import { cn } from "@/lib/utils";

export interface StepperStep {
  label: string;
  value: string;
  icon: string;
  color?: string; // Optional custom color class for the active state
}

interface JobStatusStepperProps {
  steps: StepperStep[];
  currentStatus: string;
  onStatusChange: (status: string) => void;
  className?: string;
}

type Tone = { solid: string; soft: string; icon: string; line: string };

/** Each stage keeps its own colour everywhere (the same family as the dashboard's press pipeline). */
const TONES: Record<string, Tone> = {
  pending: { solid: "from-amber-400 to-orange-500 shadow-orange-500/30", soft: "bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100", icon: "text-amber-500", line: "from-amber-300 to-orange-400" },
  designing: { solid: "from-pink-500 to-fuchsia-500 shadow-fuchsia-500/30", soft: "bg-pink-50 text-pink-700 ring-pink-200 hover:bg-pink-100", icon: "text-pink-500", line: "from-pink-400 to-fuchsia-500" },
  printing: { solid: "from-sky-500 to-indigo-500 shadow-indigo-500/30", soft: "bg-sky-50 text-sky-700 ring-sky-200 hover:bg-sky-100", icon: "text-sky-500", line: "from-sky-400 to-indigo-500" },
  ready: { solid: "from-emerald-500 to-teal-500 shadow-emerald-500/30", soft: "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100", icon: "text-emerald-500", line: "from-emerald-400 to-teal-500" },
  designDone: { solid: "from-violet-500 to-purple-600 shadow-violet-500/30", soft: "bg-violet-50 text-violet-700 ring-violet-200 hover:bg-violet-100", icon: "text-violet-500", line: "from-violet-400 to-purple-500" },
  delivered: { solid: "from-slate-700 to-slate-900 shadow-slate-700/30", soft: "bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200", icon: "text-slate-600", line: "from-slate-500 to-slate-700" },
  cancelled: { solid: "from-rose-400 to-red-500 shadow-rose-500/30", soft: "bg-rose-50 text-rose-600 ring-rose-200 hover:bg-rose-100", icon: "text-rose-400", line: "from-rose-300 to-red-400" },
};
const FALLBACK = [TONES.pending, TONES.designing, TONES.designDone, TONES.printing, TONES.ready, TONES.delivered];

function toneFor(step: StepperStep, index: number): Tone {
  const v = `${step.value} ${step.label}`.toLowerCase();
  if (/cancel/.test(v)) return TONES.cancelled;
  if (/ready/.test(v)) return TONES.ready;
  if (/design/.test(v) && /complet/.test(v)) return TONES.designDone;
  if (/deliver|dispatch|complete|done/.test(v)) return TONES.delivered;
  if (/print/.test(v)) return TONES.printing;
  if (/design|proof/.test(v)) return TONES.designing;
  if (/pending|new|confirm/.test(v)) return TONES.pending;
  return FALLBACK[index % FALLBACK.length];
}

/** Compact one-line stage track: every stage is a chip in its own colour; click one to move the job there. */
export default function JobStatusStepper({ steps, currentStatus, onStatusChange, className }: JobStatusStepperProps) {
  let currentIndex = steps.findIndex(s => s.value === currentStatus);
  if (currentIndex === -1) currentIndex = 0; // Fallback

  return (
    <ol className={cn("no-scrollbar flex w-full items-center gap-1 overflow-x-auto lg:flex-wrap lg:gap-y-2 lg:overflow-visible print:flex-wrap print:gap-y-2 print:overflow-visible", className)}>
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const tone = toneFor(step, index);

        return (
          <li key={step.value} className="flex shrink-0 items-center gap-1">
            {index > 0 && (
              <span
                className={cn("h-0.5 w-2.5 rounded-full 2xl:w-4", index <= currentIndex ? `bg-gradient-to-r ${tone.line}` : "bg-slate-200")}
                aria-hidden="true"
              />
            )}
            <button
              type="button"
              onClick={() => onStatusChange(step.value)}
              aria-current={isCurrent ? "step" : undefined}
              title={isCurrent ? `Current stage: ${step.label}` : `Move to ${step.label}`}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full pl-1 pr-2.5 text-[12.5px] font-semibold transition-[background-color,box-shadow,transform] duration-200 active:scale-[0.97]",
                isCurrent
                  ? `bg-gradient-to-r text-white shadow-md ${tone.solid}`
                  : isCompleted
                    ? `ring-1 ${tone.soft}`
                    : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-800"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[12px]",
                  isCurrent ? "bg-white/20" : isCompleted ? `bg-white ${tone.icon}` : `bg-slate-50 ${tone.icon}`
                )}
                aria-hidden="true"
              >
                {isCompleted ? <i className="ph-bold ph-check text-[12px]"></i> : <i className={step.icon}></i>}
              </span>
              <span className="whitespace-nowrap">{step.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
