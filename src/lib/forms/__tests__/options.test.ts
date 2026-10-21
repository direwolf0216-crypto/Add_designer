import { describe, expect, it } from "vitest";
import { getFieldIcon } from "../fieldIcon";
import { resolveFieldKind } from "../fieldKind";
import { collapseFileArray, isFileLikeValue, isUploadableFile } from "../files";
import {
  availableStatusOptions,
  defaultsToFirstOption,
  filterUsersForField,
  firstOptionDefault,
  optionLabels,
  splitMultiValue,
  withLegacyOptions,
} from "../options";
import type { FormField } from "../types";

const field = (over: Partial<FormField>): FormField => ({ id: "f", name: "Field", type: "SINGLE_LINE", ...over });

describe("option helpers", () => {
  it("splits multi-select values", () => {
    expect(splitMultiValue("a, b ,c")).toEqual(["a", "b", "c"]);
    expect(splitMultiValue("  ")).toEqual([]);
    expect(splitMultiValue(["x"])).toEqual(["x"]);
    expect(splitMultiValue(undefined)).toEqual([]);
  });

  it("labels options in either format and keeps legacy selections", () => {
    expect(optionLabels(["A", { label: "B", value: "b" }, { value: "c" }])).toEqual(["A", "B", "c"]);
    expect(withLegacyOptions(["A", { value: "b", label: "B" }], ["A", "b", "Old"])).toEqual(["A", { value: "b", label: "B" }, "Old"]);
  });

  it("defaults pick-lists to their first option", () => {
    expect(firstOptionDefault(field({ options: ["One", "Two"] }))).toBe("One");
    expect(firstOptionDefault(field({ options: [{ label: "L" }] }))).toBe("L");
    expect(defaultsToFirstOption(field({ type: "PICK_LIST", options: ["x"] }))).toBe(true);
    expect(defaultsToFirstOption(field({ type: "CATEGORY_PICKER", options: ["x"] }))).toBe(true);
    expect(defaultsToFirstOption(field({ id: "fld_b_job_category", type: "MULTI_SELECT", options: ["x"] }))).toBe(true);
    expect(defaultsToFirstOption(field({ type: "PICK_LIST", options: [] }))).toBe(false);
    expect(defaultsToFirstOption(field({ type: "MULTI_SELECT", options: ["x"] }))).toBe(false);
  });

  it("filters users by role or id", () => {
    const users = [{ id: "1", role: "ADMIN" }, { id: "2", role: "STAFF" }];
    expect(filterUsersForField(users, undefined)).toBe(users);
    expect(filterUsersForField(users, { mode: "ROLES", roles: ["STAFF"] })).toEqual([users[1]]);
    expect(filterUsersForField(users, { mode: "USERS", userIds: ["1"] })).toEqual([users[0]]);
    expect(filterUsersForField(users, { mode: "ROLES", roles: [] })).toBe(users);
  });

  it("hides restricted statuses while the linked date is in the future", () => {
    const status = field({
      type: "STATUS_PICKER",
      statusOptions: [{ label: "Pending" }, { label: "Delivered" }],
      futureDateRestriction: { enabled: true, dateFieldId: "fld_b_date", restrictedStatuses: ["Delivered"] },
    });
    const now = new Date(2026, 5, 10, 15, 0);
    expect(availableStatusOptions(status, "2026-06-11", now).map((o) => o.label)).toEqual(["Pending"]);
    expect(availableStatusOptions(status, "2026-06-09", now).map((o) => o.label)).toEqual(["Pending", "Delivered"]);
    expect(availableStatusOptions(status, "", now)).toHaveLength(2);
    expect(availableStatusOptions({ ...status, futureDateRestriction: { enabled: false } }, "2030-01-01", now)).toHaveLength(2);
  });
});

describe("resolveFieldKind", () => {
  it("job form supports pickers, user lists and files; CATEGORY_PICKER falls back to text", () => {
    expect(resolveFieldKind(field({ type: "USER_PICKLIST" }), "job")).toBe("user");
    expect(resolveFieldKind(field({ type: "MULTI_USER_PICKLIST" }), "job")).toBe("multiUser");
    expect(resolveFieldKind(field({ type: "TIME" }), "job")).toBe("time");
    expect(resolveFieldKind(field({ type: "CATEGORY_PICKER" }), "job")).toBe("text");
    expect(resolveFieldKind(field({ type: "FILE" }), "job")).toBe("file");
    expect(resolveFieldKind(field({ type: "CURRENCY" }), "job")).toBe("text");
  });

  it("repeatable entries support a small subset plus currency / discount inputs", () => {
    expect(resolveFieldKind(field({ type: "CATEGORY_PICKER" }), "jobRepeatable")).toBe("pickList");
    expect(resolveFieldKind(field({ type: "CURRENCY" }), "jobRepeatable")).toBe("currency");
    expect(resolveFieldKind(field({ type: "NUMBER", name: "Discount %" }), "jobRepeatable")).toBe("currency");
    expect(resolveFieldKind(field({ type: "STATUS_PICKER" }), "jobRepeatable")).toBe("text");
    expect(resolveFieldKind(field({ type: "CHECKBOX" }), "jobRepeatable")).toBe("text");
  });

  it("transaction form has no time or user pickers", () => {
    expect(resolveFieldKind(field({ type: "TIME" }), "transaction")).toBe("text");
    expect(resolveFieldKind(field({ type: "USER_PICKLIST" }), "transaction")).toBe("text");
    expect(resolveFieldKind(field({ type: "MULTI_LINE" }), "transaction")).toBe("textarea");
    expect(resolveFieldKind(field({ type: "STATUS_PICKER" }), "transaction")).toBe("status");
  });
});

describe("getFieldIcon", () => {
  it("guesses from name first, then type", () => {
    expect(getFieldIcon("Client Name", "SINGLE_LINE")).toBe("ph-user");
    expect(getFieldIcon("Order Date", "DATE")).toBe("ph-calendar-blank");
    expect(getFieldIcon("Start", "TIME")).toBe("ph-clock");
    expect(getFieldIcon("Discount", "CURRENCY")).toBe("ph-tag");
    expect(getFieldIcon("Amount", "CURRENCY")).toBe("ph-currency-inr");
    expect(getFieldIcon("", "SINGLE_LINE")).toBe("ph-text-aa");
  });
});

describe("file values", () => {
  it("collapses single-attachment arrays", () => {
    const file = new File(["x"], "a.png");
    expect(collapseFileArray([file])).toBe(file);
    expect(collapseFileArray([{ driveFile: { id: "1" } }])).toEqual({ driveFile: { id: "1" } });
    expect(collapseFileArray(["data:image/png;base64,AAA"])).toBe("data:image/png;base64,AAA");
    expect(collapseFileArray(["a", "b"])).toEqual(["a", "b"]);
    expect(collapseFileArray([])).toEqual([]);
    expect(isFileLikeValue(null)).toBe(false);
    expect(isUploadableFile(new Blob(["x"]))).toBe(true);
    expect(isUploadableFile({ driveFile: {} })).toBe(false);
  });
});
