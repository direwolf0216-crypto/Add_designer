"use client";

import { useState } from "react";
import { moveItem } from "@/lib/layout-builder/reducer";
import type { FormField } from "@/lib/layout-builder/types";

interface OptionsEditorProps {
  field: FormField;
  onChange: (updates: Partial<FormField>) => void;
  /** Removal goes through a usage check (and possibly a migration dialog), so the parent owns it. */
  onRemoveOption: (idx: number) => void;
  removing: boolean;
}

/** Pick-list values for PICK_LIST / MULTI_SELECT fields, reorderable by drag. */
export default function OptionsEditor({ field: selectedField, onChange: updateSelectedField, onRemoveOption, removing }: OptionsEditorProps) {
  const [draggedOptionIdx, setDraggedOptionIdx] = useState<number | null>(null);

  return (
    <div className="pt-4 border-t border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <label className="text-[0.75rem] font-bold text-slate-600 flex items-center gap-1">
          Pick List Values <span className="text-red-500">*</span>
        </label>
      </div>

      <div className="bg-slate-50 border border-gray-200 rounded-xl p-2 space-y-2">
        {(selectedField.options || []).map((opt, idx) => (
          <div
            key={idx}
            draggable
            onDragStart={(e) => {
              setDraggedOptionIdx(idx);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedOptionIdx === null || draggedOptionIdx === idx) return;
              updateSelectedField({ options: moveItem(selectedField?.options || [], draggedOptionIdx, idx) });
              setDraggedOptionIdx(null);
            }}
            onDragEnd={() => setDraggedOptionIdx(null)}
            className={`flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1.5 shadow-sm group/opt ${draggedOptionIdx === idx ? 'opacity-50' : 'cursor-grab active:cursor-grabbing'}`}
          >
            <div className="w-6 h-6 flex items-center justify-center text-slate-300">
              <i className="ph-bold ph-dots-six-vertical"></i>
            </div>
            <input
              type="text"
              value={opt ?? ''}
              onChange={(e) => {
                const newOpts = [...(selectedField?.options || [])];
                newOpts[idx] = e.target.value;
                updateSelectedField({ options: newOpts });
              }}
              className="flex-1 text-[0.85rem] font-semibold text-slate-800 bg-transparent border-none outline-none focus:ring-0 p-0"
            />
            <button
              onClick={() => onRemoveOption(idx)}
              disabled={removing}
              className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-red-500 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <i className="ph-fill ph-x-circle"></i>
            </button>
          </div>
        ))}

        <button
          onClick={() => {
            const newOpts = [...(selectedField?.options || []), "New Option"];
            updateSelectedField({ options: newOpts });
          }}
          className="w-full mt-2 py-2.5 bg-white border border-dashed border-gray-300 rounded-lg text-[0.8rem] font-bold text-slate-500 hover:border-orange-400 hover:text-orange-600 transition-colors flex items-center gap-2 px-3"
        >
          <i className="ph-bold ph-plus"></i> Add Value
        </button>
      </div>
    </div>
  );
}
