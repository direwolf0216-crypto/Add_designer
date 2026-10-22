import { describe, expect, it } from "vitest";
import { exportFileName, parseLayoutFile, serializeLayout } from "../transfer";
import { LAYOUT_TEMPLATES } from "../templates";
import { withInferredRoles } from "@/lib/forms/roles";

describe("layout export / import", () => {
  const layout = { formKey: "JOB_FORM", name: "Job Form", description: "d", schema: { sections: [{ id: "s", title: "S", fields: [{ id: "a", name: "A", type: "SINGLE_LINE", mandatory: false }] }] } };

  it("round-trips through the export file", () => {
    const text = serializeLayout(layout, new Date("2026-10-22T00:00:00Z"));
    expect(exportFileName(layout, new Date("2026-10-22T00:00:00Z"))).toBe("job_form-layout-2026-10-22.json");
    const parsed = parseLayoutFile(text);
    expect(parsed.ok && parsed.formKey).toBe("JOB_FORM");
    expect(parsed.ok && parsed.schema.sections[0].fields[0].id).toBe("a");
  });

  it("accepts a bare schema and rejects broken files with a reason", () => {
    expect(parseLayoutFile(JSON.stringify(layout.schema)).ok).toBe(true);
    expect(parseLayoutFile("nope")).toMatchObject({ ok: false, error: expect.stringMatching(/valid JSON/) });
    expect(parseLayoutFile(JSON.stringify({ hello: 1 }))).toMatchObject({ ok: false });
    expect(parseLayoutFile(JSON.stringify({ sections: [{ id: "s", fields: [{ id: "a", type: "X" }, { id: "a", type: "X" }] }] }))).toMatchObject({ ok: false, error: expect.stringMatching(/twice/) });
  });
});

describe("templates", () => {
  it("are well formed: unique field ids, a job-details section, roles for the essentials", () => {
    for (const t of LAYOUT_TEMPLATES) {
      const fields = t.schema.sections.flatMap((s) => s.fields);
      expect(new Set(fields.map((f) => f.id)).size).toBe(fields.length);
      expect(parseLayoutFile(JSON.stringify(t.schema)).ok).toBe(true);
      if (t.formKey === "JOB_FORM") {
        const roled = withInferredRoles(t.schema as never) as typeof t.schema;
        const roles = new Set(roled.sections.flatMap((s) => s.fields).map((f) => f.role));
        ["customer", "phone", "category", "status", "total", "advance"].forEach((r) => expect(roles.has(r as never)).toBe(true));
        expect(t.schema.sections.some((s) => s.id === "sec_job_financial")).toBe(true);
      }
    }
  });
});
