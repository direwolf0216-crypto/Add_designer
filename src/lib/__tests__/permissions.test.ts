import { describe, expect, it } from "vitest";
import { PERMISSIONS, parseRoleKey, resolvePermissions, roleKey, roleLabel } from "../permissions";

describe("permissions", () => {
  it("gives Owner and Admin everything", () => {
    expect(resolvePermissions("OWNER", null, [])).toEqual([...PERMISSIONS]);
    expect(resolvePermissions("ADMIN", null, [{ role: "ADMIN", permission: "view_amounts", enabled: false }])).toEqual([...PERMISSIONS]);
  });

  it("applies Staff overrides on top of the defaults", () => {
    const staff = resolvePermissions("STAFF", null, [
      { role: "STAFF", permission: "view_amounts", enabled: false },
      { role: "STAFF", permission: "view_all_jobs", enabled: true },
    ]);
    expect(staff).toContain("view_all_jobs");
    expect(staff).not.toContain("view_amounts");
    expect(staff).toContain("manage_jobs");
  });

  it("takes custom roles' permissions from the role, ignoring unknown ones", () => {
    expect(resolvePermissions("CUSTOM", ["view_designs", "manage_users", "nope"], [])).toEqual(["view_designs"]);
    expect(resolvePermissions("CUSTOM", null, [])).toEqual([]);
  });

  it("round-trips role keys", () => {
    expect(roleKey("CUSTOM", "abc")).toBe("custom:abc");
    expect(roleKey("STAFF", null)).toBe("STAFF");
    expect(parseRoleKey("custom:abc")).toEqual({ role: "CUSTOM", customRoleId: "abc" });
    expect(parseRoleKey("ADMIN")).toEqual({ role: "ADMIN", customRoleId: null });
    expect(parseRoleKey("custom:")).toBeNull();
    expect(parseRoleKey("DESIGNER")).toBeNull();
    expect(roleLabel("CUSTOM", "Designer")).toBe("Designer");
    expect(roleLabel("OWNER")).toBe("Owner");
  });
});
