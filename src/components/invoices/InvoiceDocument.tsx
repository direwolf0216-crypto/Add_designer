import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { InvoiceViewModel } from './types/invoiceViewModel';
import { Header } from './components/Header';
import { BillingSection } from './components/BillingSection';
import { InvoiceItemsTable } from './components/InvoiceItemsTable';
import { SummarySection } from './components/SummarySection';
import { Footer } from './components/Footer';

import { colors, typography, layout } from './theme/invoiceTheme';

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.background,
    fontFamily: typography.fontFamily,
    paddingTop: layout.pagePadding,
    paddingLeft: layout.pagePadding,
    paddingRight: layout.pagePadding,
    paddingBottom: layout.pagePadding,
  },
  contentWrapper: {
    flex: 1,
    flexDirection: 'column',
  },
  watermarkContainer: {
    position: 'absolute',
    top: 350,
    left: 120,
    opacity: 0.04,
    transform: 'rotate(-15deg)',
    zIndex: -1,
  },
  watermarkText: {
    fontSize: 180,
    fontWeight: 700,
    color: '#000000',
  },
});

interface InvoiceDocumentProps {
  viewModel: InvoiceViewModel;
}

export default function InvoiceDocument({ viewModel }: InvoiceDocumentProps) {
  return (
    <Document 
      title={`Invoice #${viewModel.invoiceNumber}`}
      author="Add designer"
      subject="Invoice for Printing Services"
      creator="Add designer"
      producer="Add designer"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.watermarkContainer} fixed>
          <Text style={styles.watermarkText}>Add</Text>
        </View>
        <View style={styles.contentWrapper}>
          <Header viewModel={viewModel} />
          <BillingSection viewModel={viewModel} />
          <InvoiceItemsTable viewModel={viewModel} />
          <SummarySection viewModel={viewModel} />
          <Footer viewModel={viewModel} />
        </View>
      </Page>
    </Document>
  );
}
