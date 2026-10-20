import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { parseJson, route } from "@/lib/api/http";
import { clientIp, enforceRateLimit } from "@/lib/rateLimit";
import { generateTempPassword } from "@/lib/auth/tempPassword";

const bodySchema = z.object({ email: z.string().trim().toLowerCase().email() });

// Same response whether or not the account exists, so the endpoint can't be used to enumerate users.
const GENERIC_RESPONSE = {
  success: true,
  message: "If an account exists for this email, a temporary password has been generated. Please contact your Admin.",
};

export const POST = route(async (req) => {
  await enforceRateLimit(`forgot:ip:${clientIp(req.headers)}`, 10, 60 * 60 * 1000);
  const { email } = await parseJson(req, bodySchema);
  await enforceRateLimit(`forgot:email:${email}`, 3, 60 * 60 * 1000);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status === "INACTIVE") {
    return NextResponse.json(GENERIC_RESPONSE);
  }

  // Keep a still-valid code (e.g. an admin-issued invite) instead of letting anyone replace it.
  const active = await prisma.passwordResetToken.findFirst({ where: { email, expires: { gt: new Date() } } });
  if (!active) {
    await prisma.passwordResetToken.deleteMany({ where: { email } });
    await prisma.passwordResetToken.create({
      data: { email, token: generateTempPassword(), expires: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });
  }

  return NextResponse.json(GENERIC_RESPONSE);
});
