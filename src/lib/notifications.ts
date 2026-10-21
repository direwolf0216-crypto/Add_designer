import "server-only";
import { after } from "next/server";
import { Prisma, type NotificationPriority, type NotificationType } from "@prisma/client";
import webpush from "web-push";
import nodemailer, { type Transporter } from "nodemailer";
import prisma from "./prisma";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Push and email are optional: each channel is enabled only when its credentials are configured.
const pushEnabled = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (pushEnabled) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@adddesigner.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string
  );
}

let transporter: Transporter | null = null;
function getTransporter(): Transporter | null {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number.parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type NotificationParams = {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  actionUrl?: string;
  entityId?: string;
  entityType?: string;
  priority?: NotificationPriority;
};

export async function createNotification(params: NotificationParams) {
  const { userId, title, message, type, actionUrl, entityId, entityType, priority = "NORMAL" } = params;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { pushSubscriptions: true },
    });
    if (!user) return null;

    const prefs = user.notificationPrefs as Record<string, boolean> | null;
    if (prefs && prefs[type] === false) return null;

    const notification = await prisma.notification.create({
      data: { userId, title, message, type, actionUrl, entityId, entityType, priority },
    });

    const deliveries: Promise<unknown>[] = [];

    if (pushEnabled && user.pushNotifications && user.pushSubscriptions.length > 0) {
      const payload = JSON.stringify({ title, body: message, url: actionUrl || "/", icon: "/assets/logo.png", tag: notification.id });
      for (const sub of user.pushSubscriptions) {
        deliveries.push(
          webpush
            .sendNotification({ endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } }, payload)
            .catch(async (e: { statusCode?: number }) => {
              if (e.statusCode === 410 || e.statusCode === 404) {
                await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
              } else {
                console.error("[notifications] push failed", e);
              }
            })
        );
      }
    }

    const mailer = getTransporter();
    if (mailer && user.emailNotifications && user.email) {
      const link = actionUrl
        ? `<a href="${escapeHtml(APP_URL + actionUrl)}" style="display: inline-block; padding: 10px 20px; background: #0f172a; color: #fff; text-decoration: none; border-radius: 5px; margin-top: 15px;">View Details</a>`
        : "";
      deliveries.push(
        mailer
          .sendMail({
            from: process.env.SMTP_FROM || '"Add designer" <notifications@adddesigner.com>',
            to: user.email,
            subject: title.replace(/[\r\n]+/g, " "),
            html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
            <h2 style="color: #ea580c; font-weight: bold; font-size: 24px;">Add designer</h2>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(message)}</p>
            ${link}
          </div>`,
          })
          .catch((e) => console.error("[notifications] email failed", e))
      );
    }

    await Promise.all(deliveries);
    return notification;
  } catch (error) {
    console.error("[notifications] createNotification failed", error);
    return null;
  }
}

export async function broadcastNotification(params: Omit<NotificationParams, "userId"> & { skipUserId?: string | null }) {
  const { skipUserId, ...notificationParams } = params;
  try {
    const permission = `notify_${notificationParams.type}`;
    const [users, rolePermissions] = await Promise.all([
      prisma.user.findMany({ where: { status: "ACTIVE" }, select: { id: true, role: true, customRole: { select: { permissions: true } } } }),
      prisma.rolePermission.findMany({ where: { permission } }),
    ]);
    const rowFor = (role: string) => rolePermissions.find((rp) => rp.role === role)?.enabled;
    // Owner and admins receive notifications unless the type was switched off for them; staff and
    // custom roles only when it was switched on.
    const wants = (user: (typeof users)[number]) => {
      if (user.role === "OWNER" || user.role === "ADMIN") return rowFor(user.role) ?? rowFor("ADMIN") ?? true;
      if (user.role === "STAFF") return rowFor("STAFF") ?? false;
      return user.customRole?.permissions.includes(permission) ?? false;
    };

    const results = await Promise.allSettled(
      users
        .filter((user) => !(skipUserId && user.id === skipUserId))
        .filter(wants)
        .map((user) => createNotification({ ...notificationParams, userId: user.id }))
    );
    return results.flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []));
  } catch (error) {
    console.error("[notifications] broadcast failed", error);
    return [];
  }
}

/**
 * Broadcast after the response is sent. Unlike a floating promise this is guaranteed to run to
 * completion on serverless platforms (Next.js `after`).
 */
export function broadcastLater(params: Parameters<typeof broadcastNotification>[0]) {
  after(() => broadcastNotification(params));
}

/**
 * Claim a reminder slot. Returns false if this exact reminder was already sent, so cron reruns and
 * overlapping schedules never notify twice. Use keys like `PAYMENT_DUE:<jobId>:<yyyy-MM-dd>`.
 */
export async function claimReminder(key: string): Promise<boolean> {
  try {
    await prisma.reminderLog.create({ data: { key } });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
}
