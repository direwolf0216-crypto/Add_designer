import type { DefaultSession } from "next-auth";
import type { AppRole } from "@/lib/permissions";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: AppRole;
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
    /** Epoch ms of the last time role/status were re-read from the database. */
    checkedAt?: number;
    /** Set when the user was deleted or deactivated; the session is treated as signed out. */
    revoked?: boolean;
  }
}
