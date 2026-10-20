import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { badRequest, parseJson, route } from "@/lib/api/http";
import { clientIp, enforceRateLimit } from "@/lib/rateLimit";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/tempPassword";

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  token: z.string().trim().min(1),
  password: z.string().min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`).max(200),
});

export const POST = route(async (req) => {
  await enforceRateLimit(`reset:ip:${clientIp(req.headers)}`, 20, 15 * 60 * 1000);
  const { email, token, password } = await parseJson(req, bodySchema);
  await enforceRateLimit(`reset:email:${email}`, 5, 15 * 60 * 1000);

  // The code must match *this* email; a bare token is never enough.
  const existingToken = await prisma.passwordResetToken.findUnique({ where: { email_token: { email, token } } });
  if (!existingToken || existingToken.expires < new Date()) {
    throw badRequest("This temporary password is invalid or has expired.");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status === "INACTIVE") {
    throw badRequest("This temporary password is invalid or has expired.");
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } }),
    prisma.passwordResetToken.deleteMany({ where: { email } }),
  ]);

  return NextResponse.json({ success: true, message: "Password updated successfully!" });
});
