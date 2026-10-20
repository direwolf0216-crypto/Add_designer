import { Suspense } from "react";
import { JobProvider } from "@/components/providers/JobProvider";
import JobsLayoutClient from "./JobsLayoutClient";

export default function JobsLayout({ children }: { children: React.ReactNode }) {
  // JobProvider reads filters from the URL (useSearchParams), which needs a Suspense boundary.
  return (
    <Suspense>
      <JobProvider>
        <JobsLayoutClient>{children}</JobsLayoutClient>
      </JobProvider>
    </Suspense>
  );
}
