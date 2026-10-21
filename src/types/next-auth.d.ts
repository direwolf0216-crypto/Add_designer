import type { DefaultSession } from "next-auth";
import type { AppRole, Permission } from "@/lib/permissions";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: AppRole;
      customRoleId?: string | null;
      /** Custom role name (null for built-in roles). */
      roleName?: string | null;
      permissions?: Permission[];
    };
  }

  interface User {
    role?: AppRole;
    status?: "ACTIVE" | "PENDING" | "INACTIVE";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AppRole;
    customRoleId?: string | null;
    roleName?: string | null;
    permissions?: Permission[];
    /** Epoch ms of the last time role/status were re-read from the database. */
    checkedAt?: number;
    /** Set when the user was deleted or deactivated; the session is treated as signed out. */
    revoked?: boolean;
  }
}
