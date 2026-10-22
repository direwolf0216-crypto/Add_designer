"use client";

import { defaultUnitFor } from '@/lib/jobs/size';
import { getFieldTypeDef } from "@/lib/layout-builder/fieldTypes";
import { roleDef } from "@/lib/forms/roles";
import type { FormField } from "@/lib/layout-builder/types";

/** Types whose control is a picker, so the preview reads "Select ..." like the real form. */
const PICK_STYLE_TYPES = new Set(['PICK_LIST', 'DATE', 'TIME', 'MULTI_SELECT', 'STATUS_PICKER', 'USER_PICKLIST', 'MULTI_USER_PICKLIST']);

interface FieldTileProps {
  field: FormField;
  locked: boolean;
  isSelected: boolean;
  /** Show the drop-position indicator to the left of the tile. */
  isDragOver: boolean;
  /** Copy vs move cursor while something is dragged over the tile. */
  draggingNewField: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDrop: (e: React.DragEvent) => void;
  onSelect: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
}

/** A WYSIWYG preview of one field on the canvas; draggable unless its section is locked. */
export default function FieldTile({
  field,
  locked: isSectionLocked,
  isSelected,
  isDragOver,
  draggingNewField,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onSelect,
  onRemove,
  onDuplicate,
}: FieldTileProps) {
  const typeDef = getFieldTypeDef(field.type);

  return (
    <div className="relative">
      {isDragOver && !isSectionLocked && (
        <div className="absolute -left-3 -top-3 bottom-0 w-1.5 bg-orange-500 rounded-full z-20 shadow-[0_0_8px_rgba(249,115,22,0.6)] animate-pulse"></div>
      )}
      <div
        draggable={!isSectionLocked}
        onDragStart={(e) => {
          if (isSectionLocked) return;
          onDragStart(e);
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", `field_${field.id}`);
        }}
        onDragEnd={() => {
          if (isSectionLocked) return;
          onDragEnd();
        }}
        onDragOver={(e) => {
          if (isSectionLocked) return;
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = draggingNewField ? "copy" : "move";
          onDragOver();
        }}
        onDrop={(e) => {
          if (isSectionLocked) return;
          e.stopPropagation();
          onDrop(e);
        }}
        onClick={(e) => {
          if (isSectionLocked) return;
          e.stopPropagation();
          onSelect();
        }}
        className={`relative transition-all group/field rounded-2xl p-3 -m-3 ${field.archived ? 'opacity-60 saturate-50' : ''} ${isSectionLocked ? '' : 'cursor-grab active:cursor-grabbing'
          } ${isSelected
            ? 'bg-orange-50/50 outline outline-2 outline-orange-500 z-10'
            : isSectionLocked ? '' : 'hover:bg-slate-100/50 hover:outline hover:outline-1 hover:outline-gray-200'
          }`}
      >
        {/* Realistic Label */}
        {field.type !== 'CHECKBOX' && (
          <label className={`text-[0.7rem] font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-2 truncate cursor-grab active:cursor-grabbing ${isSectionLocked ? "" : "pr-14"}`}>
            <span className="truncate">{field.name || 'Untitled Field'} {field.mandatory && <span className="text-red-500">*</span>}</span>
            {field.role && !field.archived && (
              <span className="shrink-0 max-w-[7rem] truncate normal-case tracking-normal rounded-md bg-violet-50 border border-violet-200 px-1.5 py-0.5 text-[0.65rem] font-bold text-violet-700" title="Field role">{roleDef(field.role).label}</span>
            )}
            {field.archived && (
              <span className="shrink-0 normal-case tracking-normal rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[0.65rem] font-bold text-amber-700">Archived · hidden from form</span>
            )}
            {!field.archived && (field.audience?.hideFor?.length || field.audience?.readOnlyFor?.length) ? (
              <i className={`ph-bold ${field.audience?.hideFor?.length ? "ph-eye-slash text-red-400" : "ph-lock-simple text-amber-500"} shrink-0 text-[0.8rem]`} title="Limited to some roles or teams"></i>
            ) : null}
          </label>
        )}

        {/* Realistic Input Field */}
        {field.type === 'CHECKBOX' ? (
          <div className="w-full h-[52px] bg-white border border-gray-200 rounded-xl flex items-center px-4 shadow-sm pointer-events-none gap-3">
            <div className="w-5 h-5 rounded border-2 border-gray-300 bg-white flex shrink-0"></div>
            <span className="text-[0.95rem] text-slate-600 font-semibold truncate">{field.name || 'Untitled Field'}</span>
          </div>
        ) : (
          <div className="w-full h-[52px] bg-white border border-gray-200 rounded-xl flex items-center justify-between px-4 shadow-sm pointer-events-none">
            <span className="text-[0.95rem] text-slate-400 truncate">
              {field.placeholder || (field.type === 'SIZE' ? 'e.g. 3 x 6' : PICK_STYLE_TYPES.has(field.type) ? `Select ${(field.name ?? '').toLowerCase()}...` : `e.g. Enter ${(field.name ?? '').toLowerCase()}...`)}
            </span>
            {field.type === 'SIZE' ? (
              <span className="shrink-0 rounded-lg border border-violet-200 bg-violet-50 px-2 py-0.5 text-[0.75rem] font-bold text-violet-700">{defaultUnitFor(field)}</span>
            ) : (
              <i className={`ph ${typeDef?.icon || 'ph-text-t'} text-slate-400 text-lg`}></i>
            )}
          </div>
        )}

        {/* Floating Action Menu (Duplicate, Delete) */}
        {!isSectionLocked && (
          <div className={`absolute -right-2 -top-2 bg-white border border-gray-200 rounded-full shadow-sm flex items-center transition-opacity z-20 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover/field:opacity-100'}`}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-orange-600 rounded-full hover:bg-slate-50"
              title="Duplicate Field"
              aria-label={`Duplicate ${field.name || 'field'}`}
            >
              <i className="ph-bold ph-copy"></i>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 rounded-full hover:bg-slate-50"
              title="Delete Field"
              aria-label={`Delete ${field.name || 'field'}`}
            >
              <i className="ph-bold ph-trash"></i>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
