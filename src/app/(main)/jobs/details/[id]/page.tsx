import JobDetailsModal from "@/components/dashboard/JobDetailsModal";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/session";

export const dynamic = 'force-dynamic';

export default async function JobDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePageUser();
  // Existence check only; the details view loads the full job (with permission-aware fields) via the API.
  const job = await prisma.job.findUnique({ where: { id }, select: { id: true, deletedAt: true } });
  if (!job || job.deletedAt) notFound();

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50">
      <JobDetailsModal standaloneJobId={id} />
    </div>
  );
}
