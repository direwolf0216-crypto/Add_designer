import JobDetailsModal from "@/components/dashboard/JobDetailsModal";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function JobDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    include: { client: true, order: true, createdBy: true, updatedBy: true }
  });

  if (!job) notFound();

  const safeJob = {
    id: job.id,
    jobNumber: job.jobNumber,
    title: job.client.name,
    category: job.category,
    date: job.date.toISOString().split('T')[0],
    time: job.time,
    location: job.location,
    phone: job.client.phone,
    email: job.client.email || '',
    package: job.order?.package.toString() || '',
    advance: job.order?.advance.toString() || '',
    due: job.order?.due.toString() || '',
    status: job.status as any,
    customData: job.customData as Record<string, any> | null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    inclusions: job.inclusions,
    notes: job.notes,
    attachments: job.attachments,
    photographers: job.photographers,
    createdBy: job.createdBy,
    updatedBy: job.updatedBy,
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50">
      <JobDetailsModal standaloneJobId={id} />
    </div>
  );
}
