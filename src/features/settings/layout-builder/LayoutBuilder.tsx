"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLayoutBuilder } from "./useLayoutBuilder";
import { useBuilderDrag } from "./useBuilderDrag";
import FormList from "./FormList";
import EditorHeader from "./EditorHeader";
import FieldPalette from "./FieldPalette";
import BuilderCanvas from "./BuilderCanvas";
import PropertiesPanel from "./PropertiesPanel";
import MigrateOptionDialog from "./MigrateOptionDialog";
import RemoveFieldDialog from "./RemoveFieldDialog";
import UnsavedChangesDialog from "./UnsavedChangesDialog";
import LayoutPreviewDialog, { PREVIEWABLE_FORMS } from "./LayoutPreviewDialog";
import PublishDialog from "./PublishDialog";
import HistoryDialog from "./HistoryDialog";
import { diffLayouts } from "@/lib/layout-builder/diff";
import MoreMenu from "./MoreMenu";
import TemplatesDialog from "./TemplatesDialog";
import { exportFileName, parseLayoutFile, serializeLayout } from "@/lib/layout-builder/transfer";
import { templatesFor } from "@/lib/layout-builder/templates";
import { DEFAULT_LAYOUTS } from "@/lib/defaultLayouts";
import type { FormSchema } from "@/lib/layout-builder/types";

const isTypingTarget = (el: EventTarget | null) => {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    node.isContentEditable
  );
};

/**
 * Settings → Layouts & Fields: list of form layouts, and a full-height workbench for one layout:
 * palette · canvas · properties, with undo/redo, live preview, an unsaved-changes guard and delete protection.
 */
