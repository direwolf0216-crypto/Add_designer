export const getPdfMetadata = (invoiceNumber: string) => {
  return {
    title: `Invoice #${invoiceNumber}`,
    author: 'Add designer',
    subject: 'Invoice for Printing Services',
    keywords: 'Invoice, Add designer, Printing, Job',
    creator: 'Add designer',
    producer: 'Add designer',
  };
};
