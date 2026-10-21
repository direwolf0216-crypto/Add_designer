import JobDetailsModal from "@/components/dashboard/JobDetailsModal";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/session";
import { jobScope } from "@/lib/jobs/scope";
import PageReveal from "@/components/motion/PageReveal";
import type React from "react";

export const dynamic = 'force-dynamic';

async function JobDetailsPageContent({ params }: { params: Promise<{ id: string }> }) {
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

export default async function JobDetailsPage(props: React.ComponentProps<typeof JobDetailsPageContent>) {
  return (
    <PageReveal>
      <JobDetailsPageContent {...props} />
    </PageReveal>
  );
}
