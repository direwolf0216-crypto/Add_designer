export const getPdfMetadata = (invoiceNumber: string) => {
  return {
    title: `Invoice #${invoiceNumber}`,
    author: 'Add designer',
    subject: 'Invoice for Photography Services',
    keywords: 'Invoice, Add designer, Photography, Job',
    creator: 'Add designer / Kanakkupulla',
    producer: 'Kanakkupulla',
  };
};
