"use client";

import { useReducer, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { toast } from "sonner";
import { asList, fetcher } from "@/lib/swr";
import { DEFAULT_LAYOUTS } from "@/lib/defaultLayouts";
import { FIXED_OPTIONS_FIELD_ID } from "@/lib/layout-builder/fieldTypes";
import {
  canRedo,
  canUndo,
  findSelectedField,
  getActiveLayout,
  hasUnpublished,
  initialLayoutBuilderState,
  isDirty,
  layoutBuilderReducer,
  type SectionEdits,
} from "@/lib/layout-builder/reducer";
import type { FieldPosition, FieldRole, FormField, FormLayout } from "@/lib/layout-builder/types";

/** Timestamp-based id for new sections/fields; only called from event handlers. */
const newLayoutId = (prefix: string) => `${prefix}_${Date.now()}`;

export interface UsageModalData {
  formKey: string;
  fieldId: string;
  oldValue: string;
  availableOptions: string[];
  inUseCount: number;
}

/** A field whose removal is awaiting the admin's choice because records hold values for it. */
export interface RemoveFieldPrompt {
  sectionId: string;
  fieldId: string;
  fieldName: string;
  count: number;
}

export interface LayoutVersion {
  id: string;
  version: number;
  name: string;
  note: string | null;
  authorName: string | null;
  createdAt: string;
  schema: FormLayout["schema"];
}

export type SaveAction = "draft" | "publish";

export interface BuilderUser {
  id: string;
  name: string;
  role: string;
  roleName?: string;
}

export function useLayoutBuilder() {
  const [state, dispatch] = useReducer(layoutBuilderReducer, initialLayoutBuilderState);
  const [saving, setSaving] = useState<SaveAction | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [removePrompt, setRemovePrompt] = useState<RemoveFieldPrompt | null>(null);
  const [checkingField, setCheckingField] = useState<string | null>(null);

  const { data: usersData } = useSWR("/api/users", fetcher);
  const allUsers = asList<BuilderUser>(usersData);

  // Safe deletion of pick-list options that existing records still use.
  const [checkingUsage, setCheckingUsage] = useState(false);
  const [usageModalData, setUsageModalData] = useState<UsageModalData | null>(null);
  const [migrationValue, setMigrationValue] = useState("");
  const [migrating, setMigrating] = useState(false);

  // Layouts are edited as a local draft: seed it once from the first successful load. Later revalidations
  // (e.g. the globalMutate after a save) must not clobber unsaved edits.
  const { data: dbLayouts, error: layoutsError } = useSWR<FormLayout[]>("/api/settings/layouts", fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    onError: () => toast.error("Failed to load form layouts"),
  });
  if (!state.seeded && Array.isArray(dbLayouts)) {
    dispatch({ type: "seed", defaults: DEFAULT_LAYOUTS as unknown as FormLayout[], fromServer: dbLayouts });
  }
  const loading = !state.seeded && !layoutsError;

  const activeLayout = getActiveLayout(state);
  const selected = findSelectedField(state);
  const selectedField = selected?.field ?? null;
  const selectedSectionId = selected?.sectionId ?? null;

  /**
   * "draft" stores the work in progress without touching the live form; "publish" makes it live and
   * records a version. Returns whether it succeeded.
   */
  const handleSave = async (action: SaveAction = "draft", note?: string) => {
    if (!activeLayout) return false;
    setSaving(action);
    try {
      const res = await fetch("/api/settings/layouts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formKey: activeLayout.formKey, name: activeLayout.name, description: activeLayout.description, schema: activeLayout.schema, action, note }),
      });
      if (!res.ok) throw new Error("Failed to save layout");
      const saved = (await res.json()) as { publishedVersion?: number | null };
      if (action === "publish") {
        dispatch({ type: "markPublished", formKey: activeLayout.formKey, version: saved.publishedVersion ?? 0 });
        toast.success(`${activeLayout.name} published`, { description: `Version ${saved.publishedVersion ?? ""} is live for everyone now.` });
        globalMutate(`/api/settings/layouts/${activeLayout.formKey}`);
        globalMutate(`/api/settings/layouts/${activeLayout.formKey}/versions`);
      } else {
        dispatch({ type: "markSaved", formKey: activeLayout.formKey });
        toast.success("Draft saved", { description: "The live form is unchanged until you publish." });
      }
      globalMutate(`/api/settings/layouts`);
    } catch {
      toast.error(action === "publish" ? "Failed to publish layout" : "Failed to save draft");
      return false;
    } finally {
      setSaving(null);
    }
    return true;
  };

  // Publish history, loaded when the panel opens.
  const versionsKey = historyOpen && activeLayout ? `/api/settings/layouts/${activeLayout.formKey}/versions` : null;
  const { data: versionsData, isLoading: versionsLoading } = useSWR<{ versions: LayoutVersion[] }>(versionsKey, fetcher, { revalidateOnFocus: false });
  /** Replaces the draft's schema (templates, import, reset); undo brings the previous draft back. */
  const applySchema = (schema: FormLayout["schema"], title: string, description?: string) => {
    dispatch({ type: "replaceSchema", schema });
    toast.success(title, { description: description ?? "Review the draft, then publish to make it live. Undo reverts." });
  };
  const restoreVersion = (v: LayoutVersion) => {
    dispatch({ type: "replaceSchema", schema: v.schema });
    setHistoryOpen(false);
    toast.success(`Version ${v.version} loaded into the draft`, { description: "Review it, then publish to make it live. Undo reverts." });
  };

  // --- Navigation / selection ---
  const openForm = (formKey: string) => dispatch({ type: "openForm", formKey });
  const closeForm = () => dispatch({ type: "closeForm" });
  const selectField = (fieldId: string | null) => dispatch({ type: "selectField", fieldId });

  const createForm = (name: string, description: string) => {
    const formKey = name.toUpperCase().replace(/[^A-Z0-9]/g, "_") + "_" + Date.now();
    dispatch({ type: "createForm", formKey, name, description });
  };

  // --- Sections ---
  const addSection = () => dispatch({ type: "addSection", id: newLayoutId("sec") });
  const updateSection = (sectionId: string, updates: SectionEdits) => dispatch({ type: "updateSection", sectionId, updates });
  const setSectionIcon = (sectionId: string, icon: string) => dispatch({ type: "setSectionIcon", sectionId, icon });
  const removeSection = (sectionId: string) => dispatch({ type: "removeSection", sectionId });
  const moveSection = (sourceId: string, targetId: string) => dispatch({ type: "moveSection", sourceId, targetId });

  // --- Fields ---
  const addField = (sectionId: string, fieldType: string = "SINGLE_LINE", index?: number) =>
    dispatch({ type: "addField", sectionId, fieldType, id: newLayoutId("field"), index });
  const moveField = (from: FieldPosition, toSectionId: string, toIndex: number) =>
    dispatch({ type: "moveField", from, toSectionId, toIndex });
  const removeField = (sectionId: string, fieldId: string) => dispatch({ type: "removeField", sectionId, fieldId });
  const updateSelectedField = (updates: Partial<FormField>) => dispatch({ type: "updateSelectedField", updates });
  const duplicateField = (sectionId: string, fieldId: string) =>
    dispatch({ type: "duplicateField", sectionId, fieldId, id: newLayoutId("field") });
  const setFieldArchived = (sectionId: string, fieldId: string, archived: boolean) =>
    dispatch({ type: "setFieldArchived", sectionId, fieldId, archived });
  const setFieldRole = (fieldId: string, role: FieldRole | null) => dispatch({ type: "setFieldRole", fieldId, role });
  const undo = () => dispatch({ type: "undo" });
  const redo = () => dispatch({ type: "redo" });

  /**
   * Delete protection: a field that records still hold values for is not removed outright. The admin is
   * shown how many and offered to archive it (hidden from the form, values stay readable) instead.
   */
  const requestRemoveField = async (sectionId: string, fieldId: string) => {
    if (!activeLayout) return;
    const field = activeLayout.schema.sections.find((s) => s.id === sectionId)?.fields.find((f) => f.id === fieldId);
    if (!field) return;
    if (field.archived) { removeField(sectionId, fieldId); return; }
    // Unsaved fields have no records yet.
    const saved = state.baselines[activeLayout.formKey]?.includes(`"id":"${fieldId}"`);
    if (!saved) { removeField(sectionId, fieldId); return; }
    setCheckingField(fieldId);
    try {
      const res = await fetch("/api/settings/layouts/field-usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formKey: activeLayout.formKey, fieldId }),
      });
      const data = res.ok ? await res.json() : { count: 0 };
      if (data.count > 0) setRemovePrompt({ sectionId, fieldId, fieldName: field.name ?? "Field", count: data.count });
      else removeField(sectionId, fieldId);
    } catch {
      toast.error("Couldn't check whether the field is in use");
    } finally {
      setCheckingField(null);
    }
  };

  // --- Option removal with usage check / migration ---
  const handleRemoveOption = async (idx: number) => {
    if (!activeLayout || !selectedField || !selectedField.options || !selectedSectionId) return;
    if (selectedField.id === FIXED_OPTIONS_FIELD_ID) {
      // INCOME / EXPENSE drive every financial report and are a database enum.
      toast.error("Transaction type options are fixed and can't be removed.");
      return;
    }
    const options = selectedField.options;
    const oldValue = options[idx];
    const target = { sectionId: selectedSectionId, fieldId: selectedField.id };

    setCheckingUsage(true);
    try {
      const res = await fetch("/api/settings/layouts/check-usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formKey: activeLayout.formKey, fieldId: selectedField.id, value: oldValue }),
      });
      const data = await res.json();
      if (data.inUse) {
        setUsageModalData({
          formKey: activeLayout.formKey,
          fieldId: selectedField.id,
          oldValue,
          inUseCount: data.count,
          availableOptions: options.filter((o) => o !== oldValue),
        });
      } else {
        const newOpts = options.filter((_, i) => i !== idx);
        dispatch({ type: "updateField", ...target, updates: { options: newOpts } });
      }
    } catch {
      toast.error("Failed to check usage");
    } finally {
      setCheckingUsage(false);
    }
  };

  const handleMigrateOption = async () => {
    if (!usageModalData || !migrationValue) return;
    const newOpts = (selectedField?.options || []).filter((o) => o !== usageModalData.oldValue);
    const target = selectedField && selectedSectionId ? { sectionId: selectedSectionId, fieldId: selectedField.id } : null;
    setMigrating(true);
    try {
      const res = await fetch("/api/settings/layouts/migrate-value", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...usageModalData, newValue: migrationValue }),
      });
      if (res.ok) {
        toast.success("Successfully migrated existing records!");
        if (target) dispatch({ type: "updateField", ...target, updates: { options: newOpts } });
        setUsageModalData(null);
        setMigrationValue("");
      } else {
        throw new Error("Failed to migrate");
      }
    } catch {
      toast.error("Migration failed");
    } finally {
      setMigrating(false);
    }
  };

  return {
    layouts: state.layouts,
    loading,
    saving,
    allUsers,
    activeLayout,
    selectedFieldId: state.selectedFieldId,
    selectedField,
    selectedSectionId,
    handleSave,
    unpublished: hasUnpublished(state),
    publishedSchema: activeLayout ? (JSON.parse(state.published[activeLayout.formKey] ?? "null") as FormLayout["schema"] | null) : null,
    historyOpen,
    setHistoryOpen,
    versions: versionsData?.versions ?? [],
    versionsLoading,
    restoreVersion,
    applySchema,
    dirty: isDirty(state),
    canUndo: canUndo(state),
    canRedo: canRedo(state),
    undo,
    redo,
    duplicateField,
    setFieldArchived,
    setFieldRole,
    requestRemoveField,
    removePrompt,
    setRemovePrompt,
    checkingField,
    openForm,
    closeForm,
    selectField,
    createForm,
    addSection,
    updateSection,
    setSectionIcon,
    removeSection,
    moveSection,
    addField,
    moveField,
    removeField,
    updateSelectedField,
    // option removal / migration
    checkingUsage,
    usageModalData,
    setUsageModalData,
    migrationValue,
    setMigrationValue,
    migrating,
    handleRemoveOption,
    handleMigrateOption,
  };
}

export type LayoutBuilderApi = ReturnType<typeof useLayoutBuilder>;
