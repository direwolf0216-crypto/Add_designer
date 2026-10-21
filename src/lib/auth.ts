import type { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma, { prismaBase } from "@/lib/prisma";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { decode } from "next-auth/jwt";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { isRole } from "@/lib/permissions";
import { loadUserPermissions } from "@/lib/auth/session";

const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days
const RECHECK_INTERVAL_MS = 60 * 1000; // re-read role/status from the DB at most once a minute
// bcrypt hash of a random string, compared against when the user doesn't exist so that
// response timing does not reveal which emails have accounts.
const DUMMY_HASH = "$2b$10$Yer419NerdphrIcCqIjFZOXrWl8QHxkqq2KfidYTU91EkRLmKkx/q";

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** The id of the user whose session cookie accompanies the current request, if any. */
async function currentSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const raw =
    store.get("__Secure-next-auth.session-token")?.value ?? store.get("next-auth.session-token")?.value;
  if (!raw) return null;
  const token = await decode({ token: raw, secret: process.env.NEXTAUTH_SECRET as string });
  return token?.revoked ? null : (token?.sub ?? null);
}

function emailFromIdToken(idToken: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prismaBase),
  secret: process.env.NEXTAUTH_SECRET as string,
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE,
  },
  pages: {
    signIn: "/login",
  },
  debug: process.env.NODE_ENV === "development" && process.env.NEXTAUTH_DEBUG === "true",
  providers: [
    // Google is only used to link a Drive account to an already signed-in user, never to sign in.
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
        GoogleProvider({
          id: "google-drive",
          name: "Google Drive",
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          checks: ["pkce", "state"],
          authorization: {
            params: {
              scope: "openid email profile https://www.googleapis.com/auth/drive.file",
              prompt: "consent",
              access_type: "offline",
              response_type: "code",
            },
          },
        }),
      ]
      : []),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";
        if (!email || !password) {
          throw new Error("Invalid credentials");
        }

        const ip = clientIp(req?.headers as Record<string, string> | undefined);
        const allowed =
          (await rateLimit(`login:email:${email}`, 10, 15 * 60 * 1000)) &&
          (await rateLimit(`login:ip:${ip}`, 50, 15 * 60 * 1000));
        if (!allowed) {
          throw new Error("Too many attempts. Please wait a few minutes and try again.");
        }

        const user = await prisma.user.findUnique({ where: { email } });
        const isCorrectPassword = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);

        if (!user || !user.password) {
          throw new Error("Invalid credentials");
        }

        if (!isCorrectPassword) {
          // Admin-issued temporary passwords (invites / forgot-password) are single-use reset tokens
          // bound to this email; signing in with one sends the user to set a real password.
          const tempTokens = await prisma.passwordResetToken.findMany({
            where: { email, expires: { gt: new Date() } },
          });
          const match = tempTokens.find((t) => safeEqual(t.token, password));
          if (match) {
            throw new Error(`TEMPORARY_PASSWORD:${match.token}`);
          }
          throw new Error("Invalid credentials");
        }

        // Status is only revealed once the password is proven, so it can't be used to probe accounts.
        if (user.status === "INACTIVE") {
          throw new Error("Account deactivated");
        }

        return { id: user.id, name: user.name, email: user.email, image: user.image, role: user.role };
      },
    }),
  ],
  callbacks: {
    async signIn({ account }) {
      if (account?.provider !== "google-drive") return true;

      try {
        if (!account.providerAccountId) return false;

        // Link Drive to whoever is signed in right now, never to an account looked up by email.
        const userId = await currentSessionUserId();
        if (!userId) {
          return "/login?error=SessionRequired";
        }
        const dbUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!dbUser || dbUser.status === "INACTIVE") {
          return "/login?error=SessionRequired";
        }

        const existingLink = await prisma.account.findUnique({
          where: { provider_providerAccountId: { provider: "google-drive", providerAccountId: account.providerAccountId } },
        });
        if (existingLink && existingLink.userId !== userId) {
          return `/settings?section=google-drive&error=DriveIntegrationFailed&details=${encodeURIComponent(
            "This Google account is already linked to another user."
          )}`;
        }

        await prisma.account.upsert({
          where: {
            provider_providerAccountId: { provider: "google-drive", providerAccountId: account.providerAccountId },
          },
          create: {
            userId,
            type: account.type || "oauth",
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
            session_state: account.session_state as string | undefined,
          },
          update: {
            access_token: account.access_token,
            refresh_token: account.refresh_token ?? undefined,
            expires_at: account.expires_at,
            scope: account.scope,
            id_token: account.id_token,
          },
        });

        const connectedEmail = account.id_token ? emailFromIdToken(account.id_token) : null;
        await prisma.userIntegration.upsert({
          where: { userId_provider: { userId, provider: "google-drive" } },
          create: { userId, provider: "google-drive", connectedEmail },
          update: { connectedEmail },
        });

        // Returning a URL redirects straight back and stops NextAuth replacing the current session.
        return "/settings?section=google-drive&success=DriveConnected";
      } catch (error) {
        console.error("[auth] Drive linking failed", error);
        return "/settings?section=google-drive&error=DriveIntegrationFailed";
      }
    },

    async jwt({ token, user, account }) {
      if (account?.provider === "google-drive") {
        return token;
      }

      // Role, custom role and permissions are re-read on sign-in and then at most once a minute, so role
      // changes, permission edits and deactivation apply without waiting for the session to expire.
      const stale = Date.now() - (token.checkedAt ?? 0) > RECHECK_INTERVAL_MS;
      if (user) token.sub = user.id;
      if (token.sub && !token.revoked && (user || stale || !isRole(token.role))) {
        const current = await loadUserPermissions(token.sub);
        if (!current || current.status === "INACTIVE") {
          token.revoked = true;
        } else {
          token.role = current.role;
          token.customRoleId = current.customRoleId;
          token.roleName = current.roleName;
          token.permissions = current.permissions;
          token.revoked = false;
        }
        token.checkedAt = Date.now();
      }
      return token;
    },

    async session({ session, token }) {
      if (token.revoked || !token.sub) {
        // Treated as signed out by every server check (getSessionUser requires user.id).
        return { ...session, user: undefined } as unknown as typeof session;
      }
      if (session.user) {
        session.user.id = token.sub;
        session.user.role = isRole(token.role) ? token.role : "STAFF";
        session.user.customRoleId = token.customRoleId ?? null;
        session.user.roleName = token.roleName ?? null;
        session.user.permissions = token.permissions;
      }
      return session;
    },
  },
};
