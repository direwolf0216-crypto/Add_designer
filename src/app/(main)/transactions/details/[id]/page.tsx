import TransactionDetailsModal from "@/components/dashboard/TransactionDetailsModal";
import PageReveal from "@/components/motion/PageReveal";
import type React from "react";

async function TransactionDetailsPageContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TransactionDetailsModal id={id} standalone />;
}

export default async function TransactionDetailsPage(props: React.ComponentProps<typeof TransactionDetailsPageContent>) {
  return (
    <PageReveal>
      <TransactionDetailsPageContent {...props} />
    </PageReveal>
  );
}
