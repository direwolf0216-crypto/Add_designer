import { describe, expect, it } from "vitest";
import { effectiveRole, findRoleField, inferRole, roleAssignments, withInferredRoles } from "../roles";
import type { FormLayout } from "../types";

const layout: FormLayout = {
  sections: [
    { id: "s1", title: "Client", fields: [
      { id: "fld_b_client", name: "Client Name / Company", type: "SINGLE_LINE" },
      { id: "fld_b_phone", name: "Phone Number", type: "PHONE" },
    ] },
    { id: "s2", title: "Job Details", isRepeatable: true, fields: [
      { id: "fld_b_date", name: "Order Date", type: "DATE" },
      { id: "field_due", name: "Due date", type: "DATE" },
      { id: "fld_b_job_category", name: "Job Category", type: "PICK_LIST" },
      { id: "field_size", name: "Size", type: "SINGLE_LINE" },
      { id: "field_qty", name: "Quantity", type: "NUMBER" },
      { id: "fld_b_status", name: "Status", type: "STATUS_PICKER" },
    ] },
    { id: "sec_job_financial", title: "Financials", fields: [
      { id: "fld_b_package", name: "Total Amount (₹)", type: "CURRENCY" },
      { id: "fld_b_advance", name: "Advance Paid (₹)", type: "CURRENCY" },
      { id: "field_disc", name: "Discount", type: "CURRENCY" },
    ] },
  ],
};

describe("field roles", () => {
  it("infers the old label heuristics", () => {
    expect(inferRole({ id: "x", name: "Delivery Date", type: "DATE" })).toBe("dueDate");
    expect(inferRole({ id: "x", name: "Qty", type: "NUMBER" })).toBe("quantity");
    expect(inferRole({ id: "x", name: "Notes", type: "SINGLE_LINE" })).toBeUndefined();
    expect(inferRole({ id: "fld_b_package", name: "Price", type: "CURRENCY" })).toBe("total");
  });

  it("finds role fields by inference until something is assigned explicitly", () => {
    expect(findRoleField(layout, "dueDate")?.id).toBe("field_due");
    expect(findRoleField(layout, "size")?.id).toBe("field_size");
    const renamed: FormLayout = { sections: [{ id: "s", title: "S", fields: [
      { id: "a", name: "Service", type: "PICK_LIST", role: "category" },
      { id: "b", name: "Category notes", type: "SINGLE_LINE" },
    ] }] };
    expect(findRoleField(renamed, "category")?.id).toBe("a");
    expect(effectiveRole(renamed, renamed.sections[0].fields[1])).toBeUndefined();
  });

  it("migrates a layout by filling roles once, one field per role", () => {
    const migrated = withInferredRoles(layout);
    const roles = migrated.sections.flatMap((s) => s.fields).map((f) => f.role);
    expect(roles).toEqual(["customer", "phone", "orderDate", "dueDate", "category", "size", "quantity", "status", "total", "advance", "discount"]);
    expect(withInferredRoles(migrated)).toBe(migrated);
    expect(roleAssignments(layout).every((a) => a.field && a.inferred || a.role.key === "email")).toBe(true);
  });
});
