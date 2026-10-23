import { Suspense } from "react";
import PageReveal from "@/components/motion/PageReveal";
import PrinterLoader from "@/components/motion/PrinterLoader";
import { requirePageUser } from "@/lib/auth/session";
import { loadJobsWorkspace } from "@/lib/jobs/workspace";
import JobsWorkspace from "@/features/jobs/workspace/JobsWorkspace";

export const dynamic = "force-dynamic";

export default async function JobsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePageUser();
  const data = await loadJobsWorkspace(user, await searchParams);
  return (
    <PageReveal>
      <Suspense fallback={<PrinterLoader />}>
        <JobsWorkspace data={data} />
      </Suspense>
    </PageReveal>
  );
}
