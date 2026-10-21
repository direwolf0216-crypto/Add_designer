"use client";

import type { FormSection } from "@/lib/forms/types";
import FlatSection from "./FlatSection";
import { useJobFormContext } from "./JobFormContext";
import RepeatableSection from "./RepeatableSection";

const BADGE_COLORS = [
  "bg-blue-50 text-blue-600 border-blue-100",
  "bg-emerald-50 text-emerald-600 border-emerald-100",
  "bg-purple-50 text-purple-600 border-purple-100",
];

/** Numbered card for one layout section; hidden when its visibility rule fails. */
export default function JobFormSection({ section, index }: { section: FormSection; index: number }) {
  const { isVisible } = useJobFormContext();
  if (section.visibilityRule && !isVisible(section.visibilityRule)) return null;

  const badgeColor = BADGE_COLORS[index % BADGE_COLORS.length];
  const numStr = (index + 1).toString().padStart(2, "0");

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 mb-6 border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] relative">
      <div className="flex flex-col mb-8">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center font-bold text-[1.1rem] border ${badgeColor}`}>{numStr}</div>
          <div className="flex flex-col">
            <span className="font-extrabold text-[1.2rem] text-slate-900 tracking-tight">{section.title}</span>
            {section.description && <span className="text-[0.85rem] text-slate-500 mt-0.5 font-medium">{section.description}</span>}
          </div>
        </div>
      </div>

      {section.isRepeatable ? <RepeatableSection section={section} /> : <FlatSection section={section} />}
    </div>
  );
}
