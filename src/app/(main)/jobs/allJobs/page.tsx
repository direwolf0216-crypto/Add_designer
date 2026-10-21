import JobTable from '@/components/dashboard/JobTable';
import { requirePageUser } from "@/lib/auth/session";
import { loadJobTablePage } from "@/lib/jobs/jobTablePage";

export const dynamic = 'force-dynamic';

export default async function AllJobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageUser();
  const { jobs, page, totalPages } = await loadJobTablePage(user, await searchParams);
  return <JobTable jobs={jobs} currentPage={page} totalPages={totalPages} />;
}
