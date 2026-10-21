"use client";

import { useState } from "react";
import { ColorPicker } from "@/components/ui/color-picker";
import { moveItem } from "@/lib/layout-builder/reducer";
import type { FormField } from "@/lib/layout-builder/types";

interface StatusOptionsEditorProps {
  field: FormField;
  onChange: (updates: Partial<FormField>) => void;
}

/** Label + colour pairs for STATUS_PICKER fields, reorderable by drag. */
export default function StatusOptionsEditor({ field: selectedField, onChange: updateSelectedField }: StatusOptionsEditorProps) {
  const [draggedOptionIdx, setDraggedOptionIdx] = useState<number | null>(null);

  return (
    <div className="pt-4 border-t border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <label className="text-[0.75rem] font-bold text-slate-600 flex items-center gap-1">
          Status Options <span className="text-red-500">*</span>
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        {(selectedField.statusOptions || []).map((opt, idx) => (
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
              updateSelectedField({ statusOptions: moveItem(selectedField?.statusOptions || [], draggedOptionIdx, idx) });
              setDraggedOptionIdx(null);
            }}
            onDragEnd={() => setDraggedOptionIdx(null)}
            className={`flex items-center gap-1.5 bg-white p-1 rounded-lg border border-gray-200 transition-opacity shadow-sm ${draggedOptionIdx === idx ? 'opacity-50' : ''}`}
          >
            <i className="ph-bold ph-dots-six-vertical text-slate-400 cursor-grab active:cursor-grabbing text-[0.95rem] hover:text-slate-600 transition-colors ml-1"></i>

            <div className="relative shrink-0 flex items-center justify-center">
              <ColorPicker
                className="!w-5 !h-5 border-2"
                color={opt.color || '#cbd5e1'}
                onChange={(newColor) => {
                  // NOTE: mutates the option object in place (kept from the original implementation).
                  const newOpts = [...(selectedField.statusOptions || [])];
                  newOpts[idx].color = newColor;
                  updateSelectedField({ statusOptions: newOpts });
                }}
              />
            </div>

            <input
              type="text"
              value={opt.label ?? ''}
              onChange={(e) => {
                const newOpts = [...(selectedField.statusOptions || [])];
                newOpts[idx].label = e.target.value;
                updateSelectedField({ statusOptions: newOpts });
              }}
              className="flex-1 bg-transparent px-1.5 py-0.5 outline-none focus:border-orange-500 focus:ring-0 text-[0.8rem] font-bold text-slate-700 transition-all"
              placeholder={`Status ${idx + 1}`}
            />
            <button
              type="button"
              onClick={() => {
                const newOpts = (selectedField.statusOptions || []).filter((_, i) => i !== idx);
                updateSelectedField({ statusOptions: newOpts });
              }}
              className="w-6 h-6 shrink-0 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors mr-0.5"
            >
              <i className="ph-bold ph-trash text-[0.85rem]"></i>
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => {
            const newOpts = [...(selectedField.statusOptions || []), { label: "New Status", color: "bg-slate-500" }];
            updateSelectedField({ statusOptions: newOpts });
          }}
          className="flex items-center justify-center gap-2 w-full p-2.5 mt-1 border border-dashed border-slate-300 rounded-xl text-[0.8rem] font-bold text-slate-500 hover:text-orange-500 hover:border-orange-300 hover:bg-orange-50 transition-colors"
        >
          <i className="ph-bold ph-plus"></i> Add Status
        </button>
      </div>
    </div>
  );
}
