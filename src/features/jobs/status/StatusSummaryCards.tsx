"use client";

import type React from "react";
import type { JobStatusCounts } from "@/lib/jobs/statusCounts";
import { ICON_MAP, STATUS_CARDS } from "./statusCards";

interface StatusSummaryCardsProps {
  counts: JobStatusCounts;
  activeTab: string;
  onSelect: (status: string) => void;
}

export default function StatusSummaryCards({ counts, activeTab, onSelect }: StatusSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {STATUS_CARDS.map((card, index) => (
        <div
          key={card.status}
          className={`relative bg-white rounded-2xl overflow-hidden flex flex-col h-[130px] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-pointer group border border-slate-100 ${activeTab === card.status ? 'ring-2 ring-offset-2' : ''}`}
          style={{ animationDelay: `${index * 80}ms`, ...(activeTab === card.status ? { '--tw-ring-color': card.accentColor, boxShadow: `0 4px 12px ${card.accentColor}40` } as React.CSSProperties : {}) }}
          onClick={() => onSelect(card.status)}
        >
          {/* Background Wave */}
          <div className="absolute bottom-0 left-0 right-0 w-full h-[50%] pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity duration-300" dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 864 120" width="100%" height="100%" preserveAspectRatio="none">${card.waveSvg}</svg>` }} />

          <div className="p-5 flex items-start gap-4 relative z-10">
            <div
              className="w-12 h-12 rounded-full flex shrink-0 items-center justify-center shadow-sm"
              style={{ backgroundColor: card.iconBg, color: card.iconColor }}
            >
              {ICON_MAP[card.icon]}
            </div>
            <div className="flex flex-col mt-0.5">
              <div className="text-slate-600 font-bold text-[0.75rem] mb-1">{card.label}</div>
              <div className="text-[1.35rem] font-black text-slate-900 leading-none mb-1.5 tracking-tight">
                {counts[card.status] ?? 0}
              </div>
              <div className="text-[0.65rem] text-slate-400 font-medium uppercase tracking-wider">{card.sublabel}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
