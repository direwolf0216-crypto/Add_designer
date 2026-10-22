import { describe, expect, it } from "vitest";
import { statusIsStage, syncStatusWithStage } from "../tracking";

const stageLayout = { sections: [{ id: "s", title: "Job Details", fields: [{ id: "fld_b_status", name: "Status", type: "STATUS_PICKER", statusOptions: [{ label: "Pending" }, { label: "Printing" }] }] }] } as never;
const twoPickers = { sections: [{ id: "s", title: "Job Details", fields: [{ id: "fld_b_job_status", name: "Job Status", type: "STATUS_PICKER" }, { id: "fld_b_status", name: "Status", type: "STATUS_PICKER" }] }] } as never;

describe("status and stage sync", () => {
  it("treats the stage picker as the job status when it is the first status picker", () => {
    expect(statusIsStage(stageLayout)).toBe(true);
    expect(statusIsStage(twoPickers)).toBe(false);
  });
  it("fills the status when only the stage moved (board / queue)", () => {
    const out = syncStatusWithStage(stageLayout, { status: "Pending", stage: "Pending" }, { customData: { fld_b_status: "Printing" } });
    expect(out.status).toBe("Printing");
  });
  it("moves the stage when only the status changed (details picker)", () => {
    const out = syncStatusWithStage(stageLayout, { status: "Printing", stage: "Printing" }, { status: "Pending", customData: { fld_b_status: "Printing" } });
    expect(out.customData.fld_b_status).toBe("Pending");
    expect(out.status).toBe("Pending");
  });
  it("leaves separate job-status and stage pickers alone", () => {
    const out = syncStatusWithStage(twoPickers, { status: "Confirmed", stage: "Printing" }, { status: "Completed", customData: { fld_b_status: "Printing" } });
    expect(out.customData.fld_b_status).toBe("Printing");
    expect(out.status).toBe("Completed");
  });
});
