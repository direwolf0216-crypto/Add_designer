import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { badRequest, parseJson, route } from "@/lib/api/http";
import { clientIp, enforceRateLimit } from "@/lib/rateLimit";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/tempPassword";
import { identifierLookup } from "@/lib/auth/username";

const bodySchema = z.object({
  /** Email or username, as typed on the sign-in page. */
  email: z.string().trim().toLowerCase().min(3).max(254),
  token: z.string().trim().min(1),
  password: z.string().min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`).max(200),
});

export const POST = route(async (req) => {
  await enforceRateLimit(`reset:ip:${clientIp(req.headers)}`, 20, 15 * 60 * 1000);
  const { email: identifier, token, password } = await parseJson(req, bodySchema);
  await enforceRateLimit(`reset:email:${identifier}`, 5, 15 * 60 * 1000);

  const user = await prisma.user.findUnique({ where: identifierLookup(identifier) });
  if (!user || !user.email || user.status === "INACTIVE") {
    throw badRequest("This temporary password is invalid or has expired.");
  }
  const email = user.email.toLowerCase();

  // The code must match *this* account's email; a bare token is never enough.
  const existingToken = await prisma.passwordResetToken.findUnique({ where: { email_token: { email, token } } });
  if (!existingToken || existingToken.expires < new Date()) {
    throw badRequest("This temporary password is invalid or has expired.");
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } }),
    prisma.passwordResetToken.deleteMany({ where: { email } }),
  ]);

  return NextResponse.json({ success: true, message: "Password updated successfully!" });
});
