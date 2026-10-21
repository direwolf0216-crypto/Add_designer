"use client";

import { useState } from "react";
import type { FieldPosition } from "@/lib/layout-builder/types";

interface DragHandlers {
  /** Drop of a palette item: create a field of `fieldType` at `index` in `sectionId`. */
  onInsertNewField: (sectionId: string, fieldType: string, index: number) => void;
  onMoveField: (from: FieldPosition, toSectionId: string, toIndex: number) => void;
  onMoveSection: (sourceId: string, targetId: string) => void;
}

/** HTML5 drag-and-drop state shared by the field palette and the canvas. */
export function useBuilderDrag({ onInsertNewField, onMoveField, onMoveSection }: DragHandlers) {
  // Section reordering
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);

  // Field drag: a new field type from the palette, or an existing field
  const [draggedNewFieldType, setDraggedNewFieldType] = useState<string | null>(null);
  const [draggedFieldContext, setDraggedFieldContext] = useState<FieldPosition | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<FieldPosition | null>(null);

  const handleSectionDrop = (e: React.DragEvent, targetSectionId: string) => {
    e.preventDefault();
    setDragOverSectionId(null);
    if (!draggedSectionId || draggedSectionId === targetSectionId) return;
    onMoveSection(draggedSectionId, targetSectionId);
    setDraggedSectionId(null);
  };

  const handleDrop = (e: React.DragEvent, targetSectionId: string, targetIndex: number) => {
    e.preventDefault();
    if (draggedNewFieldType) {
      onInsertNewField(targetSectionId, draggedNewFieldType, targetIndex);
    } else if (draggedFieldContext) {
      onMoveField(draggedFieldContext, targetSectionId, targetIndex);
    }
    setDraggedNewFieldType(null);
    setDraggedFieldContext(null);
    setDragOverTarget(null);
  };

  return {
    draggedSectionId,
    setDraggedSectionId,
    dragOverSectionId,
    setDragOverSectionId,
    draggedNewFieldType,
    setDraggedNewFieldType,
    draggedFieldContext,
    setDraggedFieldContext,
    dragOverTarget,
    setDragOverTarget,
    handleSectionDrop,
    handleDrop,
  };
}

export type BuilderDrag = ReturnType<typeof useBuilderDrag>;
