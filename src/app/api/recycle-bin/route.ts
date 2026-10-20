import { NextResponse, after } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { intParam, parseJson, route } from "@/lib/api/http";
import { requireAdmin, requireUser, roleHasPermission } from "@/lib/auth/session";
import { businessRangeFromISO } from "@/lib/dates";
import { deleteDriveFiles, forEachEntry, normalizeItemType, purgeItem, storedItemTypes } from "@/lib/services/recycleBin";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/).nullable();
const querySchema = z.object({
  source: z.string().max(50).nullable(),
  trashedBy: z.string().max(50).nullable(),
  startDate: isoDate,
  endDate: isoDate,
});

const TRANSACTION_TYPES = ["transaction", "TRANSACTION_GROUP"];

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export const GET = route(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const { searchParams } = url;
  const query = querySchema.parse({
    source: searchParams.get("source") || null,
    trashedBy: searchParams.get("trashed_by") || null,
    startDate: searchParams.get("startDate") || null,
    endDate: searchParams.get("endDate") || null,
  });
  const limit = intParam(url, "limit", 100, 1, 500);
  const offset = intParam(url, "offset", 0, 0, 1_000_000);

  const conditions: Prisma.RecycleBinWhereInput[] = [];
  if (query.source) {
    const type = normalizeItemType(query.source);
    conditions.push({ itemType: { in: type ? storedItemTypes(type) : [query.source] } });
  }
  // Trashed payments are financial records: only shown to users who can see transactions.
  if (!(await roleHasPermission(user.role, "view_transactions"))) {
    conditions.push({ itemType: { notIn: TRANSACTION_TYPES } });
  }
  if (query.trashedBy) conditions.push({ trashedById: query.trashedBy });
  const range = businessRangeFromISO(query.startDate, query.endDate);
  if (range.start || range.end) conditions.push({ trashedAt: { gte: range.start, lte: range.end } });
  const where: Prisma.RecycleBinWhereInput = { AND: conditions };

  const [items, total] = await Promise.all([
    prisma.recycleBin.findMany({ where, orderBy: { trashedAt: "desc" }, take: limit, skip: offset }),
    prisma.recycleBin.count({ where }),
  ]);

  const userIds = [...new Set(items.map((i) => i.trashedById).filter((id): id is string => !!id))];
  const clientIds = [
    ...new Set(
      items
        .filter((i) => normalizeItemType(i.itemType) === "job")
        .map((i) => asRecord(i.originalData).clientId)
        .filter((id): id is string => typeof id === "string")
    ),
  ];
  const [users, clients] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }),
    prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } }),
  ]);
  const userMap = new Map(users.map((u) => [u.id, u]));
  const clientMap = new Map(clients.map((c) => [c.id, c.name]));

  const formattedItems = items.map((item) => {
    let entryName = "Unknown";
    let transactionId = "-";
    let originalType = item.itemType;

    const data = asRecord(item.originalData);
    const trashedBy = item.trashedById ? userMap.get(item.trashedById) : null;
    const type = normalizeItemType(item.itemType);

    if (type === "job") {
      const clientName = typeof data.clientId === "string" ? clientMap.get(data.clientId) : null;
      entryName = clientName || String(data.clientName || data.eventName || "Job");
      transactionId = String(data.jobNumber || item.itemId.substring(0, 8));
    } else if (type === "transaction") {
      entryName = String(data.category || "Transaction");
      transactionId = String(data.transactionId || "-");
      originalType = String(data.type || "transaction");
    } else if (type === "TRANSACTION_GROUP") {
      const children = (Array.isArray(data.children) ? data.children : []).map(asRecord);
      entryName = children.map((c) => c.category).join(", ") || "Transaction Group";
      transactionId = children.map((c) => c.transactionId).join(", ") || "-";
      originalType = String(children[0]?.type || "TRANSACTION_GROUP");
    } else if (type === "product-order") {
      entryName = String(asRecord(data.customData).clientName || data.clientName || "Order");
      transactionId = String(data.orderNumber || data.orderId || item.itemId.substring(0, 8));
    }
    return {
      id: item.id,
      itemType: item.itemType,
      itemId: item.itemId,
      transactionId,
      originalType,
      entryName,
      trashedBy: trashedBy?.name || trashedBy?.email || item.trashedById || "Unknown",
      trashedAt: item.trashedAt,
      originalData: item.originalData,
    };
  });

  return NextResponse.json(
    { items: formattedItems, total, limit, offset },
    { headers: { "Cache-Control": "private, no-store" } }
  );
});

const idsSchema = z.object({ ids: z.array(z.string().min(1).max(50)).min(1).max(100) });

export const DELETE = route(async (req) => {
  const admin = await requireAdmin();
  const { ids } = await parseJson(req, idsSchema);

  const entries = await prisma.recycleBin.findMany({ where: { id: { in: ids } } });
  const files: string[] = [];
  const result = await forEachEntry(entries, async (entry) => {
    const { driveFileIds } = await purgeItem(entry, admin);
    files.push(...driveFileIds);
  });
  after(() => deleteDriveFiles(admin, files));

  if (result.failed.length > 0) {
    return NextResponse.json(
      { error: "Some items could not be deleted", details: { deleted: result.done.length, failed: result.failed } },
      { status: 409 }
    );
  }
  return NextResponse.json({ success: true, deleted: result.done.length });
});
