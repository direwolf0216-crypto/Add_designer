import React, { Suspense } from "react";
import TransactionsClient from "./TransactionsClient";
import PageReveal from "@/components/motion/PageReveal";
import PrinterLoader from "@/components/motion/PrinterLoader";

function PageContent() {
  return (
    <Suspense fallback={<PrinterLoader label="Printing your transactions" />}>
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
