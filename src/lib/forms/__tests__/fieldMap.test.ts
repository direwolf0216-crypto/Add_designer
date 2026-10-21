import { describe, expect, it } from "vitest";
import { JOB_DETAILS_FIELD_MAP, JOB_FORM_FIELD_MAP, TRANSACTION_FIELD_MAP, allFields, fieldNameFor } from "../fieldMap";

describe("field maps", () => {
  it("maps job layout ids to job columns", () => {
    expect(JOB_FORM_FIELD_MAP).toEqual({
      fld_b_client: "title", fld_b_phone: "phone", fld_b_email: "email",
      fld_b_date: "date", fld_b_time: "time", fld_b_job_category: "category",
      fld_b_location: "location", fld_b_status: "status", fld_b_package: "package", fld_b_advance: "advance",
      fld_proof_delivered: "proofDelivered",
    });
  });

  it("only the details view understands the legacy fld_b_category id", () => {
    expect(fieldNameFor(JOB_DETAILS_FIELD_MAP, "fld_b_category")).toBe("category");
    expect(fieldNameFor(JOB_FORM_FIELD_MAP, "fld_b_category")).toBe("fld_b_category");
    expect({ ...JOB_DETAILS_FIELD_MAP, fld_b_category: undefined }).toEqual({ ...JOB_FORM_FIELD_MAP, fld_b_category: undefined });
  });

  it("maps transaction ids and passes unknown ids through", () => {
    expect(fieldNameFor(TRANSACTION_FIELD_MAP, "fld_tx_mode")).toBe("paymentMode");
    expect(fieldNameFor(TRANSACTION_FIELD_MAP, "fld_tx_desc")).toBe("description");
    expect(fieldNameFor(TRANSACTION_FIELD_MAP, "fld_custom_1")).toBe("fld_custom_1");
  });

  it("allFields flattens sections and tolerates missing layouts", () => {
    expect(allFields(null)).toEqual([]);
    const layout = { sections: [{ id: "a", fields: [{ id: "1", name: "x", type: "TEXT" }] }, { id: "b", fields: [{ id: "2", name: "y", type: "TEXT" }] }] };
    expect(allFields(layout).map((f) => f.id)).toEqual(["1", "2"]);
  });
});
