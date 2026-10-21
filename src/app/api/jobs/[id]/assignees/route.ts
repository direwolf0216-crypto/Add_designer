import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { parseJson, route } from "@/lib/api/http";
import { requirePermission } from "@/lib/auth/session";
import { updateJob } from "@/lib/services/jobs";
import { MAX_ASSIGNEES, notifyAssigned } from "@/lib/services/assignments";

const bodySchema = z.object({
  userIds: z.array(z.string().min(1).max(64)).max(MAX_ASSIGNEES),
});

/** Replace the job's assignees (quick assign from details / job-status). */
export const PUT = route<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission("manage_jobs");
  const { id } = await params;
  const { userIds } = await parseJson(req, bodySchema);

  const { before, job, assignmentChanges } = await updateJob(user, id, () => ({ assigneeIds: userIds }));
  notifyAssigned({ id: job.id, jobNumber: job.jobNumber, clientName: before.client.name }, assignmentChanges.added, user.id);

  const assignments = await prisma.jobAssignment.findMany({
    where: { jobId: id },
    orderBy: { assignedAt: "asc" },
    select: { userId: true, assignedAt: true, user: { select: { id: true, name: true, image: true, role: true } } },
  });
  return NextResponse.json({ assignments }, { headers: { "Cache-Control": "private, no-store" } });
});
