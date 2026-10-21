"use client";

import { isSectionLocked as getIsSectionLocked, type SectionEdits } from "@/lib/layout-builder/reducer";
import type { FormSection } from "@/lib/layout-builder/types";
import type { BuilderDrag } from "./useBuilderDrag";
import FieldTile from "./FieldTile";
import SectionHeader from "./SectionHeader";

interface SectionCardProps {
  section: FormSection;
  selectedFieldId: string | null;
  drag: BuilderDrag;
  onUpdate: (updates: SectionEdits) => void;
  onIconChange: (icon: string) => void;
  onRemove: () => void;
  /** Append a new (single-line) field to this section. */
  onAddField: () => void;
  onSelectField: (fieldId: string) => void;
  onRemoveField: (fieldId: string) => void;
}

/** One section on the canvas: draggable header + field grid + drop zone. */
export default function SectionCard({
  section,
  selectedFieldId,
  drag,
  onUpdate,
  onIconChange,
  onRemove,
  onAddField,
  onSelectField,
  onRemoveField,
}: SectionCardProps) {
  const {
    draggedSectionId,
    setDraggedSectionId,
    dragOverSectionId,
    setDragOverSectionId,
    draggedNewFieldType,
    setDraggedFieldContext,
    dragOverTarget,
    setDragOverTarget,
    handleSectionDrop,
    handleDrop,
  } = drag;
  const isSectionLocked = getIsSectionLocked(section);
  const endIndex = section.fields?.length || 0;
  const isEndTarget = dragOverTarget?.sectionId === section.id && dragOverTarget?.fieldIndex === endIndex;

  return (
    <div
      draggable={!isSectionLocked}
      onDragStart={(e) => {
        if (isSectionLocked) {
          e.preventDefault();
          return;
        }
        e.stopPropagation();
        setDraggedSectionId(section.id);
      }}
      onDragEnd={() => {
        if (isSectionLocked) return;
        setDraggedSectionId(null);
        setDragOverSectionId(null);
      }}
      className={`group/section relative bg-slate-50 border rounded-2xl p-8 transition-colors ${dragOverSectionId === section.id ? 'border-orange-500 shadow-[0_0_0_3px_rgba(249,115,22,0.3)] -translate-y-1' : ''} ${isEndTarget
        ? 'border-orange-400 shadow-[0_0_0_2px_rgba(249,115,22,0.2)]'
        : 'border-gray-100'
        }`}
      onClick={(e) => e.stopPropagation()}
      onDragOver={(e) => {
        e.preventDefault();
        if (draggedSectionId) {
          e.dataTransfer.dropEffect = "move";
          if (dragOverSectionId !== section.id) setDragOverSectionId(section.id);
        } else {
          e.dataTransfer.dropEffect = draggedNewFieldType ? "copy" : "move";
          setDragOverTarget({ sectionId: section.id, fieldIndex: endIndex });
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (draggedSectionId) {
          handleSectionDrop(e, section.id);
        } else {
          handleDrop(e, section.id, endIndex);
        }
      }}
    >
      {/* Section Header */}
      <SectionHeader section={section} locked={isSectionLocked} onUpdate={onUpdate} onIconChange={onIconChange} onRemove={onRemove} />

      {/* Section Fields Grid */}
      <div className={`gap-x-6 gap-y-6 ${section.isRepeatable ? 'p-4 bg-slate-50/80 border border-slate-200 rounded-2xl flex flex-col' : 'grid grid-cols-1 md:grid-cols-2'}`}>
        {section.fields.map((field, idx) => (
          <FieldTile
            key={field.id}
            field={field}
            locked={isSectionLocked}
            isSelected={selectedFieldId === field.id}
            isDragOver={dragOverTarget?.sectionId === section.id && dragOverTarget?.fieldIndex === idx}
            draggingNewField={!!draggedNewFieldType}
            onDragStart={() => setDraggedFieldContext({ sectionId: section.id, fieldIndex: idx })}
            onDragEnd={() => {
              setDraggedFieldContext(null);
              setDragOverTarget(null);
            }}
            onDragOver={() => setDragOverTarget({ sectionId: section.id, fieldIndex: idx })}
            onDrop={(e) => handleDrop(e, section.id, idx)}
            onSelect={() => onSelectField(field.id)}
            onRemove={() => onRemoveField(field.id)}
          />
        ))}
      </div>
      {section.isRepeatable && (
        <div className="flex justify-center mt-4">
          <button className="px-4 py-2 rounded-xl bg-white border border-dashed border-slate-300 text-slate-500 text-sm font-semibold pointer-events-none flex items-center gap-2">
            <i className="ph-bold ph-plus"></i> Add Entry
          </button>
        </div>
      )}

      {/* Inline Add Field Area (Drop Zone) */}
      {!isSectionLocked && (
        <button
          onClick={onAddField}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOverTarget({ sectionId: section.id, fieldIndex: endIndex });
          }}
          onDrop={(e) => {
            e.stopPropagation();
            handleDrop(e, section.id, endIndex);
          }}
          className={`mt-8 w-full py-3.5 border border-dashed rounded-xl text-[0.85rem] font-bold transition-colors flex items-center justify-center gap-2 ${isEndTarget
            ? 'border-orange-500 bg-orange-50 text-orange-600 shadow-sm outline outline-2 outline-orange-200'
            : 'border-gray-300 text-slate-500 hover:text-orange-600 hover:border-orange-300 hover:bg-orange-50/50'
            }`}
        >
          <i className="ph-bold ph-plus"></i> Add Field Here
        </button>
      )}
    </div>
  );
}
