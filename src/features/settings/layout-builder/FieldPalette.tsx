"use client";

import { useState } from "react";
import { FIELD_TYPES } from "@/lib/layout-builder/fieldTypes";
import { useStoredBoolean } from "@/hooks/useStoredBoolean";

interface FieldPaletteProps {
  /** Click on a field type (adds it to the first section). */
  onAddField: (fieldType: string) => void;
  onAddSection: () => void;
  onDragTypeStart: (fieldType: string) => void;
  onDragTypeEnd: () => void;
}

/** Left column: searchable, draggable field types + "Add Section". Collapses to an icon rail on large screens. */
export default function FieldPalette({ onAddField, onAddSection, onDragTypeStart, onDragTypeEnd }: FieldPaletteProps) {
  const [collapsed, setCollapsed] = useStoredBoolean("layoutPaletteCollapsed");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const types = q ? FIELD_TYPES.filter((t) => t.label.toLowerCase().includes(q) || t.value.toLowerCase().includes(q)) : FIELD_TYPES;

  const tileProps = (value: string) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      onDragTypeStart(value);
      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.setData("text/plain", `new_${value}`);
    },
    onDragEnd: onDragTypeEnd,
    onClick: () => onAddField(value),
  });

  return (
    <div
      className={`w-full lg:h-auto bg-white border-b lg:border-b-0 lg:border-r border-gray-200 flex flex-col shrink-0 transition-[width] duration-200 ${
        collapsed ? "lg:w-[64px]" : "lg:w-[272px]"
      } h-[200px]`}
    >
      <div className={`flex items-center border-b border-gray-100 px-3 py-2.5 gap-2 ${collapsed ? "lg:justify-center" : ""}`}>
        {!collapsed && <span className="text-[0.75rem] font-extrabold text-slate-500 uppercase tracking-wider flex-1">New Fields</span>}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand field palette" : "Collapse field palette"}
          title={collapsed ? "Expand" : "Collapse"}
          className="hidden lg:flex w-7 h-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <i className={`ph-bold ${collapsed ? "ph-caret-right" : "ph-caret-left"}`}></i>
        </button>
      </div>

      {!collapsed && (
        <div className="px-3 pt-3">
          <div className="relative">
            <i className="ph-bold ph-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a field type"
              className="w-full rounded-lg border border-gray-200 bg-slate-50 py-1.5 pl-8 pr-2 text-[0.8rem] font-semibold text-slate-700 outline-none focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100 transition-all placeholder:font-normal"
            />
          </div>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto ${collapsed ? "lg:px-2 lg:py-2 p-3" : "p-3"}`}>
        {/* Expanded grid (always on small screens) */}
        <div className={`grid grid-cols-2 gap-2 ${collapsed ? "lg:hidden" : ""}`}>
          {types.map((type) => (
            <button
              key={type.value}
              {...tileProps(type.value)}
              className="flex items-center gap-2 p-2.5 border border-gray-200 rounded-lg hover:border-orange-300 hover:shadow-sm hover:text-orange-600 transition-all text-left group bg-white cursor-grab active:cursor-grabbing"
            >
              <i className={`ph ${type.icon} text-lg text-slate-400 group-hover:text-orange-500`}></i>
              <span className="text-[0.75rem] font-semibold text-slate-700 group-hover:text-orange-700 truncate">{type.label}</span>
            </button>
          ))}
          {types.length === 0 && <p className="col-span-2 text-center text-xs text-slate-400 py-6">No field type matches.</p>}
        </div>
        {/* Icon rail (large screens, collapsed) */}
        {collapsed && (
          <div className="hidden lg:flex flex-col items-center gap-1.5">
            {FIELD_TYPES.map((type) => (
              <button
                key={type.value}
                {...tileProps(type.value)}
                title={type.label}
                aria-label={`Add ${type.label}`}
                className="w-11 h-11 flex items-center justify-center rounded-xl border border-transparent text-slate-500 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 transition-colors cursor-grab active:cursor-grabbing"
              >
                <i className={`ph ${type.icon} text-xl`}></i>
              </button>
            ))}
          </div>
        )}

        <div className={`mt-6 ${collapsed ? "lg:mt-3" : "px-1"}`}>
          <button
            onClick={onAddSection}
            title="Add Section"
            className={`w-full py-2 border border-dashed border-gray-300 rounded-lg text-sm font-bold text-slate-600 hover:border-orange-400 hover:text-orange-600 transition-colors flex items-center justify-center gap-2 bg-slate-50 ${collapsed ? "lg:h-11 lg:py-0" : ""}`}
          >
            <i className="ph-bold ph-plus"></i> {!collapsed && <span>Add Section</span>}
            {collapsed && <span className="lg:hidden">Add Section</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
