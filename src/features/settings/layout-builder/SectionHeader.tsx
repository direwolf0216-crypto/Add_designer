"use client";

import type { FormSection } from "@/lib/layout-builder/types";
import type { SectionEdits } from "@/lib/layout-builder/reducer";
import SectionIconPicker from "./SectionIconPicker";

interface SectionHeaderProps {
  section: FormSection;
  locked: boolean;
  onUpdate: (updates: SectionEdits) => void;
  onIconChange: (icon: string) => void;
  onRemove: () => void;
}

export default function SectionHeader({ section, locked: isSectionLocked, onUpdate, onIconChange, onRemove }: SectionHeaderProps) {
  return (
    <div className="flex items-start gap-4 mb-8">
      <SectionIconPicker icon={section.icon} onChange={onIconChange} />
      <div className="flex-1">
        <input
          type="text"
          value={section.title ?? ''}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className={`font-extrabold text-slate-900 bg-transparent border-none outline-none focus:ring-0 p-0 text-xl placeholder:text-slate-300 w-full mb-1 ${isSectionLocked ? 'pointer-events-none' : ''}`}
          placeholder="Section Title"
          readOnly={isSectionLocked}
        />
        <input
          type="text"
          value={section.description || ""}
          onChange={(e) => onUpdate({ description: e.target.value })}
          className={`text-[0.95rem] text-slate-500 bg-transparent border-none outline-none focus:ring-0 p-0 w-full placeholder:text-slate-300 ${isSectionLocked ? 'pointer-events-none' : ''}`}
          placeholder="Section Description..."
          readOnly={isSectionLocked}
        />
        {!isSectionLocked && (
          <div className="mt-2 flex items-center gap-2">
             <label className="text-xs font-semibold text-slate-500 flex items-center gap-2 cursor-pointer hover:text-slate-800 transition-colors">
               <input type="checkbox" checked={!!section.isRepeatable} onChange={(e) => onUpdate({ isRepeatable: e.target.checked })} className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 cursor-pointer" />
               Repeatable Section (Sub-form)
             </label>
          </div>
        )}
      </div>
      {!isSectionLocked && (
        <button
          onClick={onRemove}
          className="opacity-0 group-hover/section:opacity-100 text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-all"
          title="Delete Section"
        >
          <i className="ph-bold ph-trash text-lg"></i>
        </button>
      )}
    </div>
  );
}
