import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { parseJson, route } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/session";

const endpointSchema = z
  .string()
  .max(2048)
  .url()
  .refine((value) => value.startsWith("https://"), { message: "Endpoint must be an https URL" });

const subscribeSchema = z.object({
  endpoint: endpointSchema,
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(256),
  }),
});

const unsubscribeSchema = z.object({ endpoint: endpointSchema });

export const POST = route(async (req) => {
  const { id: userId } = await requireUser();
  const { endpoint, keys } = await parseJson(req, subscribeSchema);

  // A push endpoint is an unguessable capability URL held by the browser, so whoever presents it owns it:
  // when another account signs in on the same browser, the subscription moves to that account.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId, auth: keys.auth, p256dh: keys.p256dh },
    create: { endpoint, userId, auth: keys.auth, p256dh: keys.p256dh },
  });

  return NextResponse.json({ success: true });
});

export const DELETE = route(async (req) => {
  const { id: userId } = await requireUser();
  const { endpoint } = await parseJson(req, unsubscribeSchema);

  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });

  return NextResponse.json({ success: true });
});
