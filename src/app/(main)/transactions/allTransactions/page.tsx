import React, { Suspense } from "react";
import TransactionsClient from "./TransactionsClient";
import PageReveal from "@/components/motion/PageReveal";

function PageContent() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-slate-500">Loading transactions...</div>}>
      <TransactionsClient />
    </Suspense>
  );
}

export default function Page() {
  return (
    <PageReveal>
      <PageContent />
    </PageReveal>
  );
}
