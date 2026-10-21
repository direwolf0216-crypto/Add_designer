import JobDetailsModal from "@/components/dashboard/JobDetailsModal";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/session";
import { jobScope } from "@/lib/jobs/scope";

export const dynamic = 'force-dynamic';

export default async function JobDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser();
  // Existence + visibility check only; the details view loads the full job via the API.
  const job = await prisma.job.findFirst({ where: { id, ...(await jobScope(user)) }, select: { id: true } });
  if (!job) notFound();

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50">
      <JobDetailsModal standaloneJobId={id} />
    </div>
  );
}
