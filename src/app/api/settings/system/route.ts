import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { parseJson, route } from "@/lib/api/http";
import { requireAdmin, requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// Default settings if none exist in the database
const DEFAULT_SETTINGS = {
  UI_PREFERENCES: {
    currencySymbol: "₹",
    hotDateThreshold: 50000,
    calendarTiers: [
      { max: 20000, bg: "#ffedd5", text: "#ea580c" }, // Basic
      { max: 30000, bg: "#fdba74", text: "#7c2d12" }, // Standard
      { max: 50000, bg: "#f97316", text: "#ffffff" }, // Premium
      { max: 9999999, bg: "#c2410c", text: "#ffffff" }, // Elite
    ],
    statusColors: {
      "Confirmed": { bg: "#10b981", text: "#047857" }, // Emerald
      "Pending": { bg: "#ef4444", text: "#b91c1c" }, // Red
      "Partial": { bg: "#f97316", text: "#c2410c" }, // Orange
      "Completed": { bg: "#3b82f6", text: "#1d4ed8" }, // Blue
      "Cancelled": { bg: "#64748b", text: "#334155" }, // Slate
    }
  },
  BANNER_SETTINGS: {
    bannerEnabled: true,
    bannerTime1: "09:00",
    bannerTime2: "17:00"
  }
};

const color = z.string().max(32);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM");
const businessText = z.string().trim().max(500);
const threshold = z.object({ days: z.number().int().min(0).max(365) });

// Every key the app reads (SystemProvider, banner, invoices, reminders cron). Anything else is rejected,
// which also keeps the Drive folder cache rows (google_drive_folder_*) out of reach.
const SETTING_SCHEMAS = {
  UI_PREFERENCES: z.looseObject({
    currencySymbol: z.string().max(8).optional(),
    hotDateThreshold: z.number().nonnegative().optional(),
    calendarTiers: z.array(z.looseObject({ max: z.number(), bg: color, text: color })).max(20).optional(),
    statusColors: z.record(z.string().max(100), z.looseObject({ bg: color, text: color })).optional(),
  }),
  BANNER_SETTINGS: z.looseObject({
    bannerEnabled: z.boolean().optional(),
    bannerTime1: time.optional(),
    bannerTime2: time.optional(),
  }),
  business_name: businessText,
  business_phone: businessText,
  business_email: businessText,
  business_address: businessText,
  business_instagram: businessText,
  business_website: businessText,
  business_bank_name: businessText,
  business_upi_id: businessText,
  reminder_threshold_order_stale: threshold,
  reminder_threshold_order_ready: threshold,
  reminder_threshold_advance: threshold,
  reminder_threshold_proof: threshold,
  reminder_threshold_finishing: threshold,
  reminder_threshold_payment_due: threshold,
} as const;

type SettingKey = keyof typeof SETTING_SCHEMAS;
const SETTING_KEYS = Object.keys(SETTING_SCHEMAS) as [SettingKey, ...SettingKey[]];

const bodySchema = z.object({ key: z.enum(SETTING_KEYS), value: z.unknown() });

export const GET = route(async () => {
  await requireUser();

  const defaultKeys = Object.keys(DEFAULT_SETTINGS) as (keyof typeof DEFAULT_SETTINGS)[];
  let settings = await prisma.systemSetting.findMany({ where: { key: { in: defaultKeys } } });

  if (settings.length < defaultKeys.length) {
    await prisma.systemSetting.createMany({
      data: defaultKeys.map((key) => ({ key, value: DEFAULT_SETTINGS[key] })),
      skipDuplicates: true,
    });
    settings = await prisma.systemSetting.findMany({ where: { key: { in: defaultKeys } } });
  }

  const settingsMap: Record<string, unknown> = {};
  for (const key of defaultKeys) {
    settingsMap[key] = settings.find((s) => s.key === key)?.value ?? DEFAULT_SETTINGS[key];
  }

  return NextResponse.json(settingsMap);
});

export const PUT = route(async (req) => {
  await requireAdmin();
  const { key, value: raw } = await parseJson(req, bodySchema);
  const value = SETTING_SCHEMAS[key].parse(raw) as Prisma.InputJsonValue;

  const updatedSetting = await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });

  return NextResponse.json(updatedSetting);
});
