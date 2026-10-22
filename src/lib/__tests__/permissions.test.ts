import { describe, expect, it } from "vitest";
import { PERMISSIONS, parseRoleKey, resolvePermissions, roleKey, roleLabel } from "../permissions";

describe("permissions", () => {
  it("gives Admin everything", () => {
    expect(resolvePermissions("ADMIN", null, [])).toEqual([...PERMISSIONS]);
    expect(resolvePermissions("ADMIN", null, [{ role: "ADMIN", permission: "view_amounts", enabled: false }])).toEqual([...PERMISSIONS]);
  });

  it("gives Manager everything by default, with its own switches", () => {
    expect(resolvePermissions("MANAGER", null, [])).toEqual([...PERMISSIONS]);
    const manager = resolvePermissions("MANAGER", null, [
      { role: "MANAGER", permission: "manage_transactions", enabled: false },
      { role: "STAFF", permission: "view_amounts", enabled: false },
    ]);
    expect(manager).not.toContain("manage_transactions");
    expect(manager).toContain("view_amounts");
  });

  it("hides amounts from Staff by default", () => {
    expect(resolvePermissions("STAFF", null, [])).not.toContain("view_amounts");
    expect(resolvePermissions("STAFF", null, [{ role: "STAFF", permission: "view_amounts", enabled: true }])).toContain("view_amounts");
  });

  it("applies Staff overrides on top of the defaults", () => {
    const staff = resolvePermissions("STAFF", null, [
      { role: "STAFF", permission: "view_amounts", enabled: false },
      { role: "STAFF", permission: "view_all_jobs", enabled: true },
    ]);
    expect(staff).toContain("view_all_jobs");
    expect(staff).not.toContain("view_amounts");
    expect(staff).toContain("create_jobs");
    expect(staff).toContain("edit_jobs");
    expect(staff).not.toContain("delete_jobs");
  });

  it("expands legacy manage_* names into view/create/edit/delete", () => {
    expect(resolvePermissions("CUSTOM", ["manage_jobs", "manage_transactions"], [])).toEqual([
      "create_jobs", "edit_jobs", "delete_jobs", "create_transactions", "edit_transactions", "delete_transactions",
    ]);
    const staff = resolvePermissions("STAFF", null, [{ role: "STAFF", permission: "manage_transactions", enabled: false }]);
    expect(staff).not.toContain("create_transactions");
    expect(staff).not.toContain("edit_transactions");
  });

  it("takes custom roles' permissions from the role, ignoring unknown ones", () => {
    expect(resolvePermissions("CUSTOM", ["view_amounts", "manage_users", "nope"], [])).toEqual(["view_amounts"]);
    expect(resolvePermissions("CUSTOM", null, [])).toEqual([]);
  });

  it("round-trips role keys", () => {
    expect(roleKey("CUSTOM", "abc")).toBe("custom:abc");
    expect(roleKey("STAFF", null)).toBe("STAFF");
    expect(parseRoleKey("custom:abc")).toEqual({ role: "CUSTOM", customRoleId: "abc" });
    expect(parseRoleKey("ADMIN")).toEqual({ role: "ADMIN", customRoleId: null });
    expect(parseRoleKey("MANAGER")).toEqual({ role: "MANAGER", customRoleId: null });
    expect(parseRoleKey("OWNER")).toEqual({ role: "ADMIN", customRoleId: null });
    expect(parseRoleKey("custom:")).toBeNull();
    expect(parseRoleKey("DESIGNER")).toBeNull();
    expect(roleLabel("CUSTOM", "Designer")).toBe("Designer");
    expect(roleLabel("MANAGER")).toBe("Manager");
  });
});
