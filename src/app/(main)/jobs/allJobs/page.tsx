import JobTable from '@/components/dashboard/JobTable';
import { requirePageUser } from "@/lib/auth/session";
import { loadJobTablePage } from "@/lib/jobs/jobTablePage";
import PageReveal from "@/components/motion/PageReveal";
import type React from "react";

export const dynamic = 'force-dynamic';

async function AllJobsPageContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageUser();
  const { jobs, page, totalPages } = await loadJobTablePage(user, await searchParams);
  return <JobTable jobs={jobs} currentPage={page} totalPages={totalPages} />;
}

export default async function AllJobsPage(props: React.ComponentProps<typeof AllJobsPageContent>) {
  return (
    <PageReveal>
      <AllJobsPageContent {...props} />
    </PageReveal>
  );
}