export default function LayoutBuilder() {
  const builder = useLayoutBuilder();
  const { activeLayout, selectedField, dirty, unpublished } = builder;
  const [publishOpen, setPublishOpen] = useState(false);

  const drag = useBuilderDrag({
    onInsertNewField: (sectionId, fieldType, index) =>
      builder.addField(sectionId, fieldType, index),
    onMoveField: builder.moveField,
    onMoveSection: builder.moveSection,
  });

  const [templatesOpen, setTemplatesOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [leavePrompt, setLeavePrompt] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const closePreview = useCallback(() => setPreviewOpen(false), []);

  // Export / import the draft as a JSON file.
  const exportLayout = () => {
    if (!activeLayout) return;
    const blob = new Blob([serializeLayout(activeLayout)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFileName(activeLayout);
    a.click();
    URL.revokeObjectURL(url);
  };
  const importLayout = async (file: File) => {
    const parsed = parseLayoutFile(await file.text());
    if (!parsed.ok) { toast.error(parsed.error); return; }
    if (activeLayout && parsed.formKey && parsed.formKey !== activeLayout.formKey) {
      toast.warning(`This file was exported from ${parsed.formKey}`, { description: "Imported anyway; check the fields and roles before publishing." });
    }
    builder.applySchema(parsed.schema, `Imported ${file.name}`);
  };

  // Leaving the editor with unsaved edits asks first; closing the tab gets the browser's own prompt.
  const requestBack = () => {
    if (dirty) setLeavePrompt(true);
    else builder.closeForm();
  };
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // ⌘Z / ⌃Z undo, ⇧⌘Z / ⌃Y redo, ⌘S save — outside text inputs, where the browser's own undo applies.
  const { undo, redo, handleSave } = builder;
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        void handleSave("draft");
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      }
    },
    [undo, redo, handleSave],
  );
  useEffect(() => {
    if (!activeLayout) return;
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeLayout, onKeyDown]);

  if (builder.loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 flex items-center justify-center text-slate-400">
        <div className="w-5 h-5 border-2 border-slate-300 border-t-orange-500 rounded-full animate-spin mr-3"></div>
        Loading Layouts...
      </div>
    );
  }

  // --- View 1: List of Forms ---
  if (!activeLayout) {
    return <FormList layouts={builder.layouts} onOpen={builder.openForm} />;
  }

  const canPreview = PREVIEWABLE_FORMS.has(activeLayout.formKey);
  const formNoun =
    activeLayout.formKey === "TRANSACTION_FORM" ? "transaction" : "job";

  // --- View 2: Workbench ---
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col font-sans lg:h-[calc(100dvh-140px)] lg:min-h-[560px]">
      <EditorHeader
        title={activeLayout.name}
        version={activeLayout.publishedVersion}
        status={dirty ? "unsaved" : unpublished ? "draft" : "live"}
        saving={builder.saving}
        canUndo={builder.canUndo}
        canRedo={builder.canRedo}
        canPreview={canPreview}
        canPublish={unpublished || dirty}
        onBack={requestBack}
        onSaveDraft={() => void builder.handleSave("draft")}
        onPublish={() => setPublishOpen(true)}
        onHistory={() => builder.setHistoryOpen(true)}
        onUndo={builder.undo}
        onRedo={builder.redo}
        menu={
          <MoreMenu
            items={[
              { label: "Start from a template", hint: templatesFor(activeLayout.formKey).length ? "Ready-made print-shop layouts" : "No templates for this form", icon: "ph-layout", onSelect: () => setTemplatesOpen(true) },
              { label: "Export as JSON", hint: "Download the draft to back it up or copy it to another shop", icon: "ph-download-simple", onSelect: exportLayout },
              { label: "Import JSON", hint: "Replace the draft with an exported file", icon: "ph-upload-simple", onSelect: () => fileInput.current?.click() },
              ...(DEFAULT_LAYOUTS.some((l) => l.formKey === activeLayout.formKey)
                ? [{ label: "Reset to built-in default", hint: "Replace the draft with the form the app ships with", icon: "ph-arrow-counter-clockwise", tone: "danger" as const, onSelect: () => builder.applySchema(DEFAULT_LAYOUTS.find((l) => l.formKey === activeLayout.formKey)!.schema as unknown as FormSchema, "Draft reset to the built-in layout") }]
                : []),
            ]}
          />
        }
        onPreview={() =>
          canPreview
            ? setPreviewOpen(true)
            : toast.info(
                "Preview is available for the Job and Transaction forms.",
              )
        }
      />

      <div className="flex flex-col lg:flex-row flex-1 lg:min-h-0 lg:overflow-hidden bg-slate-50">
        <FieldPalette
          onDragTypeStart={drag.setDraggedNewFieldType}
          onDragTypeEnd={() => drag.setDraggedNewFieldType(null)}
          onAddField={(fieldType) => {
            if (
              !activeLayout.schema.sections ||
              activeLayout.schema.sections.length === 0
            ) {
              toast.error("Please add a section first!");
              return;
            }
            builder.addField(activeLayout.schema.sections[0].id, fieldType);
          }}
          onAddSection={builder.addSection}
        />

        <BuilderCanvas
          layout={activeLayout}
          selectedFieldId={builder.selectedFieldId}
          drag={drag}
          onAddSection={builder.addSection}
          onUpdateSection={builder.updateSection}
          onSectionIconChange={builder.setSectionIcon}
          onRemoveSection={builder.removeSection}
          onAddField={(sectionId) => builder.addField(sectionId)}
          onSelectField={builder.selectField}
          onRemoveField={(sectionId, fieldId) =>
            void builder.requestRemoveField(sectionId, fieldId)
          }
          onDuplicateField={builder.duplicateField}
        />

        <PropertiesPanel
          layout={activeLayout}
          field={selectedField}
          sectionId={builder.selectedSectionId}
          users={builder.allUsers}
          onChange={builder.updateSelectedField}
          onRemoveOption={builder.handleRemoveOption}
          checkingUsage={builder.checkingUsage}
          onRoleChange={(role) => selectedField && builder.setFieldRole(selectedField.id, role)}
          onSelectField={builder.selectField}
          onDuplicate={() =>
            selectedField &&
            builder.selectedSectionId &&
            builder.duplicateField(builder.selectedSectionId, selectedField.id)
          }
          onArchive={(archived) =>
            selectedField &&
            builder.selectedSectionId &&
            builder.setFieldArchived(
              builder.selectedSectionId,
              selectedField.id,
              archived,
            )
          }
          onRemove={() =>
            selectedField &&
            builder.selectedSectionId &&
            void builder.requestRemoveField(
              builder.selectedSectionId,
              selectedField.id,
            )
          }
          removing={
            !!selectedField && builder.checkingField === selectedField.id
          }
          onClose={() => builder.selectField(null)}
        />
      </div>

      {builder.usageModalData && (
        <MigrateOptionDialog
          data={builder.usageModalData}
          value={builder.migrationValue}
          onValueChange={builder.setMigrationValue}
          migrating={builder.migrating}
          onCancel={() => builder.setUsageModalData(null)}
          onConfirm={builder.handleMigrateOption}
        />
      )}

      <RemoveFieldDialog
        prompt={builder.removePrompt}
        formNoun={formNoun}
        onArchive={() => {
          builder.setFieldArchived(
            builder.removePrompt!.sectionId,
            builder.removePrompt!.fieldId,
            true,
          );
          builder.setRemovePrompt(null);
          toast.success("Field archived. Save the layout to apply it.");
        }}
        onDelete={() => {
          builder.removeField(
            builder.removePrompt!.sectionId,
            builder.removePrompt!.fieldId,
          );
          builder.setRemovePrompt(null);
        }}
        onCancel={() => builder.setRemovePrompt(null)}
      />

      <UnsavedChangesDialog
        open={leavePrompt}
        saving={!!builder.saving}
        onSave={async () => {
          const ok = await builder.handleSave("draft");
          if (ok) {
            setLeavePrompt(false);
            builder.closeForm();
          }
        }}
        onDiscard={() => {
          setLeavePrompt(false);
          builder.closeForm();
        }}
        onCancel={() => setLeavePrompt(false)}
      />

      {canPreview && (
        <LayoutPreviewDialog
          layout={activeLayout}
          open={previewOpen}
          onClose={closePreview}
        />
      )}

      <PublishDialog
        open={publishOpen}
        formName={activeLayout.name}
        nextVersion={(activeLayout.publishedVersion ?? 0) + 1}
        changes={diffLayouts(builder.publishedSchema as never, activeLayout.schema as never)}
        publishing={builder.saving === "publish"}
        onConfirm={async (note) => {
          const ok = await builder.handleSave("publish", note);
          if (ok) setPublishOpen(false);
        }}
        onCancel={() => setPublishOpen(false)}
      />

      <TemplatesDialog
        open={templatesOpen}
        formKey={activeLayout.formKey}
        onPick={(t) => { setTemplatesOpen(false); builder.applySchema(t.schema, `Template “${t.name}” applied`); }}
        onClose={() => setTemplatesOpen(false)}
      />
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void importLayout(f); e.target.value = ""; }}
      />

      <HistoryDialog
        open={builder.historyOpen}
        versions={builder.versions}
        loading={builder.versionsLoading}
        liveVersion={activeLayout.publishedVersion}
        draft={activeLayout.schema}
        onRestore={builder.restoreVersion}
        onClose={() => builder.setHistoryOpen(false)}
      />
    </div>
  );
}
